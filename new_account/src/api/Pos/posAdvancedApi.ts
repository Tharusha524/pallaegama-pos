import api from "../apiClient";

// ---- Product Variants ----
export const getItemVariants = async (stockId?: string) =>
  (await api.get("/item-variants", { params: stockId ? { stock_id: stockId } : {} })).data;
export const createItemVariant = async (data: { stock_id: string; variant_name: string; sku?: string; barcode?: string; price_adjustment?: number }) =>
  (await api.post("/item-variants", data)).data;
export const updateItemVariant = async (id: number | string, data: any) => (await api.put(`/item-variants/${id}`, data)).data;
export const deleteItemVariant = async (id: number | string) => (await api.delete(`/item-variants/${id}`)).data;
export const setVariantStock = async (id: number | string, data: { loc_code: string; quantity: number }) =>
  (await api.post(`/item-variants/${id}/stock`, data)).data;
export const deductVariantStock = async (id: number | string, data: { loc_code: string; quantity: number }) =>
  (await api.post(`/item-variants/${id}/deduct-stock`, data)).data;

// ---- Service / Repair Tickets ----
export const getServiceTickets = async (status?: string) =>
  (await api.get("/service-tickets", { params: status ? { status } : {} })).data;
export const createServiceTicket = async (data: { debtor_no?: number; item_description: string; serial_no?: string; issue_notes?: string; due_date?: string }) =>
  (await api.post("/service-tickets", data)).data;
export const updateServiceTicket = async (id: number | string, data: { status?: string; issue_notes?: string; serial_no?: string; due_date?: string }) =>
  (await api.put(`/service-tickets/${id}`, data)).data;

// ---- Deep Reports Suite ----
export const getVelocityAndDemand = async (params?: { from_date?: string; to_date?: string }) =>
  (await api.get("/sales-analytics/velocity-and-demand", { params })).data;
export const getDeadStock = async (lookbackDays = 90, locCode?: string) =>
  (await api.get("/sales-analytics/dead-stock", { params: { lookback_days: lookbackDays, loc_code: locCode } })).data;
export const getProductProfit = async (params?: { from_date?: string; to_date?: string }) =>
  (await api.get("/sales-analytics/product-profit", { params })).data;
export const getBusinessActivity = async (params?: { from_date?: string; to_date?: string }) =>
  (await api.get("/sales-analytics/business-activity", { params })).data;
export const getValuation = async (locCode?: string) =>
  (await api.get("/sales-analytics/valuation", { params: { loc_code: locCode } })).data;
export const getNegativeStock = async (locCode?: string) =>
  (await api.get("/sales-analytics/negative-stock", { params: { loc_code: locCode } })).data;
export const getVoucherLiability = async () =>
  (await api.get("/sales-analytics/voucher-liability")).data;
export const getReceivablesAging = async () =>
  (await api.get("/sales-analytics/receivables-aging")).data;
export const getPayablesAging = async () =>
  (await api.get("/sales-analytics/payables-aging")).data;
export const getSalesSummary = async (params?: { from_date?: string; to_date?: string }) =>
  (await api.get("/sales-analytics/sales-summary", { params })).data;
export const getSalesByCashierShift = async (params?: { from_date?: string; to_date?: string }) =>
  (await api.get("/sales-analytics/sales-by-cashier-shift", { params })).data;
export const getShiftDayEndSummary = async (shiftId: number | string) =>
  (await api.get(`/sales-analytics/shift-day-end/${shiftId}`)).data;
export const getVoidReport = async (params?: { from_date?: string; to_date?: string }) =>
  (await api.get("/sales-analytics/void-report", { params })).data;
export const getPriceOverrideAudit = async (params?: { from_date?: string; to_date?: string }) =>
  (await api.get("/sales-analytics/price-override-audit", { params })).data;
export const getSupplierItemList = async (supplierId?: number | string) =>
  (await api.get("/sales-analytics/supplier-item-list", { params: { supplier_id: supplierId } })).data;
