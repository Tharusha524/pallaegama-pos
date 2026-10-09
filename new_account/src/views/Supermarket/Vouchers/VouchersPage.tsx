import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Typography, Autocomplete, Chip,
  IconButton, Tooltip, Card, CardContent, Grid, FormControl, InputLabel, Select, MenuItem,
  Divider, Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PrintIcon from "@mui/icons-material/Print";
import InfoIcon from "@mui/icons-material/Info";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import LayersIcon from "@mui/icons-material/Layers";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import {
  getVouchers, createVoucher, bulkGenerateVouchers, activateVoucher,
  cancelVoucher, getVoucherSummary, getVoucherBatches,
} from "../../../api/Pos/posOpsApi";
import { getCustomers } from "../../../api/Customer/AddCustomerApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";
import VoucherPrintDialog from "../../../components/VoucherPrintDialog";
import { notify } from "../../../services/notificationService";
import JsBarcode from "jsbarcode";

const DENOMINATIONS = [1000, 2500, 5000, 10000];

const STATUS_COLORS: Record<string, any> = {
  inactive: "default",
  active: "success",
  partially_used: "warning",
  fully_used: "default",
  expired: "error",
  cancelled: "error",
};

export default function VouchersPage() {
  const { formatCurrency } = useHomeCurrency();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");

  // Dialogs
  const [issueOpen, setIssueOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [detailVoucher, setDetailVoucher] = useState<any>(null);
  const [printVoucher, setPrintVoucher] = useState<any>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchPrint, setBatchPrint] = useState<any>(null);
  const [activateVoucher_, setActivateVoucher_] = useState<any>(null);

  // Issue form
  const [customer, setCustomer] = useState<any>(null);
  const [faceValue, setFaceValue] = useState("1000");
  const [expiryDate, setExpiryDate] = useState("");
  const [note, setNote] = useState("");

  // Bulk form
  const [bulkCount, setBulkCount] = useState("10");
  const [bulkValue, setBulkValue] = useState("1000");
  const [bulkExpiry, setBulkExpiry] = useState("");
  const [bulkNote, setBulkNote] = useState("");

  const params = { search: search || undefined, status: statusFilter || undefined, batch_id: batchFilter || undefined };
  const { data: vouchers, isLoading } = useQuery({ queryKey: ["vouchers", params], queryFn: () => getVouchers(params) });
  const { data: summary } = useQuery({ queryKey: ["vouchers-summary"], queryFn: getVoucherSummary });
  const { data: batches } = useQuery({ queryKey: ["voucher-batches"], queryFn: getVoucherBatches });
  const { data: customers } = useQuery({ queryKey: ["customers-all"], queryFn: getCustomers });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["vouchers"] });
    queryClient.invalidateQueries({ queryKey: ["vouchers-summary"] });
    queryClient.invalidateQueries({ queryKey: ["voucher-batches"] });
  };

  const createMutation = useMutation({
    mutationFn: createVoucher,
    onSuccess: (data: any) => {
      invalidate();
      setIssueOpen(false);
      setCustomer(null); setFaceValue("1000"); setExpiryDate(""); setNote("");
      setPrintVoucher(data?.voucher ?? data);
    },
    onError: (e: any) => notify.error(e?.response?.data?.message || "Failed to issue voucher"),
  });

  const bulkMutation = useMutation({
    mutationFn: bulkGenerateVouchers,
    onSuccess: (data: any) => {
      invalidate();
      setBulkOpen(false);
      setBulkCount("10"); setBulkValue("1000"); setBulkExpiry(""); setBulkNote("");
      notify.success(`Generated ${data.generated} gift cards — Batch ${data.batch.batch_code}`);
    },
    onError: (e: any) => notify.error(e?.response?.data?.message || "Bulk generation failed"),
  });

  const activateMutation = useMutation({
    mutationFn: ({ code, debtor_no }: { code: string; debtor_no?: number }) => activateVoucher(code, { debtor_no }),
    onSuccess: () => { invalidate(); setActivateVoucher_(null); notify.success("Gift card activated"); },
    onError: (e: any) => notify.error(e?.response?.data?.message || "Activation failed"),
  });

  const cancelMutation = useMutation({
    mutationFn: (code: string) => cancelVoucher(code),
    onSuccess: () => { invalidate(); notify.success("Voucher cancelled"); },
    onError: (e: any) => notify.error(e?.response?.data?.message || "Cancel failed"),
  });

  const bulkTotal = Number(bulkCount) * Number(bulkValue);

  return (
    <FormPageLayout>
      {/* Header */}
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Box>
          <PageTitle title="Vouchers & Gift Cards" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Vouchers" }]} />
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<LayersIcon />} onClick={() => setBatchOpen(true)}>Batches</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setBulkOpen(true)}>+ Bulk Issue</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIssueOpen(true)}>Issue Voucher</Button>
        </Stack>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: "Total Cards", value: summary?.total_cards ?? "—" },
          { label: "Active Balance", value: summary ? formatCurrency(summary.active_balance) : "—" },
          { label: "Redeemed Value", value: summary ? formatCurrency(summary.redeemed_value) : "—" },
          { label: "Expiring Soon (30d)", value: summary?.expiring_soon ?? "—" },
        ].map((s) => (
          <Grid item xs={6} sm={3} key={s.label}>
            <Card elevation={1} sx={{ borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                <Typography variant="h6" fontWeight={700}>{s.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
        <TextField size="small" placeholder="Search code, customer, phone..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ flex: 2 }} />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {["inactive", "active", "partially_used", "fully_used", "expired", "cancelled"].map((s) => (
              <MenuItem key={s} value={s}>{s.replace(/_/g, " ")}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Batch</InputLabel>
          <Select value={batchFilter} label="Batch" onChange={(e) => setBatchFilter(e.target.value)}>
            <MenuItem value="">All Batches</MenuItem>
            {(batches ?? []).map((b: any) => (
              <MenuItem key={b.id} value={b.id}>{b.batch_code}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/* Table */}
      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Batch</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell align="right">Face Value</TableCell>
                <TableCell align="right">Balance</TableCell>
                <TableCell>Issued</TableCell>
                <TableCell>Expiry</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(vouchers ?? []).map((v: any) => (
                <TableRow key={v.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{v.voucher_code}</TableCell>
                  <TableCell>{v.batch?.batch_code ?? "—"}</TableCell>
                  <TableCell>{v.debtor?.name ?? "—"}</TableCell>
                  <TableCell align="right">{formatCurrency(v.face_value)}</TableCell>
                  <TableCell align="right">{formatCurrency(v.balance)}</TableCell>
                  <TableCell>{String(v.issue_date).slice(0, 10)}</TableCell>
                  <TableCell>{v.expiry_date ? String(v.expiry_date).slice(0, 10) : "—"}</TableCell>
                  <TableCell align="center">
                    <Chip label={v.status.replace(/_/g, " ")} size="small" color={STATUS_COLORS[v.status] ?? "default"} />
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" justifyContent="center" spacing={0.5}>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => setDetailVoucher(v)}><InfoIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Print">
                        <IconButton size="small" onClick={() => setPrintVoucher(v)}><PrintIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      {v.status === "inactive" && (
                        <Tooltip title="Activate (customer paid)">
                          <IconButton size="small" color="success" onClick={() => setActivateVoucher_(v)}><CheckCircleIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                      {!["fully_used", "cancelled", "expired"].includes(v.status) && (
                        <Tooltip title="Cancel">
                          <IconButton size="small" color="error" onClick={() => {
                            if (confirm(`Cancel voucher ${v.voucher_code}?`)) cancelMutation.mutate(v.voucher_code);
                          }}><CancelIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {(!vouchers || vouchers.length === 0) && (
                <TableRow><TableCell colSpan={9} align="center"><Typography variant="body2">No vouchers found.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Issue Single Voucher */}
      <Dialog open={issueOpen} onClose={() => setIssueOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Issue Voucher</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={customers ?? []}
              getOptionLabel={(c: any) => c.name ?? ""}
              value={customer}
              onChange={(_, val) => setCustomer(val)}
              renderInput={(params) => <TextField {...params} label="Customer (optional)" />}
            />
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {DENOMINATIONS.map((d) => (
                <Chip key={d} label={formatCurrency(d)} clickable color={Number(faceValue) === d ? "primary" : "default"} onClick={() => setFaceValue(String(d))} />
              ))}
            </Stack>
            <TextField label="Face Value (LKR)" type="number" fullWidth value={faceValue} onChange={(e) => setFaceValue(e.target.value)} />
            <TextField label="Expiry Date (optional)" type="date" fullWidth value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="Note" fullWidth value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Christmas gift" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={createMutation.isPending || Number(faceValue) <= 0}
            onClick={() => createMutation.mutate({ debtor_no: customer?.debtor_no, face_value: Number(faceValue), expiry_date: expiryDate || undefined, note })}>
            {createMutation.isPending ? "Issuing..." : "Issue Voucher"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Generate */}
      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bulk Issue Gift Cards</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">Bulk-generated cards start as <b>INACTIVE</b>. Activate each card when the customer pays for it.</Alert>
            <Stack direction="row" spacing={2}>
              <TextField label="Number of Cards" type="number" fullWidth value={bulkCount} onChange={(e) => setBulkCount(e.target.value)} inputProps={{ min: 1, max: 1000 }} />
              <TextField label="Face Value Each (LKR)" type="number" fullWidth value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} />
            </Stack>
            <TextField label="Expiry Date (optional)" type="date" fullWidth value={bulkExpiry} onChange={(e) => setBulkExpiry(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="Note" fullWidth value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder="e.g. Christmas 2026 Gift Cards" />
            <Divider />
            <Box sx={{ bgcolor: "action.hover", p: 2, borderRadius: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">{bulkCount || 0} cards × {formatCurrency(Number(bulkValue) || 0)}</Typography>
              <Typography variant="h5" fontWeight={700} color="primary.main">= {formatCurrency(bulkTotal)}</Typography>
              <Typography variant="caption" color="text.secondary">Total Face Value (not revenue until cards are activated)</Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={bulkMutation.isPending || Number(bulkCount) < 1 || Number(bulkValue) < 1}
            onClick={() => bulkMutation.mutate({ card_count: Number(bulkCount), face_value: Number(bulkValue), expiry_date: bulkExpiry || undefined, note: bulkNote || undefined })}>
            {bulkMutation.isPending ? "Generating..." : `Generate ${bulkCount} Cards`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Activate Dialog */}
      <Dialog open={!!activateVoucher_} onClose={() => setActivateVoucher_(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Activate Gift Card</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">Code: <b>{activateVoucher_?.voucher_code}</b></Typography>
            <Typography variant="body2">Value: <b>{formatCurrency(activateVoucher_?.face_value)}</b></Typography>
            <Typography variant="body2" color="text.secondary">Activate this card after the customer has paid for it.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActivateVoucher_(null)}>Cancel</Button>
          <Button variant="contained" color="success" disabled={activateMutation.isPending}
            onClick={() => activateMutation.mutate({ code: activateVoucher_.voucher_code })}>
            {activateMutation.isPending ? "Activating..." : "Confirm Activation"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail / Transaction History Dialog */}
      <Dialog open={!!detailVoucher} onClose={() => setDetailVoucher(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Voucher Details — {detailVoucher?.voucher_code}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Customer</Typography>
              <Typography variant="body2">{detailVoucher?.debtor?.name ?? "—"}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Original Value</Typography>
              <Typography variant="body2">{formatCurrency(detailVoucher?.face_value)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Current Balance</Typography>
              <Typography variant="body2" fontWeight={700}>{formatCurrency(detailVoucher?.balance)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Status</Typography>
              <Chip size="small" label={(detailVoucher?.status ?? "").replace(/_/g, " ")} color={STATUS_COLORS[detailVoucher?.status] ?? "default"} />
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Issued</Typography>
              <Typography variant="body2">{String(detailVoucher?.issue_date ?? "").slice(0, 10)}</Typography>
            </Stack>
            {detailVoucher?.expiry_date && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Expiry</Typography>
                <Typography variant="body2">{String(detailVoucher.expiry_date).slice(0, 10)}</Typography>
              </Stack>
            )}
            {detailVoucher?.activated_at && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Activated</Typography>
                <Typography variant="body2">{String(detailVoucher.activated_at).slice(0, 10)} by {detailVoucher.activated_by}</Typography>
              </Stack>
            )}
            {detailVoucher?.created_by && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Created By</Typography>
                <Typography variant="body2">{detailVoucher.created_by}</Typography>
              </Stack>
            )}
            {detailVoucher?.note && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Note</Typography>
                <Typography variant="body2">{detailVoucher.note}</Typography>
              </Stack>
            )}
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2">Transaction History</Typography>
            {(detailVoucher?.redemptions ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">No redemptions yet.</Typography>
            ) : (
              <TableContainer component={Paper} elevation={0}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell><TableCell>Cashier</TableCell><TableCell align="right">Amount Used</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(detailVoucher?.redemptions ?? []).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.redeemed_at}</TableCell>
                        <TableCell>{r.cashier ?? "—"}</TableCell>
                        <TableCell align="right" sx={{ color: "error.main" }}>- {formatCurrency(r.amount_used)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintVoucher(detailVoucher)}>Print</Button>
          <Button onClick={() => setDetailVoucher(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Batch List Dialog */}
      <Dialog open={batchOpen} onClose={() => setBatchOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Gift Card Batches</DialogTitle>
        <DialogContent>
          <TableContainer component={Paper} elevation={0}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                <TableRow>
                  <TableCell>Batch Code</TableCell>
                  <TableCell align="right">Cards</TableCell>
                  <TableCell align="right">Value Each</TableCell>
                  <TableCell align="right">Total Value</TableCell>
                  <TableCell>Expiry</TableCell>
                  <TableCell>Inactive</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell>Used</TableCell>
                  <TableCell>Note</TableCell>
                  <TableCell>Print</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(batches ?? []).map((b: any) => (
                  <TableRow key={b.id} hover>
                    <TableCell sx={{ fontWeight: 700, cursor: "pointer" }} onClick={() => { setBatchFilter(String(b.id)); setBatchOpen(false); }}>{b.batch_code}</TableCell>
                    <TableCell align="right">{b.card_count}</TableCell>
                    <TableCell align="right">{formatCurrency(b.face_value_each)}</TableCell>
                    <TableCell align="right">{formatCurrency(b.total_face_value)}</TableCell>
                    <TableCell>{b.expiry_date ? String(b.expiry_date).slice(0, 10) : "—"}</TableCell>
                    <TableCell>{b.stats?.inactive ?? 0}</TableCell>
                    <TableCell>{(b.stats?.active ?? 0) + (b.stats?.partially_used ?? 0)}</TableCell>
                    <TableCell>{b.stats?.fully_used ?? 0}</TableCell>
                    <TableCell>{b.note ?? "—"}</TableCell>
                    <TableCell>
                      <Button size="small" startIcon={<PrintIcon />} onClick={() => { setBatchPrint(b); setBatchOpen(false); }}>
                        Print All
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!batches || batches.length === 0) && (
                  <TableRow><TableCell colSpan={10} align="center"><Typography variant="body2">No batches yet.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <VoucherPrintDialog open={!!printVoucher} onClose={() => setPrintVoucher(null)} voucher={printVoucher} />

      {/* Batch Print Dialog */}
      {batchPrint && (
        <BatchPrintDialog
          open={!!batchPrint}
          onClose={() => setBatchPrint(null)}
          batch={batchPrint}
          vouchers={(vouchers ?? []).filter((v: any) => v.batch?.batch_code === batchPrint.batch_code)}
          formatCurrency={formatCurrency}
        />
      )}
    </FormPageLayout>
  );
}

// ── Batch Print Dialog ────────────────────────────────────────────────────────

function BatchPrintDialog({ open, onClose, batch, vouchers, formatCurrency }: {
  open: boolean; onClose: () => void; batch: any; vouchers: any[];
  formatCurrency: (v: number) => string;
}) {
  const handlePrint = () => window.print();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle className="batch-print-no-print">Print Batch — {batch.batch_code} ({vouchers.length} cards)</DialogTitle>
      <DialogContent sx={{ bgcolor: "action.hover" }}>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #batch-print-area, #batch-print-area * { visibility: visible; }
            #batch-print-area { position: absolute; top: 0; left: 0; width: 100%; }
            .batch-print-no-print { display: none !important; }
          }
        `}</style>

        {vouchers.length === 0 && (
          <Alert severity="warning" className="batch-print-no-print">No vouchers loaded. Clear the status filter on the main page first.</Alert>
        )}

        <Box id="batch-print-area" sx={{ display: "flex", flexWrap: "wrap", gap: 2, p: 1 }}>
          {vouchers.map((v: any) => (
            <GoldCard key={v.id} voucher={v} batch={batch} formatCurrency={formatCurrency} />
          ))}
        </Box>
      </DialogContent>
      <DialogActions className="batch-print-no-print">
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} disabled={vouchers.length === 0}>
          Print {vouchers.length} Cards
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function GoldCard({ voucher, batch, formatCurrency }: { voucher: any; batch: any; formatCurrency: (v: number) => string }) {
  const barcodeRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, voucher.voucher_code, { format: "CODE128", displayValue: false, height: 30, width: 1.4, margin: 4 });
      if (barcodeRef.current) barcodeRef.current.src = canvas.toDataURL("image/png");
    } catch {}
  }, [voucher.voucher_code]);

  return (
    <Box sx={{
      position: "relative", width: 300, borderRadius: 2, overflow: "hidden",
      background: "linear-gradient(135deg, #7a5a19 0%, #d4af5a 28%, #f3dfa0 50%, #c99a3e 72%, #7a5a19 100%)",
      boxShadow: "0 8px 24px -6px rgba(0,0,0,0.4)", color: "#3a2a08", flexShrink: 0,
    }}>
      {/* Guilloche overlay */}
      <Box sx={{
        position: "absolute", inset: 0, opacity: 0.14, mixBlendMode: "multiply",
        backgroundImage:
          "radial-gradient(circle at 20% 30%, transparent 0 14px, #5c4212 15px, transparent 16px)," +
          "radial-gradient(circle at 70% 70%, transparent 0 18px, #5c4212 19px, transparent 20px)",
        backgroundSize: "70px 70px, 100px 100px",
      }} />
      {/* Ribbon */}
      <Box sx={{ position: "absolute", top: 0, bottom: 0, left: 18, width: 18, background: "linear-gradient(90deg, #7a0e14, #b21c22 45%, #7a0e14)" }} />
      <Box sx={{
        position: "absolute", top: "50%", left: 27, transform: "translate(-50%, -50%)",
        width: 36, height: 36, borderRadius: "50%",
        background: "radial-gradient(circle, #d4af5a 0%, #b21c22 55%, #7a0e14 100%)",
        border: "2px solid #f3dfa0", boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
      }} />

      {/* Content */}
      <Box sx={{ pl: "52px", pr: 1.5, pt: 1.5, pb: 1, position: "relative" }}>
        <Typography sx={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>GIFT VOUCHER</Typography>
        <Typography sx={{ fontFamily: "Georgia, serif", fontWeight: 800, fontSize: 28, lineHeight: 1.1, mt: 0.5 }}>
          {formatCurrency(voucher.face_value)}
        </Typography>
        <Typography fontSize={9} sx={{ opacity: 0.8, mt: 0.25 }}>{batch.batch_code}</Typography>

        {/* Barcode panel */}
        <Box sx={{ bgcolor: "rgba(255,252,240,0.93)", borderRadius: 1, px: 1, py: 0.75, mt: 1, boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }}>
          <Box sx={{ textAlign: "center" }}>
            <img ref={barcodeRef} alt="barcode" style={{ maxWidth: "100%", height: 30 }} />
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.25 }}>
            <Typography sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: 9 }}>{voucher.voucher_code}</Typography>
            {voucher.expiry_date && <Typography fontSize={8} color="text.secondary">Exp: {String(voucher.expiry_date).slice(0, 10)}</Typography>}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
