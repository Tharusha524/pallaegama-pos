import { useQuery } from "@tanstack/react-query";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { getStockBatches } from "../api/Inventory/StockBatchesApi";

/**
 * Optional "which packets?" picker for stock changes. Shown only when the
 * product has packets with 2+ different MRPs at that location; otherwise it
 * renders nothing and the change goes oldest-first automatically.
 */
export default function BatchSelect({
  stockId,
  locCode,
  value,
  onChange,
  label = "Which packets (MRP)",
}: {
  stockId?: string | null;
  locCode?: string | null;
  value: number | "";
  onChange: (batchId: number | "") => void;
  label?: string;
}) {
  const { data: batches = [] } = useQuery({
    queryKey: ["stock-batches", stockId, false, locCode],
    queryFn: () => getStockBatches(String(stockId), { loc_code: locCode || undefined }),
    enabled: !!stockId && !!locCode,
  });

  const active = batches.filter((b) => b.status === "active" && Number(b.qty_remaining) > 0);
  const mrps = new Set(active.map((b) => (b.mrp == null ? "none" : Number(b.mrp).toFixed(2))));
  if (mrps.size < 2) return null;

  return (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select value={value} label={label} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}>
        <MenuItem value="">Oldest first (automatic)</MenuItem>
        {active.map((b) => (
          <MenuItem key={b.id} value={b.id}>
            MRP {b.mrp != null ? Number(b.mrp).toFixed(2) : "—"} · Price {Number(b.selling_price).toFixed(2)} · In stock {Number(b.qty_remaining)}
            {b.received_date ? ` · ${b.received_date}` : ""}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
