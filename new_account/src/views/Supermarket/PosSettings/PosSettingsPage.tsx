import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Box, Card, CardContent, Typography, Stack, Switch, FormControlLabel, Button, Divider } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getPosSettings, updatePosSettings } from "../../../api/Pos/posOpsApi";
import { notify } from "../../../services/notificationService";

const TOGGLES: { key: string; label: string; helper: string }[] = [
  { key: "low_stock_alerts_on_pos", label: "Low Stock Alerts on POS", helper: "Show a floating panel when items below minimum stock are in the cart" },
  { key: "ask_before_removing_last_item", label: "Ask Before Removing Last Item", helper: "Show a confirmation when staff remove the only line left in the cart" },
  { key: "on_screen_number_pad", label: "On-Screen Number Pad", helper: "For touchscreens/tablets that don't have their own keyboard" },
  { key: "select_customer_at_checkout", label: "Require Customer at Checkout", helper: "Pick a customer or credit before finishing a sale — off for walk-ins" },
  { key: "show_frequently_bought_together", label: "Show \"Frequently Bought Together\"", helper: "Suggest complementary products in the POS cart" },
  { key: "edit_cart_line_total", label: "Allow Editing Cart Line Total", helper: "Staff can type a line's total on the cart (back-calculates unit price)" },
];

export default function PosSettingsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["pos-settings"], queryFn: getPosSettings });
  const [values, setValues] = useState<Record<string, any>>({});
  const [receiptPaperSize, setReceiptPaperSize] = useState("80mm Thermal");

  useEffect(() => {
    if (data) {
      setValues(data);
      setReceiptPaperSize(data.receipt_paper_size ?? "80mm Thermal");
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: updatePosSettings,
    onSuccess: () => notify.success("Settings saved"),
  });

  const handleSave = () => {
    saveMutation.mutate({
      ...values,
      receipt_paper_size: receiptPaperSize,
    });
  };

  if (isLoading) return <PageLoader />;

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="POS Settings" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "POS Settings" }]} />
        </Box>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </Box>

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>While Selling</Typography>
          <Stack spacing={1}>
            {TOGGLES.map((t) => (
              <FormControlLabel
                key={t.key}
                control={
                  <Switch
                    checked={values[t.key] === "1" || values[t.key] === true || values[t.key] === 1}
                    onChange={(e) => setValues({ ...values, [t.key]: e.target.checked })}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{t.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{t.helper}</Typography>
                  </Box>
                }
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Receipt & Billing</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
            The receipt logo is always your business logo from Setup → Company Setup — update it there to change every receipt.
          </Typography>
          <Stack spacing={2}>
            <Divider />
            <Typography variant="body2" fontWeight={600}>Default Receipt Paper Size</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {["80mm Thermal", "A5 Sheet", "A4 Sheet", "Computer Sheet"].map((size) => (
                <Button
                  key={size}
                  variant={receiptPaperSize === size ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setReceiptPaperSize(size)}
                >
                  {size}
                </Button>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </FormPageLayout>
  );
}
