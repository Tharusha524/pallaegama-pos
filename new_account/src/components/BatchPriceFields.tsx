import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TableCell, TextField } from "@mui/material";
import { getSalesPricing } from "../api/SalesPricing/SalesPricingApi";
import { getItems } from "../api/Item/ItemApi";

/**
 * Optional selling price + MRP typed for a received line. Left blank (normal):
 * the same cost goes into the existing batch, a new cost becomes a new batch
 * with no price until it is set on Set Price. Accounting is not affected.
 */
export interface BatchPriceInput {
  selling_price: string;
  mrp_price: string;
}

export const emptyBatchPrice: BatchPriceInput = { selling_price: "", mrp_price: "" };

/** Payload fields for one line — omitted when blank. */
export const batchPricePayload = (v?: BatchPriceInput) => {
  const sp = v?.selling_price?.trim() ?? "";
  const mrp = v?.mrp_price?.trim() ?? "";
  return {
    ...(sp !== "" && Number(sp) > 0 ? { selling_price: Number(sp) } : {}),
    ...(mrp !== "" && Number(mrp) > 0 ? { mrp_price: Number(mrp) } : {}),
  };
};

/** Current retail (LKR) selling price per stock_id, shown as the placeholder. */
export const useRetailPriceMap = () => {
  const { data } = useQuery({ queryKey: ["sales-pricing-all-retail"], queryFn: getSalesPricing, staleTime: 60_000 });
  return useMemo(() => {
    const map = new Map<string, number>();
    for (const p of Array.isArray(data) ? data : []) {
      // eslint-disable-next-line eqeqeq
      if (p.sales_type_id == 3 && p.currency_id == 8 && Number(p.price) > 0) map.set(String(p.stock_id), Number(p.price));
    }
    return map;
  }, [data]);
};

/** Current MRP per stock_id (stock_master.mrp_price), shown as the placeholder. */
export const useMrpMap = () => {
  const { data } = useQuery({ queryKey: ["items"], queryFn: getItems, staleTime: 60_000 });
  return useMemo(() => {
    const map = new Map<string, number>();
    for (const i of Array.isArray(data) ? data : []) {
      if (i?.mrp_price != null && Number(i.mrp_price) > 0) map.set(String(i.stock_id), Number(i.mrp_price));
    }
    return map;
  }, [data]);
};

export function BatchPriceHeadCells() {
  return (
    <>
      <TableCell align="right">Selling Price</TableCell>
      <TableCell align="right">MRP</TableCell>
    </>
  );
}

export function BatchPriceCells({
  value,
  onChange,
  currentPrice,
  currentMrp,
  disabled,
}: {
  value?: BatchPriceInput;
  onChange: (v: BatchPriceInput) => void;
  currentPrice?: number | null;
  currentMrp?: number | null;
  disabled?: boolean;
}) {
  const v = value ?? emptyBatchPrice;
  const cell = (field: keyof BatchPriceInput, current?: number | null) => (
    <TableCell align="right">
      <TextField
        type="number"
        size="small"
        sx={{ width: 110 }}
        value={v[field]}
        disabled={disabled}
        placeholder="set later"
        onChange={(e) => onChange({ ...v, [field]: e.target.value })}
        inputProps={{ min: 0, step: "0.01" }}
      />
    </TableCell>
  );
  return (
    <>
      {cell("selling_price", currentPrice)}
      {cell("mrp_price", currentMrp)}
    </>
  );
}
