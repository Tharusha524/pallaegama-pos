<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One-time repair for POS sales that recorded the cash the customer handed
 * over instead of the bill value. A 1,500 bill paid with a 2,000 note was
 * settled as 2,000, so the 500 change — which went straight back across the
 * counter — was left in the books: Cash in Hand overstated by the change,
 * Trade Debtors negative by the same amount ("we owe the customer 500").
 *
 * This brings each over-settled cash sale back to its own bill value, in the
 * five places that amount was written. Sales revenue, stock and COGS are
 * never touched — they were always correct; only the settlement side was
 * wrong. Under-settled sales (a genuine part payment or credit) are left
 * exactly as they are, as is anything that isn't a straight one-payment,
 * one-invoice POS sale.
 *
 * Dry run by default: nothing is written without --apply.
 */
class FixOverpaidSettlementsCommand extends Command
{
    protected $signature = 'pos:fix-overpaid-settlements
                            {--apply : Write the corrections (otherwise this is a dry run)}';

    protected $description = 'Correct POS sales settled with the cash tendered instead of the bill value';

    private const TYPE_INVOICE = 10;
    private const TYPE_PAYMENT = 12;

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');

        $this->warn($apply
            ? 'APPLYING corrections — make sure you have a database backup.'
            : 'DRY RUN — nothing will be written. Re-run with --apply to save.');
        $this->newLine();

        $cases = $this->overpaidCases();

        if ($cases->isEmpty()) {
            $this->info('No over-settled sales found. Nothing to do.');

            return self::SUCCESS;
        }

        $this->table(
            ['Invoice', 'Payment', 'Bill', 'Recorded as paid', 'Change wrongly kept'],
            $cases->take(10)->map(fn ($c) => [
                $c->invoice_no,
                $c->payment_no,
                number_format($c->bill, 2),
                number_format($c->settled, 2),
                number_format($c->settled - $c->bill, 2),
            ])->all()
        );
        if ($cases->count() > 10) {
            $this->line('... and ' . ($cases->count() - 10) . ' more.');
        }

        $total = $cases->sum(fn ($c) => $c->settled - $c->bill);
        $this->newLine();
        $this->info('Sales to correct : ' . $cases->count());
        $this->info('Total correction : ' . number_format($total, 2));
        $this->line('  Cash in Hand will go DOWN by this amount (it was never in the drawer).');
        $this->line('  Trade Debtors will go UP by this amount, back towards zero.');
        $this->line('  Sales, stock and COGS are not touched.');

        if (! $apply) {
            $this->newLine();
            $this->warn('Dry run complete — nothing was written.');

            return self::SUCCESS;
        }

        $this->newLine();
        $this->info('Applying...');
        $bar = $this->output->createProgressBar($cases->count());

        DB::transaction(function () use ($cases, $bar) {
            foreach ($cases as $case) {
                $this->correct($case);
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine(2);
        $this->info('Done. ' . $cases->count() . ' sale(s) corrected by ' . number_format($total, 2) . ' in total.');

        return self::SUCCESS;
    }

    /**
     * Straight POS sales — exactly one payment settling exactly one invoice —
     * where more was recorded as settled than the invoice was ever worth.
     * A payment split across invoices, or an invoice settled by several
     * payments, is skipped: those need a human to look at them.
     */
    private function overpaidCases()
    {
        $singles = DB::table('cust_allocations')
            ->where('trans_type_from', self::TYPE_PAYMENT)
            ->where('trans_type_to', self::TYPE_INVOICE)
            ->select('id', 'amt', 'trans_no_from', 'trans_no_to')
            ->get();

        $paymentUsedOnce = $singles->groupBy('trans_no_from')->filter(fn ($g) => $g->count() === 1);
        $invoiceUsedOnce = $singles->groupBy('trans_no_to')->filter(fn ($g) => $g->count() === 1);

        return $singles
            ->filter(fn ($a) => $paymentUsedOnce->has($a->trans_no_from) && $invoiceUsedOnce->has($a->trans_no_to))
            ->map(function ($a) {
                $invoice = DB::table('debtor_trans')
                    ->where('trans_type', self::TYPE_INVOICE)->where('trans_no', $a->trans_no_to)->first();
                $payment = DB::table('debtor_trans')
                    ->where('trans_type', self::TYPE_PAYMENT)->where('trans_no', $a->trans_no_from)->first();
                if (! $invoice || ! $payment) {
                    return null;
                }

                // What the bill was actually worth, the way the invoice itself
                // stores it (tax/freight are 0 on a plain POS sale, but a shop
                // that switches tax on later must still net off correctly).
                $bill = (float) $invoice->ov_amount + (float) $invoice->ov_gst
                    + (float) $invoice->ov_freight + (float) $invoice->ov_freight_tax;

                return (object) [
                    'alloc_id' => $a->id,
                    'invoice_no' => $a->trans_no_to,
                    'payment_no' => $a->trans_no_from,
                    'bill' => round($bill, 2),
                    'settled' => round((float) $a->amt, 2),
                ];
            })
            ->filter()
            // Only ever reduce. An under-settled sale is a real debt, left alone.
            ->filter(fn ($c) => $c->settled - $c->bill > 0.005)
            ->sortBy('invoice_no')
            ->values();
    }

    /**
     * The same amount was written in five places when the sale was posted.
     * All five come down to the bill value together, so the books stay
     * internally consistent and the balance sheet still balances.
     */
    private function correct(object $case): void
    {
        $bill = $case->bill;

        // 1. The invoice's settled-so-far figure (this is what the dashboard reads).
        DB::table('debtor_trans')
            ->where('trans_type', self::TYPE_INVOICE)->where('trans_no', $case->invoice_no)
            ->update(['alloc' => $bill, 'updated_at' => now()]);

        // 2. The payment document itself — a receipt for the bill now, not for the note.
        DB::table('debtor_trans')
            ->where('trans_type', self::TYPE_PAYMENT)->where('trans_no', $case->payment_no)
            ->update(['ov_amount' => $bill, 'alloc' => $bill, 'updated_at' => now()]);

        // 3. The allocation linking the two.
        DB::table('cust_allocations')
            ->where('id', $case->alloc_id)
            ->update(['amt' => $bill, 'updated_at' => now()]);

        // 4. The cash book line.
        if (Schema::hasTable('bank_trans')) {
            DB::table('bank_trans')
                ->where('type', self::TYPE_PAYMENT)->where('trans_no', $case->payment_no)
                ->update(['amount' => $bill, 'updated_at' => now()]);
        }

        // 5. The ledger pair: cash debited, receivables credited. Both sides
        //    move by the same amount, so the journal stays balanced.
        $glRows = DB::table('gl_trans')
            ->where('type', (string) self::TYPE_PAYMENT)->where('type_no', $case->payment_no)
            ->get();

        foreach ($glRows as $row) {
            $isDebit = (float) $row->debit > 0;
            DB::table('gl_trans')->where('id', $row->id)->update([
                'debit' => $isDebit ? $bill : 0,
                'credit' => $isDebit ? 0 : $bill,
                'amount' => $isDebit ? $bill : -$bill,
                'updated_at' => now(),
            ]);
        }
    }
}
