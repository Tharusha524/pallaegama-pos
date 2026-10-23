import api from "../apiClient";

const BASE = "/purchases";

export interface GrnReceiveLine {
  po_detail_item: number;
  quantity: number;
  // Optional new selling price / MRP — the delivery becomes its own stock batch.
  selling_price?: number;
  mrp_price?: number;
}

export const postGrnReceive = async (payload: {
  order_no: number;
  reference?: string;
  delivery_date: string;
  loc_code?: string;
  comments?: string;
  lines: GrnReceiveLine[];
}) => {
  const response = await api.post(`${BASE}/grn/receive`, payload);
  return response.data;
};

export const postDirectGrn = async (payload: {
  supplier_id: number;
  reference?: string;
  delivery_date: string;
  into_stock_location: string;
  delivery_address?: string;
  tax_included?: boolean;
  comments?: string;
  total?: number;
  cost_center_id?: number;
  lines: Array<{
    item_code: string;
    description?: string;
    quantity: number;
    unit_price: number;
    delivery_date?: string;
    selling_price?: number;
    mrp_price?: number;
  }>;
}) => {
  const response = await api.post(`${BASE}/grn/direct`, payload);
  return response.data;
};

export const postSupplierInvoiceFromGrn = async (payload: {
  supplier_id: number;
  reference?: string;
  supp_reference?: string;
  trans_date: string;
  due_date?: string;
  tax_included?: boolean;
  comments?: string;
  cost_center_id?: number;
  lines: Array<{ grn_item_id: number; quantity: number }>;
  gl_lines?: Array<{ gl_code: string; amount: number; memo?: string; cost_center_id?: number }>;
}) => {
  const response = await api.post(`${BASE}/invoice/from-grn`, payload);
  return response.data;
};

export const postDirectSupplierInvoice = async (payload: {
  supplier_id: number;
  reference?: string;
  supp_reference?: string;
  trans_date: string;
  due_date?: string;
  into_stock_location: string;
  delivery_address?: string;
  tax_included?: boolean;
  fixed_asset?: boolean;
  comments?: string;
  cost_center_id?: number;
  lines: Array<{
    item_code: string;
    description?: string;
    quantity: number;
    unit_price: number;
    selling_price?: number;
    mrp_price?: number;
  }>;
}) => {
  const response = await api.post(`${BASE}/invoice/direct`, payload);
  return response.data;
};

export const getSupplierPaymentAllocatable = async (supplierId: number) => {
  const response = await api.get(`${BASE}/payments/allocatable`, {
    params: { supplier_id: supplierId },
  });
  return response.data;
};

export const postSupplierPayment = async (payload: {
  supplier_id: number;
  tran_date: string;
  bank_account_id: number;
  amount: number;
  discount?: number;
  bank_charge?: number;
  reference?: string;
  comments?: string;
  tax_included?: boolean;
  cost_center_id?: number;
  allocations?: Array<{ trans_no_to: number; trans_type_to: number; amt: number }>;
}) => {
  const response = await api.post(`${BASE}/payments`, payload);
  return response.data;
};

export const postSupplierCreditNote = async (payload: {
  supplier_id: number;
  trans_date: string;
  due_date?: string;
  reference?: string;
  supp_reference?: string;
  tax_included?: boolean;
  comments?: string;
  source_invoice_trans_no?: number;
  cost_center_id?: number;
  allocations?: Array<{ trans_no_to: number; trans_type_to: number; amt: number }>;
  lines?: Array<{
    stock_id: string;
    quantity: number;
    unit_price: number;
    grn_item_id?: number;
    po_detail_item_id?: number;
    description?: string;
  }>;
  gl_lines?: Array<{ gl_code: string; amount: number; memo?: string; cost_center_id?: number }>;
}) => {
  const response = await api.post(`${BASE}/credit-notes`, payload);
  return response.data;
};

export const getPurchaseOrdersInquiry = async (params?: Record<string, unknown>) => {
  const response = await api.get(`${BASE}/inquiries/orders`, { params });
  return response.data;
};

export const getSupplierTransactionsInquiry = async (params?: Record<string, unknown>) => {
  const response = await api.get(`${BASE}/inquiries/supplier-transactions`, { params });
  return response.data;
};

export const getSupplierAllocationsInquiry = async (params?: Record<string, unknown>) => {
  const response = await api.get(`${BASE}/inquiries/supplier-allocations`, { params });
  return response.data;
};

export const getOpenGrnItems = async (params?: Record<string, unknown>) => {
  const response = await api.get(`${BASE}/inquiries/open-grn-items`, { params });
  return response.data;
};

export const voidSupplierInvoice = async (transNo: number, memo?: string) => {
  const response = await api.post(`${BASE}/invoice/${transNo}/void`, { memo });
  return response.data;
};

export const voidSupplierPayment = async (transNo: number, memo?: string) => {
  const response = await api.post(`${BASE}/payments/${transNo}/void`, { memo });
  return response.data;
};

export const voidSupplierCreditNote = async (transNo: number, memo?: string) => {
  const response = await api.post(`${BASE}/credit-notes/${transNo}/void`, { memo });
  return response.data;
};

export const voidGrnBatch = async (batchId: number, memo?: string) => {
  const response = await api.post(`${BASE}/grn/${batchId}/void`, { memo });
  return response.data;
};

export const updateSupplierInvoice = async (transNo: number, payload: Record<string, unknown>) => {
  const response = await api.put(`${BASE}/invoice/${transNo}`, payload);
  return response.data;
};

export const updateSupplierPayment = async (transNo: number, payload: Record<string, unknown>) => {
  const response = await api.put(`${BASE}/payments/${transNo}`, payload);
  return response.data;
};

export const updateSupplierCreditNote = async (transNo: number, payload: Record<string, unknown>) => {
  const response = await api.put(`${BASE}/credit-notes/${transNo}`, payload);
  return response.data;
};
