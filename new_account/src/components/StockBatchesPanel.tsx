import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Stack, Typography, Table, TableHead, TableRow, TableCell, TableBody, TextField, Button, Chip, FormControlLabel, Switch,
} from "@mui/material";
import { getStockBatches, updateStockBatch, type StockBatch } from "../api/Inventory/StockBatchesApi";
import { notify } from "../services/notificationService";

const SOURCE_LABEL: Record<string, string> = {
  opening: "Opening stock",
  grn: "GRN",
  transfer: "Transfer",
  adjustment: "Adjustment",
  audit: "Audit",
  return: "Return",
};

const num = (v: unknown) => Number(v ?? 0) || 0;

/**
 * Batches of one product: each delivery with its own price / MRP. Editing a
 * batch here changes only what the till charges for those packets — purchase
 * cost and accounting are not affected. "Hide" stops the till offering it.
 */
export default function StockBatchesPanel({ stockId, formatCurrency }: { stockId: string; formatCurrency: (v: number) => string }) {
  const queryClient = useQueryClient();
  const [showFinished, setShowFinished] = useState(false);
  const [edits, setEdits] = useState<Record<number, { selling_price: string; mrp: string }>>({});

  const { data: batches = [], isFetching } = useQuery({
    queryKey: ["stock-batches", stockId, showFinished],
    queryFn: () => getStockBatches(stockId, { include_finished: showFinished }),
    enabled: !!stockId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-batches", stockId] });
    queryClient.invalidateQueries({ queryKey: ["pos-multi-price"] });
    queryClient.invalidateQueries({ queryKey: ["pos-pending-price"] });
    // pricing the newest batch also updates the product's current price
    queryClient.invalidateQueries({ queryKey: ["sales-pricing"] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ b, status }: { b: StockBatch; status?: "active" | "inactive" }) => {
      const e = edits[b.id];
      return updateStockBatch(b.id, {
        ...(e && e.selling_price !== "" ? { selling_price: Number(e.selling_price) } : {}),
        ...(e ? { mrp: e.mrp === "" ? null : Number(e.mrp) } : {}),
        ...(status ? { status } : {}),
      });
    },
    onSuccess: (_, { b }) => {
      notify.success("Batch updated");
      setEdits((prev) => { const n = { ...prev }; delete n[b.id]; return n; });
      refresh();
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to update batch"),
  });

  // A new-cost delivery waits with no price — its boxes start empty.
  const field = (b: StockBatch, key: "selling_price" | "mrp") =>
    edits[b.id]?.[key] ?? (b[key] == null || b.status === "pending" ? "" : String(num(b[key])));

  const setField = (b: StockBatch, key: "selling_price" | "mrp", value: string) =>
    setEdits((prev) => ({
      ...prev,
      [b.id]: { selling_price: field(b, "selling_price"), mrp: field(b, "mrp"), ...prev[b.id], [key]: value },
    }));

  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" color="text.secondary">
        Each purchase cost is kept as its own batch. A purchase at a new cost waits as "Needs price" — the till does not
        sell it until you type its Selling Price (and MRP) here and click Save. When packets with different MRPs are in
        stock, the till asks the cashier to pick by the MRP on the packet. A sold-out batch disappears automatically.
        Changing a price here does not change purchase cost or accounts.
      </Typography>
      <FormControlLabel
        control={<Switch size="small" checked={showFinished} onChange={(e) => setShowFinished(e.target.checked)} />}
        label="Show sold-out batches"
      />
      {batches.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {isFetching ? "Loading…" : "No batches yet — they are created when stock is received or sold."}
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Received</TableCell>
              <TableCell>From</TableCell>
              <TableCell>Location</TableCell>
              <TableCell align="right">Cost</TableCell>
              <TableCell align="right">Selling Price</TableCell>
              <TableCell align="right">MRP</TableCell>
              <TableCell align="right">In Stock</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {batches.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.received_date ?? "—"}</TableCell>
                <TableCell>{SOURCE_LABEL[b.source_type] ?? b.source_type}{b.source_no ? ` #${b.source_no}` : ""}</TableCell>
                <TableCell>{b.loc_code}</TableCell>
                <TableCell align="right">{formatCurrency(num(b.purchase_cost))}</TableCell>
                <TableCell align="right">
                  <TextField type="number" size="small" sx={{ width: 110 }} value={field(b, "selling_price")}
                    onChange={(e) => setField(b, "selling_price", e.target.value)} inputProps={{ min: 0, step: "0.01" }} />
                </TableCell>
                <TableCell align="right">
                  <TextField type="number" size="small" sx={{ width: 110 }} value={field(b, "mrp")}
                    onChange={(e) => setField(b, "mrp", e.target.value)} inputProps={{ min: 0, step: "0.01" }} />
                </TableCell>
                <TableCell align="right">{num(b.qty_remaining)}</TableCell>
                <TableCell>
                  <Chip size="small"
                    label={b.status === "active" ? "Selling" : b.status === "pending" ? "Needs price" : b.status === "finished" ? "Sold out" : "Hidden"}
                    color={b.status === "active" ? "success" : b.status === "pending" ? "warning" : "default"} />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="contained" disabled={!edits[b.id] || saveMutation.isPending}
                      onClick={() => saveMutation.mutate({ b })}>
                      Save
                    </Button>
                    {b.status !== "finished" && (
                      <Button size="small" variant="outlined" disabled={saveMutation.isPending}
                        onClick={() => saveMutation.mutate({ b, status: b.status === "inactive" ? "active" : "inactive" })}>
                        {b.status === "inactive" ? "Show" : "Hide"}
                      </Button>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}
