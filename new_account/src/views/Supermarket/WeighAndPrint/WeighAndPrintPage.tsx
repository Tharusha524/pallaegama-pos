import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Typography, Stack, TextField, Button, Autocomplete, Divider, Grid,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import JsBarcode from "jsbarcode";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import { getItems } from "../../../api/Item/ItemApi";
import { getCompanies } from "../../../api/CompanySetup/CompanySetupApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";

/**
 * For loose/weighed items (produce, bulk goods) that have no manufacturer
 * barcode — staff weighs the item, the system calculates the price for that
 * exact weight, and prints a one-off sticker encoding the frozen price
 * (WT|<stock_id>|<price>). Scanning that sticker at checkout adds the item
 * at exactly that price — never touches accounting until an actual sale
 * happens at POS Checkout.
 */
export default function WeighAndPrintPage() {
  const { formatCurrency } = useHomeCurrency();
  const [product, setProduct] = useState<any>(null);
  const [weight, setWeight] = useState("1");
  const barcodeRef = useRef<SVGSVGElement>(null);

  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });
  const { data: companies } = useQuery({ queryKey: ["company-setup-list"], queryFn: getCompanies });
  const company = companies?.[0];

  const unitPrice = Number(product?.purchase_cost) || 0;
  const weightKg = Number(weight) || 0;
  const price = Math.round(unitPrice * weightKg * 100) / 100;
  const barcodeValue = product ? `WT|${product.stock_id}|${price.toFixed(2)}` : "";

  useEffect(() => {
    if (product && barcodeRef.current && price > 0) {
      try {
        // A quiet zone (margin) around the bars is essential for camera-based
        // scanners (ZXing) to reliably locate the barcode.
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: "CODE128",
          displayValue: false,
          height: 45,
          width: 1.8,
          margin: 10,
        });
      } catch {
        // Non-fatal — barcode just won't render if the value is somehow invalid.
      }
    }
  }, [barcodeValue, product, price]);

  const handlePrint = () => window.print();

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Weigh & Print" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Weigh & Print" }]} />
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }} className="pos-receipt-no-print">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Weigh Item</Typography>
              <Stack spacing={2}>
                <Autocomplete
                  options={items ?? []}
                  getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
                  value={product}
                  onChange={(_, val) => setProduct(val)}
                  renderInput={(params) => <TextField {...params} label="Product" size="small" />}
                />
                <TextField
                  label="Weight (kg)" type="number" size="small" value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
                {product && (
                  <Typography variant="caption" color="text.secondary">
                    Price per kg: {formatCurrency(unitPrice)}
                  </Typography>
                )}
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="h6">Total Price</Typography>
                  <Typography variant="h6" fontWeight={800}>{formatCurrency(price)}</Typography>
                </Stack>
                <Button
                  variant="contained" size="large" startIcon={<PrintIcon />}
                  disabled={!product || price <= 0}
                  onClick={handlePrint}
                >
                  Print Sticker
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <style>{`
                @media print {
                  body * { visibility: hidden; }
                  #weigh-sticker-print-area, #weigh-sticker-print-area * { visibility: visible; }
                  #weigh-sticker-print-area { position: absolute; top: 0; left: 0; }
                  .pos-receipt-no-print { display: none !important; }
                }
              `}</style>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }} className="pos-receipt-no-print">Sticker Preview</Typography>
              {product ? (
                <Box
                  id="weigh-sticker-print-area"
                  sx={{ width: 260, mx: "auto", p: 1.5, border: "1px dashed", borderColor: "divider", borderRadius: 1, textAlign: "center", fontFamily: "monospace" }}
                >
                  {company?.name && <Typography fontSize={11} fontWeight={700}>{company.name}</Typography>}
                  <Typography fontSize={13} fontWeight={700} sx={{ mt: 0.5 }}>{product.description}</Typography>
                  <Typography fontSize={11} color="text.secondary">{weightKg.toFixed(3)} kg @ {formatCurrency(unitPrice)}/kg</Typography>
                  <Typography fontSize={16} fontWeight={800} sx={{ mt: 0.5 }}>{formatCurrency(price)}</Typography>
                  <Box sx={{ mt: 1 }}>
                    <svg ref={barcodeRef} />
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" className="pos-receipt-no-print">
                  Select a product and weight to preview the sticker.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </FormPageLayout>
  );
}
