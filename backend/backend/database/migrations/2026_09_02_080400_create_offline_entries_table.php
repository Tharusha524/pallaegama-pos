<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Informal record of a sale/purchase made outside the system (e.g. a
        // manual paper sale later logged for reconciliation). Deliberately
        // NOT posted to GL/debtor_trans — it's a memo record, matching how
        // this class of "offline entry" behaves in comparable POS systems.
        // A real sale must still go through directInvoice() to hit accounts.
        Schema::create('offline_entries', function (Blueprint $table) {
            $table->id();
            $table->enum('entry_type', ['sale', 'purchase']);
            $table->date('entry_date');
            $table->unsignedBigInteger('debtor_no')->nullable();
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->decimal('total_amount', 15, 2);
            $table->json('payment_breakdown'); // [{method, amount, note, cheque_no, bank}]
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('recorded_by')->nullable();
            $table->timestamps();

            $table->foreign('debtor_no')->references('debtor_no')->on('debtors_master')->nullOnDelete();
            $table->foreign('supplier_id')->references('supplier_id')->on('suppliers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offline_entries');
    }
};
