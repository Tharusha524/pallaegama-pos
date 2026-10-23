import api from "../apiClient";

// ---- Barcode Lookup ----
export const lookupBarcode = async (code: string, salesTypeId?: number) => {
  const response = await api.get("/barcode-lookup", {
    params: { code, sales_type_id: salesTypeId },
    skipErrorDialog: true,
  } as any);
  return response.data;
};

// ---- Stock batches (same barcode, more than one price) ----
export interface BatchPriceGroup {
  batch_id: number;
  selling_price: number;
  mrp: number | null;
  qty: number;
  received_date: string | null;
}

/** Only the products that currently have 2+ prices at this location. */
export const getMultiPriceProducts = async (locCode?: string): Promise<Record<string, BatchPriceGroup[]>> => {
  const response = await api.get("/stock-batches/multi-price", {
    params: { loc_code: locCode || undefined },
    skipErrorDialog: true,
  } as any);
  return response.data ?? {};
};

/** Stock waiting for a price (new-cost purchases not priced on Set Price yet) — not sellable. */
export const getPendingPriceQty = async (locCode?: string): Promise<Record<string, number>> => {
  const response = await api.get("/stock-batches/pending", {
    params: { loc_code: locCode || undefined },
    skipErrorDialog: true,
  } as any);
  return response.data ?? {};
};

// ---- POS Shifts ----
export const getPosShifts = async (params?: { status?: string; user_id?: number }) =>
  (await api.get("/pos-shifts", { params })).data;
export const openPosShift = async (data: { user_id: number; sales_pos_id?: number; opening_float: number; notes?: string }) =>
  (await api.post("/pos-shifts", data)).data;
export const getPosShift = async (id: number | string) => (await api.get(`/pos-shifts/${id}`)).data;
export const closePosShift = async (
  id: number | string,
  data: { closing_expected: number; closing_counted: number; notes?: string }
) => (await api.post(`/pos-shifts/${id}/close`, data)).data;

export const addFloatMovement = async (
  shiftId: number | string,
  data: { type: "cash_in" | "cash_out"; amount: number; reason?: string; recorded_by?: number }
) => (await api.post(`/pos-shifts/${shiftId}/float-movements`, data)).data;

export const getFloatMovements = async (shiftId: number | string) =>
  (await api.get(`/pos-shifts/${shiftId}/float-movements`)).data;

// ---- Stock Damages ----
export const getStockDamages = async (params?: { stock_id?: string; from_date?: string; to_date?: string }) =>
  (await api.get("/stock-damages", { params })).data;
export const recordStockDamage = async (data: { stock_id: string; loc_code?: string; quantity: number; reason?: string; damage_date?: string; batch_id?: number; return_trans_no?: number }) =>
  (await api.post("/stock-damages", data)).data;
export const deleteStockDamage = async (id: number | string) => (await api.delete(`/stock-damages/${id}`)).data;
export const getStockDamageSummary = async (params?: { from_date?: string; to_date?: string }) =>
  (await api.get("/stock-damages-summary", { params })).data;

// ---- Low Stock ----
export const getLowStock = async (lookbackDays = 30, locCode?: string) =>
  (await api.get("/inventory/low-stock", { params: { lookback_days: lookbackDays, loc_code: locCode } })).data;

// ---- Sales Analytics ----
export const getSupermarketDashboardSummary = async () =>
  (await api.get("/sales-analytics/dashboard-summary")).data;
export const getProductPerformance = async (params?: { from_date?: string; to_date?: string; limit?: number }) =>
  (await api.get("/sales-analytics/product-performance", { params })).data;
export const getSalesTrend = async (params?: { from_date?: string; to_date?: string; group_by?: "day" | "month" }) =>
  (await api.get("/sales-analytics/sales-trend", { params })).data;
export const getTopCustomers = async (limit = 10) =>
  (await api.get("/sales-analytics/top-customers", { params: { limit } })).data;

// ---- Purchase Analytics ----
export const getLowestCostBySupplier = async (stockId?: string) =>
  (await api.get("/purchase-analytics/lowest-cost-by-supplier", { params: { stock_id: stockId } })).data;
export const getBestSuppliers = async (params?: { from_date?: string; to_date?: string }) =>
  (await api.get("/purchase-analytics/best-suppliers", { params })).data;
