import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Divider, Stack } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import JsBarcode from "jsbarcode";
import { useHomeCurrency } from "../hooks/useHomeCurrency";
import { getCompanies } from "../api/CompanySetup/CompanySetupApi";
import useCurrentUser from "../hooks/useCurrentUser";
import { resolveLogoSrc } from "../utils/logoUrl";

interface ReceiptLine {
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
}

interface ReceiptPaymentLine {
  method: string;
  amount: number;
}

interface PosReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  transNo?: number | string;
  customerName?: string;
  lines: ReceiptLine[];
  total: number;
  payments?: ReceiptPaymentLine[];
  cashReceived?: number;
  paperSize?: string;
}

/**
 * A print-ready receipt matching the reference POS system's layout: logo,
 * branch/business info, invoice # + cashier, an ITEM/DISC/NET/TOTAL table,
 * subtotal, bold total, a Payment Info block, customer name, a thank-you
 * footer, and a real scannable barcode of the invoice number. Uses the
 * browser's native print dialog — no PDF-generation library needed. The
 * logo always comes live from Setup → Company Setup, never a separate
 * POS-only logo field.
 */
export default function PosReceiptDialog({
  open, onClose, transNo, customerName, lines, total, payments, cashReceived, paperSize = "80mm Thermal",
}: PosReceiptDialogProps) {
  const { formatCurrency } = useHomeCurrency();
  const { user } = useCurrentUser();
  const barcodeRef = useRef<SVGSVGElement>(null);

  const { data: companies } = useQuery({
    queryKey: ["company-setup-list"],
    queryFn: getCompanies,
    enabled: open,
  });
  const company = companies?.[0];
  const logoSrc = resolveLogoSrc(company?.company_logo_url);

  useEffect(() => {
    if (open && transNo && barcodeRef.current) {
      try {
        // A quiet zone (margin) around the bars is essential for camera-based
        // scanners to reliably locate the barcode.
        JsBarcode(barcodeRef.current, String(transNo), {
          format: "CODE128",
          displayValue: false,
          height: 45,
          width: 1.8,
          margin: 10,
        });
      } catch {
        // Invalid characters for CODE128 (rare) — leave barcode blank rather than crash the receipt.
      }
    }
  }, [open, transNo]);

  const handlePrint = () => {
    window.print();
  };

  const isThermal = paperSize.includes("80mm");
  const now = new Date();
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  const discountTotal = Math.max(0, subtotal - total);
  const paymentLines = payments && payments.length > 0 ? payments : [{ method: "CASH", amount: total }];
  const received = cashReceived ?? total;
  const change = Math.max(0, received - total);

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
        <Box
          id="pos-receipt-print-area"
          sx={{ fontFamily: "monospace", width: isThermal ? 280 : "100%", mx: "auto", p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}
        >
          {/* Header: company logo + branch details, pulled live from Company Setup */}
          <Stack alignItems="center" spacing={0.25} sx={{ mb: 1 }}>
            {logoSrc ? (
              <img src={logoSrc} alt="Company logo" style={{ maxWidth: "100%", maxHeight: 64 }} />
            ) : (
              <Typography align="center" fontWeight={800} fontSize={isThermal ? 20 : 24}>
                {company?.name || "Your Business Name"}
              </Typography>
            )}
            {company?.address && (
              <Typography align="center" variant="caption" sx={{ lineHeight: 1.2 }}>{company.address.toUpperCase()}</Typography>
            )}
            {(company?.phone_number || company?.fax_number) && (
              <Typography align="center" variant="caption">
                {[company?.phone_number, company?.fax_number].filter(Boolean).join(" · ")}
              </Typography>
            )}
            <Typography align="center" variant="caption">{now.toLocaleDateString()} {now.toLocaleTimeString()}</Typography>
          </Stack>

          <Divider sx={{ borderStyle: "dashed" }} />

          <Stack spacing={0.25} sx={{ my: 1, fontSize: 12 }}>
            <Typography variant="caption">Invoice ID: {transNo}</Typography>
            <Typography variant="caption">Cashier: {user?.first_name || user?.email || "—"}</Typography>
          </Stack>

          <Divider sx={{ borderStyle: "dashed" }} />

          {/* Line items — ITEM / DISC / NET / TOTAL, matching the reference layout */}
          <Box sx={{ my: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700 }}>
              <span>ITEM</span>
              <Box sx={{ display: "flex", gap: 2 }}>
                <span>DISC</span><span>NET</span><span>TOTAL</span>
              </Box>
            </Box>
            {lines.map((l, i) => {
              const netPrice = l.unit_price * (1 - l.discount_percent / 100);
              const lineTotal = l.quantity * netPrice;
              return (
                <Box key={i} sx={{ mt: 1 }}>
                  <Typography fontSize={13} fontWeight={700}>{l.description}</Typography>
                  <Typography fontSize={11} color="text.secondary">UNIT PRICE {l.unit_price.toFixed(2)}</Typography>
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span>{l.quantity} x</span>
                    <Box sx={{ display: "flex", gap: 2 }}>
                      <span>{l.discount_percent > 0 ? `${l.discount_percent}%` : "-"}</span>
                      <span>{netPrice.toFixed(2)}</span>
                      <span>{lineTotal.toFixed(2)}</span>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Divider sx={{ borderStyle: "dashed" }} />

          <Stack spacing={0.25} sx={{ my: 1, fontSize: 13 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </Box>
            {discountTotal > 0.001 && (
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <span>Discount</span><span>-{formatCurrency(discountTotal)}</span>
              </Box>
            )}
          </Stack>

          <Divider sx={{ borderStyle: "dashed" }} />

          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
            <Typography fontWeight={800} fontSize={18}>TOTAL</Typography>
            <Typography fontWeight={800} fontSize={18}>{formatCurrency(total)}</Typography>
          </Box>

          <Divider sx={{ borderStyle: "dashed", mt: 1.5 }} />

          {/* Payment Info */}
          <Typography variant="caption" fontWeight={700} sx={{ mt: 1.5, display: "block" }}>PAYMENT INFO</Typography>
          <Stack spacing={0.25} sx={{ mt: 0.5, fontSize: 13 }}>
            {paymentLines.map((p, i) => (
              <Box key={i} sx={{ display: "flex", justifyContent: "space-between" }}>
                <span>{p.method.toUpperCase()}</span>
                <Typography fontWeight={700}>{formatCurrency(p.amount)}</Typography>
              </Box>
            ))}
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <span>CASH RECEIVED</span>
              <Typography fontWeight={700}>{formatCurrency(received)}</Typography>
            </Box>
            {change > 0.001 && (
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <span>CHANGE</span>
                <Typography fontWeight={700}>{formatCurrency(change)}</Typography>
              </Box>
            )}
          </Stack>

          <Divider sx={{ borderStyle: "dashed", mt: 1.5 }} />

          <Typography variant="caption" sx={{ mt: 1.5, display: "block" }}>
            CUSTOMER {customerName ? customerName.toUpperCase() : "WALK-IN"}
          </Typography>

          <Divider sx={{ borderStyle: "dashed", mt: 1.5 }} />

          <Typography align="center" fontWeight={700} fontSize={13} sx={{ mt: 2 }}>
            THANK YOU FOR YOUR BUSINESS!
          </Typography>

          {/* Real scannable barcode of the invoice number */}
          <Box sx={{ textAlign: "center", mt: 2 }}>
            <svg ref={barcodeRef} />
          </Box>

          <Typography align="center" variant="caption" color="text.secondary" sx={{ mt: 2, display: "block", fontSize: 10 }}>
            Developed by DIO Solutions
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
