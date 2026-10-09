import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Typography, Stack, Switch, FormControlLabel, Button, Divider,
  TextField, Select, MenuItem, FormControl, Paper, Slider, IconButton,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useNavigate } from "react-router-dom";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import { getPosSettings, updatePosSettings } from "../../../api/Pos/posOpsApi";
import { getCompanies } from "../../../api/CompanySetup/CompanySetupApi";
import { resolveLogoSrc } from "../../../utils/logoUrl";
import { notify } from "../../../services/notificationService";
import JsBarcode from "jsbarcode";

const FONT_SIZE: Record<string, number> = { small: 11, medium: 13, large: 15 };
const WEIGHT_MARKS = [
  { value: 300, label: "Thin" },
  { value: 400, label: "Normal" },
  { value: 500, label: "Medium" },
  { value: 700, label: "Bold" },
  { value: 900, label: "Black" },
];

// A custom field the admin adds from the UI — no code change needed.
export interface CustomReceiptField {
  id: string;
  label: string;
  value: string;
  position: "after_header" | "after_invoice" | "after_items" | "after_payment" | "footer";
  align: "left" | "center" | "right";
  font_size: "small" | "medium" | "large";
  weight: number;
}

const POSITIONS = [
  { value: "after_header", label: "After shop header" },
  { value: "after_invoice", label: "After invoice info" },
  { value: "after_items", label: "After items table" },
  { value: "after_payment", label: "After payment info" },
  { value: "footer", label: "In footer area" },
];

const DEFAULT_RS = {
  show_logo: true, show_shop_name: true, show_address: true, show_phone: true,
  show_email: false, shop_email: "", show_website: false, shop_website: "",
  show_vat_number: false, shop_vat_number: "", show_date_time: true,
  show_invoice_id: true, show_cashier: true, show_shift_id: false, show_branch_name: false,
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
  custom_fields: [] as CustomReceiptField[],
  // Editable labels
  label_invoice_id: "Invoice ID",
  label_cashier: "Cashier",
  label_shift: "Shift",
  label_branch: "Branch",
  label_col_item: "ITEM",
  label_col_disc: "DISC",
  label_col_net: "NET",
  label_col_total: "TOTAL",
  label_unit_price: "UNIT PRICE",
  label_subtotal: "Subtotal",
  label_discount: "Discount",
  label_total: "TOTAL",
  label_payment_info: "PAYMENT INFO",
  label_total_due: "TOTAL",
  label_cash_received: "CASH RECEIVED",
  label_change: "CHANGE",
  label_customer: "CUSTOMER",
  label_coupon: "COUPON",
  label_voucher: "VOUCHER",
  label_you_saved: "You Saved",
  label_items: "Items",
};

function renderCustomFields(fields: CustomReceiptField[], position: string, fsMap: Record<string, number>) {
  return fields
    .filter((f) => f.position === position && f.label)
    .map((f) => (
      <Box key={f.id} sx={{ display: "flex", justifyContent: f.align === "center" ? "center" : f.align === "right" ? "flex-end" : "flex-start", mt: 0.5 }}>
        <Typography fontSize={fsMap[f.font_size]} fontWeight={f.weight} sx={{ whiteSpace: "pre-wrap" }}>
          {f.label}{f.value ? `: ${f.value}` : ""}
        </Typography>
      </Box>
    ));
}

const DUMMY_LINES = [
  { description: "Milk 1L", quantity: 2, unit_price: 150, discount_percent: 0, unit_name: "PCS" },
  { description: "Bread Loaf", quantity: 1, unit_price: 220, discount_percent: 5, unit_name: "PCS" },
];
const DUMMY_PAYMENTS = [{ method: "CASH IN HAND", amount: 570, card_type_name: "Visa" }];
const DUMMY_TOTAL = 559;
const DUMMY_RECEIVED = 600;
const DUMMY_CHANGE = 41;

function ReceiptPreview({ rs, company, logoSrc }: { rs: Record<string, any>; company: any; logoSrc: string | null }) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (rs.show_barcode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, "26", {
          format: "CODE128", displayValue: false, height: 45, width: 1.8, margin: 10,
        });
      } catch { /* ignore */ }
    }
  }, [rs.show_barcode]);

  const now = new Date();
  const subtotal = DUMMY_LINES.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const discountTotal = Math.max(0, subtotal - DUMMY_TOTAL);

  return (
    <Box sx={{
      fontFamily: "monospace", width: 280, mx: "auto", p: 1.5,
      border: "1px solid", borderColor: "divider", borderRadius: 1,
      backgroundColor: "background.paper",
    }}>
      {/* Header */}
      <Stack alignItems="center" spacing={0.25} sx={{ mb: 1 }}>
        {rs.show_logo && logoSrc && (
          <img src={logoSrc} alt="logo" style={{ maxWidth: "100%", maxHeight: 56 }} />
        )}
        {rs.show_shop_name && (
          <Typography align="center" fontWeight={rs.weight_shop_name} fontSize={FONT_SIZE[rs.font_header] + 4}>
            {company?.name || "Shop Name"}
          </Typography>
        )}
        {rs.show_address && company?.address && (
          <Typography align="center" fontWeight={rs.weight_address} fontSize={FONT_SIZE[rs.font_header]} sx={{ lineHeight: 1.2 }}>
            {company.address.toUpperCase()}
          </Typography>
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
          <Typography align="center" fontWeight={rs.weight_address} fontSize={FONT_SIZE[rs.font_header]}>
            {now.toLocaleDateString()} {now.toLocaleTimeString()}
          </Typography>
        )}
      </Stack>

      <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary" }} />
      {renderCustomFields(rs.custom_fields ?? [], "after_header", FONT_SIZE)}

      <Stack spacing={0.25} sx={{ my: 1 }}>
        {rs.show_invoice_id && <Typography fontWeight={rs.weight_address} fontSize={FONT_SIZE[rs.font_header]}>{rs.label_invoice_id}: 26</Typography>}
        {rs.show_cashier && <Typography fontWeight={rs.weight_address} fontSize={FONT_SIZE[rs.font_header]}>{rs.label_cashier}: Admin</Typography>}
        {rs.show_shift_id && <Typography fontWeight={rs.weight_address} fontSize={FONT_SIZE[rs.font_header]}>{rs.label_shift}: 3</Typography>}
        {rs.show_branch_name && company?.name && <Typography fontWeight={rs.weight_address} fontSize={FONT_SIZE[rs.font_header]}>{rs.label_branch}: {company.name}</Typography>}
        {renderCustomFields(rs.custom_fields ?? [], "after_invoice", FONT_SIZE)}
      </Stack>

      <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary" }} />

      {/* Items */}
      <Box sx={{ my: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_items] - 1, fontWeight: rs.weight_col_headers }}>
          <span>{rs.label_col_item}</span>
          <Box sx={{ display: "flex", gap: 2 }}>
            {rs.show_discount_column && <span>{rs.label_col_disc}</span>}
            <span>{rs.label_col_net}</span><span>{rs.label_col_total}</span>
          </Box>
        </Box>
        {DUMMY_LINES.map((l, i) => {
          const net = l.unit_price * (1 - l.discount_percent / 100);
          const tot = l.quantity * net;
          return (
            <Box key={i} sx={{ mt: 1 }}>
              <Typography fontSize={FONT_SIZE[rs.font_items] + 1} fontWeight={rs.weight_item_name}>{l.description}</Typography>
              <Typography fontSize={FONT_SIZE[rs.font_items] - 1} fontWeight={rs.weight_unit_price} color="text.secondary">
                {rs.label_unit_price} {l.unit_price.toFixed(2)}{rs.show_item_unit ? ` / ${l.unit_name}` : ""}
              </Typography>
              {rs.show_offer_applied && i === 1 && (
                <Typography fontSize={FONT_SIZE[rs.font_items] - 1} color="success.main">Offer: Member 5% Off</Typography>
              )}
              <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_items], fontWeight: rs.weight_qty_line }}>
                <span>{l.quantity} x{rs.show_item_unit ? ` ${l.unit_name}` : ""}</span>
                <Box sx={{ display: "flex", gap: 2 }}>
                  {rs.show_discount_column && <span>{l.discount_percent > 0 ? `${l.discount_percent}%` : "-"}</span>}
                  <span>{net.toFixed(2)}</span>
                  <span>{tot.toFixed(2)}</span>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary" }} />
      {renderCustomFields(rs.custom_fields ?? [], "after_items", FONT_SIZE)}

      <Stack spacing={0.25} sx={{ my: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals], fontWeight: rs.weight_subtotal }}>
          <span>{rs.label_subtotal}</span><span>{subtotal.toFixed(2)}</span>
        </Box>
        {discountTotal > 0.001 && (
          <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals], fontWeight: rs.weight_subtotal }}>
            <span>{rs.label_discount}</span><span>-{discountTotal.toFixed(2)}</span>
          </Box>
        )}
      </Stack>

      <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary" }} />

      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
        <Typography fontWeight={rs.weight_total} fontSize={FONT_SIZE[rs.font_totals] + 7}>{rs.label_total}</Typography>
        <Typography fontWeight={rs.weight_total} fontSize={FONT_SIZE[rs.font_totals] + 7}>LKR {DUMMY_TOTAL.toFixed(2)}</Typography>
      </Box>

      {rs.show_payment_info && (
        <>
          <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary", mt: 1.5 }} />
          <Typography fontWeight={rs.weight_payment_lines} fontSize={FONT_SIZE[rs.font_totals]} sx={{ mt: 1.5, display: "block" }}>{rs.label_payment_info}</Typography>
          <Stack spacing={0.25} sx={{ mt: 0.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals] }}>
              <span style={{ fontWeight: rs.weight_payment_lines }}>{rs.label_total_due ?? "TOTAL"}</span>
              <Typography fontWeight={rs.weight_payment_lines} fontSize={FONT_SIZE[rs.font_totals]}>520.00</Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals] }}>
              <span style={{ fontWeight: rs.weight_payment_lines }}>{rs.label_cash_received}</span>
              <Typography fontWeight={rs.weight_payment_lines} fontSize={FONT_SIZE[rs.font_totals]}>{DUMMY_RECEIVED.toFixed(2)}</Typography>
            </Box>
            {rs.show_change && (
              <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals] }}>
                <span style={{ fontWeight: rs.weight_payment_lines }}>{rs.label_change}</span>
                <Typography fontWeight={rs.weight_payment_lines} fontSize={FONT_SIZE[rs.font_totals]}>{DUMMY_CHANGE.toFixed(2)}</Typography>
              </Box>
            )}
            {rs.show_coupon_used && (
              <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals] }}>
                <span style={{ fontWeight: rs.weight_payment_lines }}>COUPON</span><span>SAVE10</span>
              </Box>
            )}
          </Stack>
          <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals], fontWeight: rs.weight_payment_lines, mt: 0.5 }}>
            <span style={{ fontWeight: rs.weight_payment_lines }}>{rs.label_you_saved ?? "You Saved"}</span>
            <Typography fontWeight={rs.weight_payment_lines} fontSize={FONT_SIZE[rs.font_totals]}>50.00</Typography>
          </Box>
          {renderCustomFields(rs.custom_fields ?? [], "after_payment", FONT_SIZE)}
          <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary", mt: 1 }} />
          <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE[rs.font_totals], fontWeight: rs.weight_payment_lines, mt: 0.5 }}>
            <span style={{ fontWeight: rs.weight_payment_lines }}>{rs.label_items ?? "Items"}</span>
            <Typography fontWeight={rs.weight_payment_lines} fontSize={FONT_SIZE[rs.font_totals]}>{DUMMY_LINES.length}</Typography>
          </Box>
        </>
      )}

      {rs.show_customer_name && (
        <>
          <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary", mt: 1.5 }} />
          <Typography fontWeight={rs.weight_customer} fontSize={FONT_SIZE[rs.font_footer] + 2} sx={{ mt: 1.5, display: "block" }}>
            {rs.label_customer} VINOD JAYASUNDARA
          </Typography>
        </>
      )}

      <Divider sx={{ borderStyle: "dashed", borderBottomWidth: 1.5, borderColor: "text.primary", mt: 1.5 }} />

      {rs.show_thank_you && (
        <Typography align="center" fontWeight={rs.weight_thank_you} fontSize={FONT_SIZE[rs.font_footer] + 3} sx={{ mt: 2 }}>
          {rs.thank_you_message || "THANK YOU FOR YOUR BUSINESS!"}
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
      {renderCustomFields(rs.custom_fields ?? [], "footer", FONT_SIZE)}
      {rs.show_barcode && (
        <Box sx={{ textAlign: "center", mt: 2 }}>
          <svg ref={barcodeRef} />
        </Box>
      )}
    </Box>
  );
}

function SectionToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <FormControlLabel
      control={<Switch checked={checked} onChange={(e) => onChange(e.target.checked)} size="small" />}
      label={<Typography variant="body2">{label}</Typography>}
    />
  );
}

function FontSizePicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100 }}>{label}</Typography>
      <FormControl size="small" sx={{ width: 110 }}>
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <MenuItem value="small">Small</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="large">Large</MenuItem>
        </Select>
      </FormControl>
    </Stack>
  );
}

function WeightSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Box sx={{ px: 1 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Slider
        value={value}
        min={300} max={900} step={null}
        marks={WEIGHT_MARKS}
        onChange={(_, v) => onChange(v as number)}
        valueLabelDisplay="off"
        size="small"
        sx={{ mt: 0.5, mb: 1.5 }}
      />
    </Box>
  );
}

export default function ReceiptCustomizePage() {
  const navigate = useNavigate();
  const { data: settingsData } = useQuery({ queryKey: ["pos-settings"], queryFn: getPosSettings });
  const { data: companies } = useQuery({ queryKey: ["company-setup-list"], queryFn: getCompanies });
  const company = companies?.[0];
  const logoSrc = resolveLogoSrc(company?.company_logo_url);

  const [rs, setRS] = useState<Record<string, any>>(DEFAULT_RS);
  const set = (key: string, val: any) => setRS((prev) => ({ ...prev, [key]: val }));

  useEffect(() => {
    if (settingsData?.receipt_settings) {
      try {
        const parsed = JSON.parse(settingsData.receipt_settings);
        setRS({ ...DEFAULT_RS, ...parsed });
      } catch { /* keep defaults */ }
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: () => updatePosSettings({ ...settingsData, receipt_settings: rs }),
    onSuccess: () => notify.success("Receipt settings saved"),
    onError: () => notify.error("Failed to save"),
  });

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="Customize Receipt" />
          <Breadcrumb breadcrumbs={[
            { title: "Smart Supermarket", href: "/supermarket" },
            { title: "POS Settings", href: "/supermarket/pos-settings" },
            { title: "Customize Receipt" },
          ]} />
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/supermarket/pos-settings")}>Back</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </Stack>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 300px" }, gap: 2, alignItems: "start" }}>
        {/* ---- Left: controls ---- */}
        <Stack spacing={2}>

          {/* Shop Header */}
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Shop Header</Typography>
              <Stack spacing={0.5}>
                <SectionToggle label="Show Logo" checked={!!rs.show_logo} onChange={(v) => set("show_logo", v)} />
                <SectionToggle label="Show Shop Name" checked={!!rs.show_shop_name} onChange={(v) => set("show_shop_name", v)} />
                <SectionToggle label="Show Address" checked={!!rs.show_address} onChange={(v) => set("show_address", v)} />
                <SectionToggle label="Show Phone" checked={!!rs.show_phone} onChange={(v) => set("show_phone", v)} />
                <SectionToggle label="Show Email" checked={!!rs.show_email} onChange={(v) => set("show_email", v)} />
                {rs.show_email && <TextField label="Email" size="small" sx={{ ml: 4, maxWidth: 280, mt: 0.5 }} value={rs.shop_email} onChange={(e) => set("shop_email", e.target.value)} />}
                <SectionToggle label="Show Website" checked={!!rs.show_website} onChange={(v) => set("show_website", v)} />
                {rs.show_website && <TextField label="Website URL" size="small" sx={{ ml: 4, maxWidth: 280, mt: 0.5 }} value={rs.shop_website} onChange={(e) => set("shop_website", e.target.value)} />}
                <SectionToggle label="Show VAT / Tax Number" checked={!!rs.show_vat_number} onChange={(v) => set("show_vat_number", v)} />
                {rs.show_vat_number && <TextField label="VAT Number" size="small" sx={{ ml: 4, maxWidth: 280, mt: 0.5 }} value={rs.shop_vat_number} onChange={(e) => set("shop_vat_number", e.target.value)} />}
                <SectionToggle label="Show Date & Time" checked={!!rs.show_date_time} onChange={(v) => set("show_date_time", v)} />
                <Divider sx={{ my: 0.5 }} />
                <FontSizePicker label="Header font size" value={rs.font_header} onChange={(v) => set("font_header", v)} />
                <WeightSlider label="Shop name weight" value={rs.weight_shop_name} onChange={(v) => set("weight_shop_name", v)} />
                <WeightSlider label="Address / info weight" value={rs.weight_address} onChange={(v) => set("weight_address", v)} />
              </Stack>
            </CardContent>
          </Card>

          {/* Invoice Info */}
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Invoice Info</Typography>
              <Stack spacing={0.5}>
                <SectionToggle label="Show Invoice ID" checked={!!rs.show_invoice_id} onChange={(v) => set("show_invoice_id", v)} />
                <SectionToggle label="Show Cashier Name" checked={!!rs.show_cashier} onChange={(v) => set("show_cashier", v)} />
                <SectionToggle label="Show Shift ID" checked={!!rs.show_shift_id} onChange={(v) => set("show_shift_id", v)} />
                <SectionToggle label="Show Branch Name" checked={!!rs.show_branch_name} onChange={(v) => set("show_branch_name", v)} />
              </Stack>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Items Table</Typography>
              <Stack spacing={0.5}>
                <SectionToggle label="Show Discount Column" checked={!!rs.show_discount_column} onChange={(v) => set("show_discount_column", v)} />
                <SectionToggle label="Show Item Unit (KG, PCS...)" checked={!!rs.show_item_unit} onChange={(v) => set("show_item_unit", v)} />
                <SectionToggle label="Show Offer/Discount Name Applied" checked={!!rs.show_offer_applied} onChange={(v) => set("show_offer_applied", v)} />
                <Divider sx={{ my: 0.5 }} />
                <FontSizePicker label="Items font size" value={rs.font_items} onChange={(v) => set("font_items", v)} />
                <WeightSlider label="Column headers weight" value={rs.weight_col_headers} onChange={(v) => set("weight_col_headers", v)} />
                <WeightSlider label="Item name weight" value={rs.weight_item_name} onChange={(v) => set("weight_item_name", v)} />
                <WeightSlider label="Unit price weight" value={rs.weight_unit_price} onChange={(v) => set("weight_unit_price", v)} />
                <WeightSlider label="Qty × line weight" value={rs.weight_qty_line} onChange={(v) => set("weight_qty_line", v)} />
              </Stack>
            </CardContent>
          </Card>

          {/* Totals & Payment */}
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Totals & Payment</Typography>
              <Stack spacing={0.5}>
                <SectionToggle label="Show Payment Info Section" checked={!!rs.show_payment_info} onChange={(v) => set("show_payment_info", v)} />
                <SectionToggle label="Show Change Due" checked={!!rs.show_change} onChange={(v) => set("show_change", v)} />
                <SectionToggle label="Show Card Type (Visa, Mastercard...)" checked={!!rs.show_card_type} onChange={(v) => set("show_card_type", v)} />
                <SectionToggle label="Show Coupon / Voucher Code Used" checked={!!rs.show_coupon_used} onChange={(v) => set("show_coupon_used", v)} />
                <SectionToggle label="Show Currency Symbol (e.g. LKR) on amounts" checked={!!rs.show_currency_symbol} onChange={(v) => set("show_currency_symbol", v)} />
                <Divider sx={{ my: 0.5 }} />
                <FontSizePicker label="Totals font size" value={rs.font_totals} onChange={(v) => set("font_totals", v)} />
                <WeightSlider label="Subtotal / Discount weight" value={rs.weight_subtotal} onChange={(v) => set("weight_subtotal", v)} />
                <WeightSlider label="Total amount weight" value={rs.weight_total} onChange={(v) => set("weight_total", v)} />
                <WeightSlider label="Payment lines weight" value={rs.weight_payment_lines} onChange={(v) => set("weight_payment_lines", v)} />
              </Stack>
            </CardContent>
          </Card>

          {/* Customer */}
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Customer</Typography>
              <Stack spacing={0.5}>
                <SectionToggle label="Show Customer Name" checked={!!rs.show_customer_name} onChange={(v) => set("show_customer_name", v)} />
                <Divider sx={{ my: 0.5 }} />
                <WeightSlider label="Customer name weight" value={rs.weight_customer} onChange={(v) => set("weight_customer", v)} />
              </Stack>
            </CardContent>
          </Card>

          {/* Footer */}
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Footer</Typography>
              <Stack spacing={1}>
                <SectionToggle label="Show Thank You Message" checked={!!rs.show_thank_you} onChange={(v) => set("show_thank_you", v)} />
                {rs.show_thank_you && (
                  <TextField label="Thank You Message" size="small" fullWidth sx={{ maxWidth: 360 }}
                    value={rs.thank_you_message} onChange={(e) => set("thank_you_message", e.target.value)} />
                )}
                <SectionToggle label="Show Footer Text" checked={!!rs.show_footer} onChange={(v) => set("show_footer", v)} />
                {rs.show_footer && (
                  <TextField label="Footer Text" size="small" fullWidth sx={{ maxWidth: 360 }}
                    value={rs.footer_text} onChange={(e) => set("footer_text", e.target.value)} />
                )}
                <SectionToggle label="Show Custom Note" checked={!!rs.show_custom_note} onChange={(v) => set("show_custom_note", v)} />
                {rs.show_custom_note && (
                  <TextField label="Custom Note" size="small" fullWidth multiline rows={2} sx={{ maxWidth: 360 }}
                    value={rs.custom_note} onChange={(e) => set("custom_note", e.target.value)} />
                )}
                <SectionToggle label="Show Invoice Barcode" checked={!!rs.show_barcode} onChange={(v) => set("show_barcode", v)} />
                <Divider sx={{ my: 0.5 }} />
                <FontSizePicker label="Footer font size" value={rs.font_footer} onChange={(v) => set("font_footer", v)} />
                <WeightSlider label="Thank you message weight" value={rs.weight_thank_you} onChange={(v) => set("weight_thank_you", v)} />
                <WeightSlider label="Footer text weight" value={rs.weight_footer} onChange={(v) => set("weight_footer", v)} />
              </Stack>
            </CardContent>
          </Card>

          {/* Labels */}
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Labels (rename any text)</Typography>
              <Stack spacing={1.5}>
                {[
                  { key: "label_invoice_id", placeholder: "Invoice ID" },
                  { key: "label_cashier", placeholder: "Cashier" },
                  { key: "label_shift", placeholder: "Shift" },
                  { key: "label_branch", placeholder: "Branch" },
                  { key: "label_col_item", placeholder: "ITEM (column header)" },
                  { key: "label_col_disc", placeholder: "DISC (column header)" },
                  { key: "label_col_net", placeholder: "NET (column header)" },
                  { key: "label_col_total", placeholder: "TOTAL (column header)" },
                  { key: "label_unit_price", placeholder: "UNIT PRICE" },
                  { key: "label_subtotal", placeholder: "Subtotal" },
                  { key: "label_discount", placeholder: "Discount" },
                  { key: "label_total", placeholder: "TOTAL" },
                  { key: "label_payment_info", placeholder: "PAYMENT INFO" },
                  { key: "label_total_due", placeholder: "TOTAL" },
                  { key: "label_cash_received", placeholder: "CASH RECEIVED" },
                  { key: "label_change", placeholder: "CHANGE" },
                  { key: "label_customer", placeholder: "CUSTOMER" },
                  { key: "label_coupon", placeholder: "COUPON" },
                  { key: "label_voucher", placeholder: "VOUCHER" },
                  { key: "label_you_saved", placeholder: "You Saved" },
                  { key: "label_items", placeholder: "Items" },
                ].map(({ key, placeholder }) => (
                  <TextField
                    key={key}
                    label={placeholder}
                    size="small"
                    fullWidth
                    value={rs[key] ?? placeholder}
                    onChange={(e) => set(key, e.target.value)}
                    placeholder={placeholder}
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>

          {/* Custom Fields */}
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>Custom Fields</Typography>
                <IconButton size="small" color="primary" onClick={() => {
                  const newField: CustomReceiptField = {
                    id: Date.now().toString(),
                    label: "New Field",
                    value: "",
                    position: "after_header",
                    align: "left",
                    font_size: "medium",
                    weight: 400,
                  };
                  set("custom_fields", [...(rs.custom_fields ?? []), newField]);
                }}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Stack>
              {(rs.custom_fields ?? []).length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No custom fields yet. Click + to add a field that will appear on the receipt.
                </Typography>
              )}
              <Stack spacing={2}>
                {(rs.custom_fields ?? []).map((f: CustomReceiptField, idx: number) => (
                  <Box key={f.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="caption" fontWeight={600} color="primary">Field {idx + 1}</Typography>
                      <IconButton size="small" color="error" onClick={() => {
                        set("custom_fields", (rs.custom_fields ?? []).filter((_: any, i: number) => i !== idx));
                      }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Stack spacing={1}>
                      <TextField label="Label" size="small" fullWidth value={f.label}
                        onChange={(e) => {
                          const updated = [...(rs.custom_fields ?? [])];
                          updated[idx] = { ...f, label: e.target.value };
                          set("custom_fields", updated);
                        }} />
                      <TextField label="Value (optional)" size="small" fullWidth value={f.value}
                        placeholder="Leave blank to show label only"
                        onChange={(e) => {
                          const updated = [...(rs.custom_fields ?? [])];
                          updated[idx] = { ...f, value: e.target.value };
                          set("custom_fields", updated);
                        }} />
                      <FormControl size="small" fullWidth>
                        <Select value={f.position} onChange={(e) => {
                          const updated = [...(rs.custom_fields ?? [])];
                          updated[idx] = { ...f, position: e.target.value as CustomReceiptField["position"] };
                          set("custom_fields", updated);
                        }}>
                          {POSITIONS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <Stack direction="row" spacing={1}>
                        <FormControl size="small" sx={{ flex: 1 }}>
                          <Select value={f.align} onChange={(e) => {
                            const updated = [...(rs.custom_fields ?? [])];
                            updated[idx] = { ...f, align: e.target.value as CustomReceiptField["align"] };
                            set("custom_fields", updated);
                          }}>
                            <MenuItem value="left">Left</MenuItem>
                            <MenuItem value="center">Center</MenuItem>
                            <MenuItem value="right">Right</MenuItem>
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ flex: 1 }}>
                          <Select value={f.font_size} onChange={(e) => {
                            const updated = [...(rs.custom_fields ?? [])];
                            updated[idx] = { ...f, font_size: e.target.value as CustomReceiptField["font_size"] };
                            set("custom_fields", updated);
                          }}>
                            <MenuItem value="small">Small</MenuItem>
                            <MenuItem value="medium">Medium</MenuItem>
                            <MenuItem value="large">Large</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>
                      <WeightSlider label="Font weight" value={f.weight} onChange={(v) => {
                        const updated = [...(rs.custom_fields ?? [])];
                        updated[idx] = { ...f, weight: v };
                        set("custom_fields", updated);
                      }} />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

        </Stack>

        {/* ---- Right: live preview ---- */}
        <Box sx={{ position: { md: "sticky" }, top: { md: 16 } }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, textAlign: "center" }}>
            Live Preview
          </Typography>
          <Paper elevation={2} sx={{ p: 1.5, borderRadius: 2, overflowY: "auto", maxHeight: "88vh" }}>
            <ReceiptPreview rs={rs} company={company} logoSrc={logoSrc} />
          </Paper>
        </Box>
      </Box>
    </FormPageLayout>
  );
}
