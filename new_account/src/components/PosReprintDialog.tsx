import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, Table, TableHead,
  TableRow, TableCell, TableBody, TableContainer, Paper, Typography, InputAdornment, LinearProgress,
} from "@mui/material";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import SearchIcon from "@mui/icons-material/Search";
import { getPosReceipts, getPosReceipt } from "../api/Pos/posOpsApi";
import { useHomeCurrency } from "../hooks/useHomeCurrency";
import { notify } from "../services/notificationService";

export interface ReprintReceipt {
  trans_no: number;
  created_at: string;
  customer_name: string | null;
  total: number;
  lines: { stock_id: string; description: string; quantity: number; unit_price: number; discount_percent: number; mrp_price: number | null }[];
  payments: { method: string; amount: number }[];
  shift_id: number | null;
  /** Exact copy saved when the receipt was first printed (bills made after this feature). */
  copy: {
    printedAt: string;
    cashierName: string | null;
    customerName: string | null;
    lines: { stock_id: string; description: string; quantity: number; unit_price: number; discount_percent: number; mrp_price: number | null }[];
    total: number;
    payments: { method: string; amount: number }[];
    cashReceived: number;
    couponCode: string | null;
    voucherCode: string | null;
    shiftId: number | null;
    paperSize: string | null;
    receiptSettings: Record<string, any>;
    offlineNo?: string | null;
  } | null;
}

/** Today's date (YYYY-MM-DD) in the PC's own time zone, not UTC. */
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Find an old POS bill — scan/type its number, or pick it from a date-filtered
 * list — and hand it back to be shown in the normal receipt dialog for reprint.
 */
export default function PosReprintDialog({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (receipt: ReprintReceipt) => void;
}) {
  const { formatCurrency } = useHomeCurrency();
  const [billNo, setBillNo] = useState("");
  const [fromDate, setFromDate] = useState(localToday);
  const [toDate, setToDate] = useState(localToday);
  const [search, setSearch] = useState("");
  const [loadingNo, setLoadingNo] = useState<number | null>(null);

  const { data: bills, isLoading } = useQuery({
    queryKey: ["pos-receipts", fromDate, toDate, search],
    queryFn: () => getPosReceipts({ from_date: fromDate, to_date: toDate, search: search.trim() || undefined }),
    enabled: open && !!fromDate && !!toDate,
  });

  const loadBill = async (transNo: number) => {
    if (!transNo || loadingNo) return;
    setLoadingNo(transNo);
    try {
      const receipt = await getPosReceipt(transNo);
      setBillNo("");
      onSelect(receipt);
    } catch (err: any) {
      notify.error(err?.response?.status === 404 ? `Bill #${transNo} not found` : "Could not load the bill");
    } finally {
      setLoadingNo(null);
    }
  };

  // The receipt barcode is the invoice number, so a scanner types it straight in here.
  const submitBillNo = () => {
    const transNo = Number(billNo.trim());
    if (Number.isInteger(transNo) && transNo > 0) loadBill(transNo);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Reprint Receipt</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1}>
            <TextField
              autoFocus fullWidth size="small"
              label="Bill number"
              placeholder="Scan the old receipt's barcode or type the bill number"
              value={billNo}
              onChange={(e) => setBillNo(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); submitBillNo(); } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerIcon fontSize="small" /></InputAdornment> }}
            />
            <Button variant="contained" onClick={submitBillNo} disabled={!billNo || !!loadingNo} sx={{ whiteSpace: "nowrap" }}>
              Open
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">— or pick from the list —</Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="From" type="date" size="small" value={fromDate}
              onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To" type="date" size="small" value={toDate}
              onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small" fullWidth placeholder="Search bill no, reference or customer"
              value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
          </Stack>

          {(isLoading || !!loadingNo) && <LinearProgress />}

          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: "45vh" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Bill No</TableCell>
                  <TableCell>Date &amp; Time</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {(bills ?? []).map((b: any) => (
                  <TableRow key={b.trans_no} hover sx={{ cursor: "pointer" }} onClick={() => loadBill(b.trans_no)}>
                    <TableCell>#{b.trans_no}</TableCell>
                    <TableCell>{b.created_at ?? b.tran_date}</TableCell>
                    <TableCell>{b.customer_name ?? "—"}</TableCell>
                    <TableCell align="right">{formatCurrency(Number(b.total) || 0, 2)}</TableCell>
                    <TableCell align="right">
                      <Button size="small" disabled={!!loadingNo} onClick={(e) => { e.stopPropagation(); loadBill(b.trans_no); }}>
                        {loadingNo === b.trans_no ? "Opening..." : "Reprint"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && (!bills || bills.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary">No bills for these dates.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
