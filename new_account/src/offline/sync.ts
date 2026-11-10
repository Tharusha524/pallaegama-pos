/**
 * Pushes sales queued while offline (see db.ts) back up to Laravel once the
 * connection returns. Runs only inside the desktop app — the plain browser
 * build never queues anything locally, so this is always a no-op there.
 */
import { directSalesInvoice, type DirectSalesInvoicePayload } from "../api/SalesInvoice/SalesInvoiceApi";
import { recordStockDamage } from "../api/Pos/posApi";
import { savePosReceiptCopy } from "../api/Pos/posOpsApi";
import { getStockList } from "../api/Inventory/StockListApi";
import { notify } from "../services/notificationService";
import queryClient from "../state/queryClient";
import { getCreditOpenBills } from "../api/Credit/creditApi";
import { createCustomerPayment } from "../api/SalesPayment/SalesPaymentApi";
import {
  isDesktopApp, listUnsyncedSales, markSaleSynced, markSaleSyncFailed,
  listUnsyncedStockDamages, markStockDamageSynced, markStockDamageSyncFailed,
  listUnsyncedCreditPayments, markCreditPaymentSynced, markCreditPaymentSyncFailed,
  saveReferenceData,
} from "./db";

/**
 * The cached stock snapshot (products/quantities) goes stale the moment an
 * offline sale is queued — it still shows pre-sale quantities until this
 * runs. Called after every sale/damage sync so the numbers are right again
 * as soon as the server actually knows about what was sold/damaged.
 */
async function refreshStockSnapshot(): Promise<void> {
  try {
    const freshStock = await getStockList();
    if (freshStock && freshStock.length > 0) {
      await saveReferenceData("stock_list", freshStock);
    }
    // If the Stock page happens to be open right now, make it show the
    // fresh numbers immediately instead of waiting for its own next fetch.
    queryClient.invalidateQueries({ queryKey: ["stock-list"] });
    queryClient.invalidateQueries({ queryKey: ["stock-list-all"] });
  } catch {
    // Best-effort — the old snapshot just stays until the next successful refresh.
  }
}

let syncing = false;

export async function syncPendingSales(): Promise<void> {
  if (!isDesktopApp() || syncing) return;
  syncing = true;
  try {
    const pending = await listUnsyncedSales();
    if (pending.length === 0) return;

    let succeeded = 0;
    let failed = 0;
    for (const sale of pending) {
      try {
        const parsed = JSON.parse(sale.payload);
        // The receipt copy travels with the queued sale but is not part of the invoice.
        const receiptCopy = parsed._receipt_copy;
        delete parsed._receipt_copy;
        const payload: DirectSalesInvoicePayload = parsed;
        const result: any = await directSalesInvoice(payload);
        await markSaleSynced(sale.uuid);
        // Exact copy of the receipt for reprints, now under its real invoice number.
        // Best-effort: a failure here never un-syncs the sale.
        if (receiptCopy && result?.trans_no) {
          await savePosReceiptCopy(result.trans_no, receiptCopy).catch(() => {});
        }
        succeeded += 1;
      } catch (err: any) {
        // Leave it queued — it'll retry on the next sync pass rather than being lost.
        await markSaleSyncFailed(sale.uuid, err?.message ?? "Unknown sync error");
        failed += 1;
      }
    }

    if (succeeded > 0) {
      notify.success(`Synced ${succeeded} offline sale${succeeded > 1 ? "s" : ""} to the server`);
      await refreshStockSnapshot();
    }
    if (failed > 0) notify.error(`${failed} offline sale${failed > 1 ? "s" : ""} failed to sync — will retry`);
  } finally {
    syncing = false;
  }
}

let syncingDamages = false;

export async function syncPendingStockDamages(): Promise<void> {
  if (!isDesktopApp() || syncingDamages) return;
  syncingDamages = true;
  try {
    const pending = await listUnsyncedStockDamages();
    if (pending.length === 0) return;

    let succeeded = 0;
    let failed = 0;
    for (const d of pending) {
      try {
        await recordStockDamage({
          stock_id: d.stock_id,
          quantity: d.quantity,
          reason: d.reason ?? undefined,
          damage_date: d.damage_date,
        });
        await markStockDamageSynced(d.uuid);
        succeeded += 1;
      } catch (err: any) {
        await markStockDamageSyncFailed(d.uuid, err?.message ?? "Unknown sync error");
        failed += 1;
      }
    }

    if (succeeded > 0) {
      notify.success(`Synced ${succeeded} offline damage record${succeeded > 1 ? "s" : ""}`);
      await refreshStockSnapshot();
    }
    if (failed > 0) notify.error(`${failed} damage record${failed > 1 ? "s" : ""} failed to sync — will retry`);
  } finally {
    syncingDamages = false;
  }
}

let syncingCreditPayments = false;

/**
 * Old-bill payments taken at the till while offline. Only the amount was
 * queued; which bills it settles is decided here, against the server's real
 * open bills, so a stale offline balance can never mis-allocate it. The
 * amount is also capped at what the customer actually still owes — another
 * till may have taken money for the same bills in the meantime.
 */
export async function syncPendingCreditPayments(): Promise<void> {
  if (!isDesktopApp() || syncingCreditPayments) return;
  syncingCreditPayments = true;
  try {
    const pending = await listUnsyncedCreditPayments();
    if (pending.length === 0) return;

    let succeeded = 0;
    let failed = 0;
    let capped = 0;
    for (const p of pending) {
      try {
        const open: any = await getCreditOpenBills(p.debtor_no);
        const owes = Number(open?.summary?.outstanding_balance ?? 0);
        const amount = Number(Math.min(p.amount, owes).toFixed(2));
        if (amount <= 0.005) {
          // Nothing left owing — the debt was cleared elsewhere. Drop it
          // rather than pushing the customer into a negative balance.
          await markCreditPaymentSynced(p.uuid);
          capped += 1;
          continue;
        }
        if (amount < p.amount - 0.005) capped += 1;

        let left = amount;
        const allocations: { trans_no_to: number; trans_type_to: number; amt: number }[] = [];
        for (const b of (open?.bills ?? [])) {
          if (left <= 0.005) break;
          const owing = Number(b.owing);
          if (owing <= 0.005) continue;
          const amt = Math.min(left, owing);
          allocations.push({ trans_no_to: Number(b.trans_no), trans_type_to: 10, amt: Number(amt.toFixed(2)) });
          left = Number((left - amt).toFixed(2));
        }

        await createCustomerPayment({
          debtor_no: Number(p.debtor_no),
          branch_code: Number(p.branch_code),
          tran_date: p.tran_date,
          bank_account_id: Number(p.bank_account_id),
          amount,
          comments: p.comments ?? "POS old bill payment (offline)",
          allocations,
        } as any);
        await markCreditPaymentSynced(p.uuid);
        succeeded += 1;
      } catch (err: any) {
        await markCreditPaymentSyncFailed(p.uuid, err?.message ?? "Unknown sync error");
        failed += 1;
      }
    }

    if (succeeded > 0) {
      notify.success(`Synced ${succeeded} offline credit payment${succeeded > 1 ? "s" : ""}`);
      queryClient.invalidateQueries({ queryKey: ["credit-open-bills"] });
      queryClient.invalidateQueries({ queryKey: ["credit-customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-credit"] });
    }
    if (capped > 0) {
      notify.info(`${capped} offline credit payment${capped > 1 ? "s were" : " was"} reduced — the customer owed less than expected`);
    }
    if (failed > 0) notify.error(`${failed} credit payment${failed > 1 ? "s" : ""} failed to sync — will retry`);
  } finally {
    syncingCreditPayments = false;
  }
}
