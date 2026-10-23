import api from "../apiClient";

/** One delivery of a product with its own cost, selling price and MRP. */
export interface StockBatch {
  id: number;
  stock_id: string;
  loc_code: string;
  source_type: string;
  source_no: number | null;
  purchase_cost: string | number;
  selling_price: string | number;
  mrp: string | number | null;
  qty_received: string | number;
  qty_remaining: string | number;
  // pending = new-cost purchase waiting for its price (not sold until priced)
  status: "active" | "pending" | "finished" | "inactive";
  received_date: string | null;
}

export const getStockBatches = async (stockId: string, opts?: { loc_code?: string; include_finished?: boolean }): Promise<StockBatch[]> => {
  const response = await api.get("/stock-batches", {
    params: { stock_id: stockId, loc_code: opts?.loc_code || undefined, include_finished: opts?.include_finished ? 1 : undefined },
  });
  return response.data ?? [];
};

export const updateStockBatch = async (id: number, payload: { selling_price?: number; mrp?: number | null; status?: "active" | "inactive" }) => {
  const response = await api.put(`/stock-batches/${id}`, payload);
  return response.data;
};

/** Report: batches with stock, plus products whose batches don't add up to their stock qty. */
export const getStockBatchReport = async (params?: { loc_code?: string; search?: string; only_multi?: boolean }) => {
  const response = await api.get("/stock-batches/report", {
    params: { loc_code: params?.loc_code || undefined, search: params?.search || undefined, only_multi: params?.only_multi ? 1 : undefined },
  });
  return (response.data ?? { rows: [], mismatches: [] }) as {
    rows: Array<StockBatch & { description: string }>;
    mismatches: Array<{ stock_id: string; description: string | null; loc_code: string; quantity: number; batch_qty: number }>;
  };
};

export const fixStockBatchMismatches = async (locCode?: string) =>
  (await api.post("/stock-batches/fix-mismatches", { loc_code: locCode || undefined })).data;
