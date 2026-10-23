import api from "../apiClient";

/** One posted goods receipt (GRN) — from Purchase or Direct Supplier Invoice. */
export interface PurchaseHistoryRow {
  id: number;
  reference: string | null;
  delivery_date: string;
  loc_code: string;
  purch_order_no: number | null;
  supplier_id: number | null;
  supp_name: string | null;
  location_name: string | null;
  item_count: number;
  total_qty: number;
  total: number;
}

export interface PurchaseHistoryItem {
  item_code: string;
  description: string;
  qty_recd: number;
  unit_price: number | null;
  discount_percent: number | null;
  line_total: number;
  selling_price: number | null;
  mrp: number | null;
  price_pending?: boolean;
}

export const getPurchaseHistory = async (params: { from_date?: string; to_date?: string; supplier_id?: number; search?: string }) =>
  (await api.get("/purchase-history", { params })).data as PurchaseHistoryRow[];

export const getPurchaseHistoryDetail = async (id: number) =>
  (await api.get(`/purchase-history/${id}`)).data as { grn: any; items: PurchaseHistoryItem[] };
