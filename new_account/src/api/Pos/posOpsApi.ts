import api from "../apiClient";

// ---- Held Sales (park/recall) ----
export const getHeldSales = async (userId?: number) =>
  (await api.get("/held-sales", { params: userId ? { user_id: userId } : {} })).data;
export const holdSale = async (data: { user_id: number; debtor_no?: number; cart_snapshot: any }) =>
  (await api.post("/held-sales", data)).data;
export const deleteHeldSale = async (id: number | string) => (await api.delete(`/held-sales/${id}`)).data;

// ---- Stock Adjustments ----
export const getStockAdjustments = async (stockId?: string) =>
  (await api.get("/stock-adjustments", { params: stockId ? { stock_id: stockId } : {} })).data;
export const createStockAdjustment = async (data: {
  stock_id: string; loc_code: string; movement_type: "add" | "reduce" | "override";
  quantity: number; reason?: string; notes?: string;
}) => (await api.post("/stock-adjustments", data)).data;

// ---- Stock Transfers ----
export const getStockTransfers = async () => (await api.get("/stock-transfers")).data;
export const createStockTransfer = async (data: {
  from_loc_code: string; to_loc_code: string; items: { stock_id: string; quantity: number }[];
}) => (await api.post("/stock-transfers", data)).data;
export const dispatchStockTransfer = async (id: number | string) => (await api.post(`/stock-transfers/${id}/dispatch`)).data;
export const receiveStockTransfer = async (id: number | string) => (await api.post(`/stock-transfers/${id}/receive`)).data;
export const cancelStockTransfer = async (id: number | string) => (await api.post(`/stock-transfers/${id}/cancel`)).data;

// ---- Inventory Audits ----
export const getInventoryAudits = async () => (await api.get("/inventory-audits")).data;
export const createInventoryAudit = async (data: { loc_code: string; notes?: string }) =>
  (await api.post("/inventory-audits", data)).data;
export const addInventoryAuditItem = async (auditId: number | string, data: { stock_id: string; counted_quantity: number }) =>
  (await api.post(`/inventory-audits/${auditId}/items`, data)).data;
export const completeInventoryAudit = async (auditId: number | string) =>
  (await api.post(`/inventory-audits/${auditId}/complete`)).data;

// ---- Offline Entries ----
export const getOfflineEntries = async (entryType?: "sale" | "purchase") =>
  (await api.get("/offline-entries", { params: entryType ? { entry_type: entryType } : {} })).data;
export const createOfflineEntry = async (data: any) => (await api.post("/offline-entries", data)).data;
export const updateOfflineEntry = async (id: number | string, data: any) => (await api.put(`/offline-entries/${id}`, data)).data;
export const deleteOfflineEntry = async (id: number | string) => (await api.delete(`/offline-entries/${id}`)).data;

// ---- Warranty ----
export const getWarrantyPolicies = async () => (await api.get("/warranty-policies")).data;
export const createWarrantyPolicy = async (data: any) => (await api.post("/warranty-policies", data)).data;
export const getWarranties = async (stockId?: string) =>
  (await api.get("/warranties", { params: stockId ? { stock_id: stockId } : {} })).data;
export const createWarranty = async (data: any) => (await api.post("/warranties", data)).data;
export const checkWarranty = async (query: string) => (await api.get("/warranties-check", { params: { query } })).data;
export const getWarrantyClaims = async () => (await api.get("/warranty-claims")).data;
export const createWarrantyClaim = async (data: { warranty_id: number; issue_description: string }) =>
  (await api.post("/warranty-claims", data)).data;
export const updateWarrantyClaim = async (id: number | string, data: { status: string; resolution_notes?: string }) =>
  (await api.put(`/warranty-claims/${id}`, data)).data;

// ---- Vouchers / Gift Cards ----
export const getVouchers = async () => (await api.get("/vouchers")).data;
export const createVoucher = async (data: { debtor_no?: number; face_value: number; expiry_date?: string; note?: string }) =>
  (await api.post("/vouchers", data)).data;
export const getVoucherByCode = async (code: string) => (await api.get(`/vouchers/${code}`)).data;
export const redeemVoucher = async (data: { voucher_code: string; amount: number; debtor_trans_no?: number; debtor_trans_type?: number }) =>
  (await api.post("/vouchers-redeem", data)).data;

// ---- Coupons ----
export const applyCoupon = async (data: { coupon_code: string; debtor_no?: number }) =>
  (await api.post("/offers-apply-coupon", data, { skipErrorDialog: true } as any)).data;
export const confirmCouponUsage = async (data: {
  coupon_code: string; debtor_no?: number; discount_amount: number; debtor_trans_no?: number; debtor_trans_type?: number;
}) => (await api.post("/offers-confirm-coupon-usage", data)).data;

// ---- Frequently Bought Together / RFM ----
export const getFrequentlyBoughtTogether = async (stockId: string) =>
  (await api.get("/sales-analytics/frequently-bought-together", { params: { stock_id: stockId } })).data;
export const getCustomerSegments = async (lookbackDays = 365) =>
  (await api.get("/sales-analytics/customer-segments", { params: { lookback_days: lookbackDays } })).data;

// ---- POS Settings ----
export const getPosSettings = async () => (await api.get("/pos-settings")).data;
export const updatePosSettings = async (settings: Record<string, any>) =>
  (await api.put("/pos-settings", { settings })).data;
