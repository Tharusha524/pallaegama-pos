import { useQuery } from "@tanstack/react-query";
import { Paper, Stack, Table, TableHead, TableRow, TableCell, TableBody, Typography, Chip } from "@mui/material";
import { getStockBatches } from "../api/Inventory/StockBatchesApi";

const SOURCE_LABEL: Record<string, string> = {
  opening: "Opening stock",
  grn: "GRN",
  transfer: "Transfer",
  adjustment: "Adjustment",
  audit: "Audit",
  return: "Return",
};

/**
 * Read-only: how a product's stock splits into batches (each delivery with its
 * own MRP / price). Prices are changed on the Set Price page.
 */
export default function StockBatchQtyTable({ stockId, formatCurrency }: { stockId: string; formatCurrency: (v: number) => string }) {
  const { data: batches = [], isFetching, isError } = useQuery({
    queryKey: ["stock-batches", stockId, false],
    queryFn: () => getStockBatches(stockId),
    enabled: !!stockId,
  });

  if (isError) return null;

  const total = batches.reduce((sum, b) => sum + (Number(b.qty_remaining) || 0), 0);
  const needsPrice = batches.filter((b) => b.status === "pending").length;

  return (
    <Paper variant="outlined" sx={{ mb: 2, borderRadius: 1.5, overflow: "hidden" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle2">Stock by Batch</Typography>
        <Typography variant="caption" color="text.secondary">
          {batches.length} batch{batches.length === 1 ? "" : "es"} · total {total}
        </Typography>
        {needsPrice > 0 && (
          <Chip size="small" color="warning" label={`${needsPrice} need${needsPrice === 1 ? "s" : ""} a price — set it on Set Price`} />
        )}
      </Stack>

      {batches.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1.5 }}>
          {isFetching ? "Loading…" : "No batches yet — created when stock is received or sold."}
        </Typography>
      ) : (
        <Table size="small">
          <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
            <TableRow>
              <TableCell>From</TableCell>
              <TableCell>Received</TableCell>
              <TableCell>Location</TableCell>
              <TableCell align="right">Purchase Cost</TableCell>
              <TableCell align="right">MRP</TableCell>
              <TableCell align="right">Selling Price</TableCell>
              <TableCell align="right">In Stock</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {batches.map((b) => {
              const pending = b.status === "pending";
              return (
                <TableRow key={b.id} sx={pending ? { backgroundColor: "rgba(237, 108, 2, 0.06)" } : undefined}>
                  <TableCell>{SOURCE_LABEL[b.source_type] ?? b.source_type}{b.source_no ? ` #${b.source_no}` : ""}</TableCell>
                  <TableCell>{b.received_date ?? "—"}</TableCell>
                  <TableCell>{b.loc_code}</TableCell>
                  <TableCell align="right">{formatCurrency(Number(b.purchase_cost) || 0)}</TableCell>
                  <TableCell align="right">
                    {!pending && b.mrp != null
                      ? <Chip size="small" variant="outlined" color="primary" label={formatCurrency(Number(b.mrp))} />
                      : "—"}
                  </TableCell>
                  <TableCell align="right">{pending ? "—" : formatCurrency(Number(b.selling_price) || 0)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{Number(b.qty_remaining)}</TableCell>
                  <TableCell>
                    <Chip size="small"
                      label={b.status === "active" ? "Selling" : pending ? "Needs price" : b.status === "inactive" ? "Hidden" : "Sold out"}
                      color={b.status === "active" ? "success" : pending ? "warning" : "default"} />
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell colSpan={6} sx={{ fontWeight: 700 }}>Total in stock</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{total}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
