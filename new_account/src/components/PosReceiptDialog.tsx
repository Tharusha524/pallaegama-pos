import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Divider, Stack } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import { useHomeCurrency } from "../hooks/useHomeCurrency";

interface ReceiptLine {
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
}

interface PosReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  transNo?: number | string;
  customerName?: string;
  lines: ReceiptLine[];
  total: number;
  businessLogoUrl?: string;
  paperSize?: string;
}

/**
 * A print-ready receipt. Uses the browser's native print dialog (works for
 * any paper size the OS printer driver supports — 80mm thermal, A5, A4) so
 * no PDF-generation library is needed. Print-specific CSS hides everything
 * except the receipt itself.
 */
export default function PosReceiptDialog({
  open, onClose, transNo, customerName, lines, total, businessLogoUrl, paperSize = "80mm Thermal",
}: PosReceiptDialogProps) {
  const { formatCurrency } = useHomeCurrency();

  const handlePrint = () => {
    window.print();
  };

  const isThermal = paperSize.includes("80mm");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle className="pos-receipt-no-print">Receipt — Invoice #{transNo}</DialogTitle>
      <DialogContent>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #pos-receipt-print-area, #pos-receipt-print-area * { visibility: visible; }
            #pos-receipt-print-area { position: absolute; top: 0; left: 0; width: 100%; }
            .pos-receipt-no-print { display: none !important; }
          }
        `}</style>
        <Box id="pos-receipt-print-area" sx={{ fontFamily: "monospace", width: isThermal ? 280 : "100%", mx: "auto", p: 1 }}>
          {businessLogoUrl && (
            <Box sx={{ textAlign: "center", mb: 1 }}>
              <img src={businessLogoUrl} alt="Business logo" style={{ maxWidth: "100%", maxHeight: 60 }} />
            </Box>
          )}
          <Typography align="center" fontWeight={800} fontSize={isThermal ? 16 : 20}>
            SALES RECEIPT
          </Typography>
          <Typography align="center" variant="caption" display="block">
            Invoice #{transNo} {customerName ? `· ${customerName}` : ""}
          </Typography>
          <Typography align="center" variant="caption" display="block" sx={{ mb: 1 }}>
            {new Date().toLocaleString()}
          </Typography>
          <Divider sx={{ borderStyle: "dashed" }} />
          <Stack spacing={0.5} sx={{ my: 1 }}>
            {lines.map((l, i) => {
              const lineTotal = l.quantity * l.unit_price * (1 - l.discount_percent / 100);
              return (
                <Box key={i} sx={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{l.description} x{l.quantity}</span>
                  <span>{formatCurrency(lineTotal)}</span>
                </Box>
              );
            })}
          </Stack>
          <Divider sx={{ borderStyle: "dashed" }} />
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
            <Typography fontWeight={800}>TOTAL</Typography>
            <Typography fontWeight={800}>{formatCurrency(total)}</Typography>
          </Box>
          <Typography align="center" variant="caption" display="block" sx={{ mt: 2 }}>
            Thank you for your business!
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions className="pos-receipt-no-print">
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>Print Receipt</Button>
      </DialogActions>
    </Dialog>
  );
}
