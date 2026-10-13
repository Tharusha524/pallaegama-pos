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
