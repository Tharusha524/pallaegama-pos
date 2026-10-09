import { useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Divider, Stack } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import JsBarcode from "jsbarcode";
import { useHomeCurrency } from "../hooks/useHomeCurrency";
import { getCompanies } from "../api/CompanySetup/CompanySetupApi";
import useCurrentUser from "../hooks/useCurrentUser";
import { resolveLogoSrc } from "../utils/logoUrl";
import html2canvas from "html2canvas";
import { invoke } from "@tauri-apps/api/core";

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
  isQuote?: boolean;
  receiptSettings?: Record<string, any>;
  shiftId?: number | string;
  couponCode?: string;
  voucherCode?: string;
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
const FONT_SIZE: Record<string, number> = { small: 11, medium: 13, large: 15 };

function renderCustomFields(fields: any[], position: string) {
  if (!fields?.length) return null;
  return fields
    .filter((f) => f.position === position && f.label)
    .map((f) => (
      <Box key={f.id} sx={{ display: "flex", justifyContent: f.align === "center" ? "center" : f.align === "right" ? "flex-end" : "flex-start", mt: 0.5 }}>
        <Typography fontSize={FONT_SIZE[f.font_size] ?? 13} fontWeight={f.weight ?? 400} sx={{ whiteSpace: "pre-wrap" }}>
          {f.label}{f.value ? `: ${f.value}` : ""}
        </Typography>
      </Box>
    ));
}

export default function PosReceiptDialog({
  open, onClose, transNo, customerName, lines, total, payments, cashReceived,
  paperSize = "80mm Thermal", isQuote = false, receiptSettings, shiftId, couponCode, voucherCode,
}: PosReceiptDialogProps) {
  const { formatCurrency } = useHomeCurrency();
  const { user } = useCurrentUser();
  const barcodeRef = useRef<SVGSVGElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const receiptHtml = (innerHTML: string) => `<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <style>
      @page { size: 80mm auto; margin: 0; }
      html, body { width: 80mm; margin: 0; padding: 0; background: #fff; overflow-x: hidden; }
      body { padding: 2mm; font-family: monospace; font-size: 11px; color: #000; box-sizing: border-box; }
      * { color: #000 !important; font-weight: 700 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
      img { max-width: 100%; display: block; margin: 0 auto; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      td, th { overflow: hidden; word-break: break-all; }
      #pos-receipt-print-area { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; border: none !important; }
      [class*="MuiStack"], [class*="MuiBox"] { width: 100% !important; max-width: 100% !important; flex-wrap: wrap !important; overflow: hidden !important; }
      [style*="justify-content: space-between"] { display: flex !important; justify-content: space-between !important; width: 100% !important; }
    </style>
  </head><body>${innerHTML}</body></html>`;

  // Merge caller's settings over defaults so every key always exists.
  const rs = {
    show_logo: true, show_shop_name: true, show_address: true, show_phone: true,
    show_email: false, show_website: false, show_vat_number: false,
    shop_email: "", shop_website: "", shop_vat_number: "",
    show_invoice_id: true, show_cashier: true, show_date_time: true,
    show_shift_id: false, show_branch_name: false,
    show_discount_column: true, show_item_unit: false, show_offer_applied: false,
    show_payment_info: true, show_change: true, show_card_type: false, show_coupon_used: false, show_currency_symbol: false,
    show_customer_name: true,
    show_thank_you: true, thank_you_message: "THANK YOU FOR YOUR BUSINESS!",
    show_footer: true, footer_text: "Developed by DIO Solutions",
    show_custom_note: false, custom_note: "", show_barcode: true,
    font_header: "medium", font_items: "medium", font_totals: "medium", font_footer: "small",
    weight_shop_name: 800, weight_address: 400, weight_col_headers: 700,
    weight_item_name: 700, weight_unit_price: 400, weight_qty_line: 400,
    weight_subtotal: 400, weight_total: 800, weight_payment_lines: 700,
    weight_customer: 400, weight_thank_you: 700, weight_footer: 400,
    label_invoice_id: "Invoice ID", label_cashier: "Cashier", label_shift: "Shift", label_branch: "Branch",
    label_col_item: "ITEM", label_col_disc: "DISC", label_col_net: "NET", label_col_total: "TOTAL",
    label_unit_price: "UNIT PRICE", label_subtotal: "Subtotal", label_discount: "Discount",
    label_total: "TOTAL", label_payment_info: "PAYMENT INFO",
    label_total_due: "TOTAL", label_cash_received: "CASH RECEIVED", label_change: "CHANGE", label_customer: "CUSTOMER",
    label_coupon: "COUPON", label_voucher: "VOUCHER", label_you_saved: "You Saved", label_items: "Items",
    thermal_printer_name: "EPSON TM-T82 Receipt",
    custom_fields: [] as any[],
    ...(receiptSettings ?? {}),
  };

  const fmt = (v: number) => rs.show_currency_symbol ? formatCurrency(v, 2) : v.toFixed(2);

  const { data: companies } = useQuery({
    queryKey: ["company-setup-list"],
    queryFn: getCompanies,
    enabled: open,
  });
  const company = companies?.[0];
  const logoSrc = resolveLogoSrc(company?.company_logo_url);
  const now = new Date();
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);

  const handlePrint = useCallback(() => {
    const isTauriApp = !!(window as any).__TAURI_INTERNALS__;

    if (isTauriApp) {
      // Capture the receipt preview div as-is → scale to 576px (printer width) → ESC/POS
      const printArea = document.getElementById('pos-receipt-print-area');
      if (!printArea) { alert('Receipt preview not found.'); return; }

      // Fetch all images with auth headers and replace their src with data URLs
      // before html2canvas runs — prevents cross-origin fetch failures that
      // would cause html2canvas to hang silently on the client machine.
      const imgs = Array.from(printArea.querySelectorAll('img')) as HTMLImageElement[];
      const token = localStorage.getItem('token');
      const toDataUrlWithAuth = (img: HTMLImageElement): Promise<void> => {
        if (!img.src || img.src.startsWith('data:') || img.src.startsWith('blob:')) return Promise.resolve();
        return fetch(img.src, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
          .then((r) => r.blob())
          .then((blob) => new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => { img.src = reader.result as string; resolve(); };
            reader.onerror = () => resolve();
            reader.readAsDataURL(blob);
          }))
          .catch(() => Promise.resolve());
      };

      Promise.all([document.fonts.ready, ...imgs.map(toDataUrlWithAuth)]).then(() =>
        html2canvas(printArea, {
          scale: 576 / printArea.offsetWidth,
          backgroundColor: '#ffffff',
          useCORS: false,
          logging: false,
          imageTimeout: 0,
        })
      ).then((canvas) => {
        const base64 = canvas.toDataURL('image/png').split(',')[1];
        return invoke('print_receipt_escpos', {
            printerName: rs.thermal_printer_name || 'EPSON TM-T82 Receipt',
            imageBase64: base64,
            autoCut: true,
          });
      }).catch((err: any) => {
        alert(`Print failed: ${err}\n\nMake sure the EPSON TM-T82 is connected and powered on.`);
      });
      return;
    }

    // Browser: open a blank window with only the receipt HTML
    const printArea = document.getElementById("pos-receipt-print-area");
    if (!printArea) return;
    const win = window.open("", "_blank", "width=400,height=700");
    if (!win) { window.print(); return; }
    win.document.write(receiptHtml(printArea.innerHTML));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  }, [company, now, transNo, user, lines, total, subtotal, payments, cashReceived, customerName, logoSrc, rs, receiptHtml]);

  // Keyboard: Enter = print, ↑/↓ = scroll receipt
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); handlePrint(); }
      if (e.key === "ArrowDown") { e.preventDefault(); scrollRef.current?.scrollBy({ top: 80, behavior: "smooth" }); }
      if (e.key === "ArrowUp")   { e.preventDefault(); scrollRef.current?.scrollBy({ top: -80, behavior: "smooth" }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handlePrint]);

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

  const isThermal = paperSize.includes("80mm");
  const discountTotal = Math.max(0, subtotal - total);
  const paymentLines = payments && payments.length > 0 ? payments : [{ method: "CASH", amount: total }];
  const received = cashReceived ?? total;
  const change = Math.max(0, received - total);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle className="pos-receipt-no-print">{isQuote ? `Quotation #${transNo}` : `Receipt — Invoice #${transNo}`}</DialogTitle>
      <DialogContent ref={scrollRef}>
        <style>{`
          @media print {
            @page { size: 80mm auto; margin: 0; }

            /* Force browser to lay out at 80mm — no scaling */
            html, body {
              width: 80mm !important;
              min-width: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
            }

            /* Hide every direct child of body */
            body > * { display: none !important; }

            /* Show only the portal div that contains the receipt */
            body > *:has(#pos-receipt-print-area) { display: block !important; }

            /* Strip MUI dialog chrome */
            .MuiBackdrop-root { display: none !important; }
            .MuiModal-root, .MuiDialog-root {
              display: block !important;
              position: static !important;
            }
            .MuiDialog-container {
              display: block !important;
              position: static !important;
              height: auto !important;
            }
            .MuiDialog-paper {
              display: block !important;
              box-shadow: none !important;
              margin: 0 !important;
              max-height: none !important;
              width: 80mm !important;
              max-width: 80mm !important;
              border-radius: 0 !important;
              overflow: visible !important;
            }
            .MuiDialogTitle-root { display: none !important; }
            .MuiDialogActions-root { display: none !important; }
            .MuiDialogContent-root {
              padding: 0 !important;
              overflow: visible !important;
            }

            /* Receipt fills full 80mm */
            .pos-receipt-no-print { display: none !important; }
            #pos-receipt-print-area {
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 4mm !important;
              border: none !important;
              box-sizing: border-box !important;
            }
            #pos-receipt-print-area * {
              color: #000 !important;
              font-weight: 600 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}</style>
        <Box
          id="pos-receipt-print-area"
          sx={{ fontFamily: "'Poppins', sans-serif", width: isThermal ? 280 : "100%", mx: "auto", p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}
        >
          {/* ---- Header ---- */}
          <Stack alignItems="center" spacing={0.25} sx={{ mb: 1 }}>
            {rs.show_logo && logoSrc && (
              <img src={logoSrc} alt="Company logo" style={{ maxWidth: "100%", maxHeight: 64 }} />
            )}
            {rs.show_shop_name && (
              <Typography align="center" fontWeight={rs.weight_shop_name} fontSize={FONT_SIZE[rs.font_header] + 4}>
                {company?.name || "Your Business Name"}
              </Typography>
            )}
            {rs.show_address && company?.address && (
              <Typography align="center" fontWeight={rs.weight_address} fontSize={FONT_SIZE[rs.font_header]} sx={{ lineHeight: 1.2 }}>{company.address.toUpperCase()}</Typography>
            )}
            {rs.show_phone && (company?.phone_number || company?.fax_number) && (
              <Typography align="center" fontWeight={rs.weight_address} fontSize={FONT_SIZE[rs.font_header]}>
                {[company?.phone_number, company?.fax_number].filter(Boolean).join(" · ")}
              </Typography>
            )}
            {rs.show_email && rs.shop_email && (
              <Typography align="center" fontWeight={rs.weight_address} fontSize={FONT_SIZE[rs.font_header]}>{rs.shop_email}</Typography>
            )}
            {rs.show_website && rs.shop_website && (
              <Typography align="center" fontWeight={rs.weight_address} fontSize={FONT_SIZE[rs.font_header]}>{rs.shop_website}</Typography>
            )}
            {rs.show_vat_number && rs.shop_vat_number && (
              <Typography align="center" fontWeight={rs.weight_address} fontSize={FONT_SIZE[rs.font_header]}>VAT: {rs.shop_vat_number}</Typography>
            )}
            {rs.show_date_time && (
              <Typography align="center" fontWeight={rs.weight_address} fontSize={FONT_SIZE[rs.font_header]}>{now.toLocaleDateString()} {now.toLocaleTimeString()}</Typography>
            )}
          </Stack>

          <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary" }} />
          {renderCustomFields(rs.custom_fields, "after_header")}

          {isQuote && (
            <Typography align="center" fontWeight={800} fontSize={14} sx={{ mb: 0.5 }}>PRICE QUOTATION</Typography>
          )}
          <Stack spacing={0.25} sx={{ my: 1 }}>
            {rs.show_invoice_id && (
              <Typography fontSize={FONT_SIZE[rs.font_header]}>{isQuote ? "Quotation ID" : rs.label_invoice_id}: {transNo}</Typography>
            )}
            {rs.show_cashier && (
              <Typography fontSize={FONT_SIZE[rs.font_header]}>{rs.label_cashier}: {user?.first_name || user?.email || "—"}</Typography>
            )}
            {rs.show_shift_id && shiftId && (
              <Typography fontSize={FONT_SIZE[rs.font_header]}>{rs.label_shift}: {shiftId}</Typography>
            )}
            {rs.show_branch_name && company?.name && (
              <Typography fontSize={FONT_SIZE[rs.font_header]}>{rs.label_branch}: {company.name}</Typography>
            )}
            {renderCustomFields(rs.custom_fields, "after_invoice")}
          </Stack>

          <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary" }} />

          {/* ---- Line items ---- */}
          <Box sx={{ my: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_items] - 1, fontWeight: rs.weight_col_headers }}>
              <span>{rs.label_col_item}</span>
              <Box sx={{ display: "flex", gap: 2 }}>
                <span>{rs.label_col_net}</span><span>{rs.label_col_total}</span>
              </Box>
            </Box>
            {lines.map((l: any, i) => {
              const netPrice = l.unit_price * (1 - l.discount_percent / 100);
              const lineTotal = l.quantity * netPrice;
              return (
                <Box key={i} sx={{ mt: 1 }}>
                  <Typography fontSize={FONT_SIZE[rs.font_items] + 1} fontWeight={rs.weight_item_name}>{l.description}</Typography>
                  <Typography fontSize={FONT_SIZE[rs.font_items] - 1} fontWeight={rs.weight_unit_price} color="text.secondary">
                    {rs.label_unit_price} {l.unit_price.toFixed(2)}{rs.show_item_unit && l.unit_name ? ` / ${l.unit_name}` : ""}
                  </Typography>
                  {rs.show_offer_applied && l.offer_name && (
                    <Typography fontSize={FONT_SIZE[rs.font_items] - 1} color="success.main">Offer: {l.offer_name}</Typography>
                  )}
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_items], fontWeight: rs.weight_qty_line }}>
                    <span>{l.quantity} x{rs.show_item_unit && l.unit_name ? ` ${l.unit_name}` : ""}</span>
                    <Box sx={{ display: "flex", gap: 2 }}>
                      <span>{netPrice.toFixed(2)}</span>
                      <span>{lineTotal.toFixed(2)}</span>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary" }} />
          {renderCustomFields(rs.custom_fields, "after_items")}

          <Stack spacing={0.25} sx={{ my: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals], fontWeight: rs.weight_subtotal }}>
              <span>{rs.label_subtotal}</span><span>{fmt(subtotal)}</span>
            </Box>
            {discountTotal > 0.001 && (
              <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals], fontWeight: rs.weight_subtotal }}>
                <span>{rs.label_discount}</span><span>-{fmt(discountTotal)}</span>
              </Box>
            )}
          </Stack>

          <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary" }} />

          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
            <Typography fontWeight={rs.weight_total} fontSize={FONT_SIZE[rs.font_totals] + 7}>{rs.label_total}</Typography>
            <Typography fontWeight={rs.weight_total} fontSize={FONT_SIZE[rs.font_totals] + 7}>{fmt(total)}</Typography>
          </Box>

          {!isQuote && rs.show_payment_info && (
            <>
              <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary", mt: 1.5 }} />
              <Typography fontWeight={rs.weight_payment_lines} fontSize={FONT_SIZE[rs.font_totals]} sx={{ mt: 1.5, display: "block" }}>{rs.label_payment_info}</Typography>
              <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals] }}>
                  <span style={{ fontWeight: rs.weight_payment_lines }}>{rs.label_total_due ?? "TOTAL"}</span>
                  <Typography fontWeight={rs.weight_payment_lines} fontSize={FONT_SIZE[rs.font_totals]}>{fmt(total)}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals] }}>
                  <span style={{ fontWeight: rs.weight_payment_lines }}>{rs.label_cash_received}</span>
                  <Typography fontWeight={rs.weight_payment_lines} fontSize={FONT_SIZE[rs.font_totals]}>{fmt(received)}</Typography>
                </Box>
                {rs.show_change && change > 0.001 && (
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals] }}>
                    <span style={{ fontWeight: rs.weight_payment_lines }}>{rs.label_change}</span>
                    <Typography fontWeight={rs.weight_payment_lines} fontSize={FONT_SIZE[rs.font_totals]}>{fmt(change)}</Typography>
                  </Box>
                )}
                {rs.show_coupon_used && couponCode && (
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals] }}>
                    <span style={{ fontWeight: rs.weight_payment_lines }}>{rs.label_coupon}</span><span>{couponCode}</span>
                  </Box>
                )}
                {rs.show_coupon_used && voucherCode && (
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals] }}>
                    <span style={{ fontWeight: rs.weight_payment_lines }}>{rs.label_voucher}</span><span>{voucherCode}</span>
                  </Box>
                )}
              </Stack>
              {discountTotal > 0.001 && (
                <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals], fontWeight: rs.weight_payment_lines, mt: 0.5 }}>
                  <span style={{ fontWeight: rs.weight_payment_lines }}>{rs.label_you_saved ?? "You Saved"}</span>
                  <Typography fontWeight={rs.weight_payment_lines} fontSize={FONT_SIZE[rs.font_totals]}>{fmt(discountTotal)}</Typography>
                </Box>
              )}
              {renderCustomFields(rs.custom_fields, "after_payment")}
              <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary", mt: 1 }} />
              <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals], fontWeight: rs.weight_payment_lines, mt: 0.5 }}>
                <span style={{ fontWeight: rs.weight_payment_lines }}>{rs.label_items ?? "Items"}</span>
                <Typography fontWeight={rs.weight_payment_lines} fontSize={FONT_SIZE[rs.font_totals]}>{lines.length}</Typography>
              </Box>
            </>
          )}

          {rs.show_customer_name && (
            <>
              <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary", mt: 1.5 }} />
              <Typography fontWeight={rs.weight_customer} fontSize={FONT_SIZE[rs.font_footer] + 2} sx={{ mt: 1.5, display: "block" }}>
                {rs.label_customer} {customerName ? customerName.toUpperCase() : "WALK-IN"}
              </Typography>
            </>
          )}

          <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary", mt: 1.5 }} />

          {!isQuote && rs.show_thank_you && (
            <Typography align="center" fontWeight={rs.weight_thank_you} fontSize={FONT_SIZE[rs.font_footer] + 3} sx={{ mt: 2 }}>
              {rs.thank_you_message}
            </Typography>
          )}
          {rs.show_footer && (
            <Typography align="center" fontWeight={rs.weight_footer} fontSize={FONT_SIZE[rs.font_footer]} color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              {rs.footer_text}
            </Typography>
          )}
          {rs.show_custom_note && rs.custom_note && (
            <Typography align="center" fontWeight={rs.weight_footer} fontSize={FONT_SIZE[rs.font_footer]} sx={{ mt: 1, display: "block" }}>
              {rs.custom_note}
            </Typography>
          )}

          {renderCustomFields(rs.custom_fields, "footer")}
          {rs.show_barcode && (
            <Box sx={{ textAlign: "center", mt: 2 }}>
              <svg ref={barcodeRef} />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions className="pos-receipt-no-print">
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>Print Receipt</Button>
      </DialogActions>
    </Dialog>
  );
}
