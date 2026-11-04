import api from "../index";

export interface AddItemRow {
  stock_id: string;
  description: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  units?: string;
  purchase_cost?: number;
  selling_price?: number;
  mrp_price?: number;
  barcode?: string;
  opening_stock?: number;
}

export const bulkCreateItems = async (rows: AddItemRow[]) => {
  const { data } = await api.post("stock-masters/bulk", { rows });
  return data;
};

/**
 * The next item code to suggest on Add Item. The server continues whatever
 * code pattern this shop already uses (plain numbers here, "ITN-001"
 * elsewhere). `after` continues from a code the grid already shows.
 * Returns null when there is no numeric code to continue from.
 */
export const getNextItemCode = async (after?: string): Promise<string | null> => {
  const { data } = await api.get("stock-masters-next-code", {
    params: after ? { after } : undefined,
  });
  return data?.next_code ?? null;
};
