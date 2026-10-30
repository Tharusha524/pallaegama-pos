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
import {
  isDesktopApp, listUnsyncedSales, markSaleSynced, markSaleSyncFailed,
  listUnsyncedStockDamages, markStockDamageSynced, markStockDamageSyncFailed,
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
