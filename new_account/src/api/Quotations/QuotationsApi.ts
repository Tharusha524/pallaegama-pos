import api from "../apiClient";

const API_URL = "/quotations";

export interface QuotationLinePayload {
  stk_code: string;
  trans_type: number; // always 32 — Sales Quotation
  description?: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
}

export interface QuotationPayload {
  quotation_number: string;
  trans_type: number; // 32 — real FA sales_orders quotation, not the legacy standalone quotations table
  debtor_no: number;
  branch_code?: string;
  reference?: string;
  quotation_date: string; // "YYYY-MM-DD HH:mm:ss"
  order_type: number; // sales type / price list id
  ship_via?: string; // backend validates this as a string, not a number
  from_stk_loc: string;
  details: QuotationLinePayload[];
}

export const createQuotation = async (payload: QuotationPayload) => {
  const response = await api.post(API_URL, payload);
  return response.data;
};

// Fetched as a blob (not a plain window.open) because the API requires a
// Bearer auth header, which a direct browser navigation can't attach.
export const printQuotationPdf = async (orderNo: number | string) => {
  const response = await api.get(`/quotations-fa/${orderNo}/print-pdf`, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(response.data);
  window.open(blobUrl, "_blank");
};
