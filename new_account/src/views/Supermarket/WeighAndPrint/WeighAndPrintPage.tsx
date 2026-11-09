import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Typography, Stack, TextField, Button, Autocomplete, Divider, Grid, IconButton,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import JsBarcode from "jsbarcode";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import { getItems } from "../../../api/Item/ItemApi";
import { getCompanies } from "../../../api/CompanySetup/CompanySetupApi";
import { getSalesPricingByStockId, createSalesPricing, updateSalesPricing } from "../../../api/SalesPricing/SalesPricingApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";
import { notify } from "../../../services/notificationService";
import ItemAutocomplete from "../../../components/ItemAutocomplete";

const LKR_CURRENCY_ID = 8;
const RETAIL_SALES_TYPE_ID = 3;

/**
 * For loose/weighed items (produce, bulk goods) that have no manufacturer
 * barcode — staff weighs the item, the system calculates the price for that
 * exact weight, and prints a one-off sticker encoding the frozen price
 * (WT|<stock_id>|<price>). Scanning that sticker at checkout adds the item
 * at exactly that price — never touches accounting until an actual sale
 * happens at POS Checkout.
 *
 * Price per kg comes from the real Sales Pricing table (same one Set Price
 * writes to) — never from purchase_cost, which is what we paid the
 * supplier, not what the customer should be charged.
 */
export default function WeighAndPrintPage() {
  const { formatCurrency } = useHomeCurrency();
  const [product, setProduct] = useState<any>(null);
  const [weight, setWeight] = useState("1");
  const barcodeRef = useRef<SVGSVGElement>(null);

  const queryClient = useQueryClient();
  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });
  const { data: companies } = useQuery({ queryKey: ["company-setup-list"], queryFn: getCompanies });
  const company = companies?.[0];

  const { data: pricingRows } = useQuery({
    queryKey: ["sales-pricing", product?.stock_id],
    queryFn: () => getSalesPricingByStockId(product.stock_id),
    enabled: !!product,
  });
  const currentPricing = (pricingRows ?? []).find(
    (p: any) => p.sales_type_id === RETAIL_SALES_TYPE_ID && p.currency_id === LKR_CURRENCY_ID
  );

  // Quick "set price per kg" shortcut — skips a trip to the Set Price page
  // for the one field a cashier actually needs fixed on the spot. Writes to
  // the real Sales Pricing table, same place Set Price itself writes to.
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState("");

  const savePriceMutation = useMutation({
    mutationFn: ({ price }: { price: number }) => {
      const payload = { stock_id: product.stock_id, currency_id: LKR_CURRENCY_ID, sales_type_id: RETAIL_SALES_TYPE_ID, price };
      return currentPricing ? updateSalesPricing(currentPricing.id, payload) : createSalesPricing(payload);
    },
    onSuccess: () => {
      notify.success("Price per kg updated");
      setEditingPrice(false);
      queryClient.invalidateQueries({ queryKey: ["sales-pricing", product?.stock_id] });
    },
    onError: () => notify.error("Failed to update price"),
  });

  const startEditPrice = () => {
    setPriceDraft(String(currentPricing?.price ?? "0"));
    setEditingPrice(true);
  };

  const unitPrice = Number(currentPricing?.price) || 0;
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
          width: 1,
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
                <ItemAutocomplete
                  options={items ?? []}
                  getOptionLabel={(i: any) => i.description ?? i.stock_id ?? ""}
                  value={product}
                  onChange={(_, val) => { setProduct(val); setEditingPrice(false); }}
                  renderInput={(params) => <TextField {...params} label="Product" size="small" />}
                />
                <TextField
                  label="Weight (kg)" type="number" size="small" value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
                {product && (
                  editingPrice ? (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <TextField
                        size="small" type="number" autoFocus label="Price per kg"
                        value={priceDraft}
                        onChange={(e) => setPriceDraft(e.target.value)}
                      />
                      <IconButton
                        size="small" color="success"
                        disabled={savePriceMutation.isPending}
                        onClick={() => savePriceMutation.mutate({ price: Number(priceDraft) || 0 })}
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => setEditingPrice(false)}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ) : (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography variant="caption" color={unitPrice > 0 ? "text.secondary" : "error"}>
                        Price per kg: {formatCurrency(unitPrice)}
                        {unitPrice === 0 && " — set a price to print"}
                      </Typography>
                      <IconButton size="small" onClick={startEditPrice}>
                        <EditIcon fontSize="inherit" />
                      </IconButton>
                    </Stack>
                  )
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
                    <svg ref={barcodeRef} style={{ maxWidth: "100%", height: "auto" }} />
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
