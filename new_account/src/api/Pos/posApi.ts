import api from "../apiClient";

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

// ---- Stock Damages ----
export const getStockDamages = async (params?: { stock_id?: string; from_date?: string; to_date?: string }) =>
  (await api.get("/stock-damages", { params })).data;
export const recordStockDamage = async (data: { stock_id: string; loc_code?: string; quantity: number; reason?: string; damage_date?: string }) =>
  (await api.post("/stock-damages", data)).data;
export const deleteStockDamage = async (id: number | string) => (await api.delete(`/stock-damages/${id}`)).data;
export const getStockDamageSummary = async (params?: { from_date?: string; to_date?: string }) =>
  (await api.get("/stock-damages-summary", { params })).data;

// ---- Low Stock ----
export const getLowStock = async (lookbackDays = 30) =>
  (await api.get("/inventory/low-stock", { params: { lookback_days: lookbackDays } })).data;

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
