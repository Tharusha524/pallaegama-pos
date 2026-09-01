import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Box, Grid, Card, CardContent, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Paper, TextField, Button, Stack, IconButton, Autocomplete, Chip, Divider,
  FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import { getItems } from "../../../api/Item/ItemApi";
import { getCustomers } from "../../../api/Customer/AddCustomerApi";
import { getBranches } from "../../../api/CustomerBranch/CustomerBranchApi";
import { getInventoryLocations } from "../../../api/InventoryLocation/InventoryLocationApi";
import { getShippingCompanies } from "../../../api/ShippingCompany/ShippingCompanyApi";
import { getBankAccounts } from "../../../api/BankAccount/BankAccountApi";
import { directSalesInvoice, DirectSalesInvoicePayload } from "../../../api/SalesInvoice/SalesInvoiceApi";
import { getApplicableOffers } from "../../../api/Loyalty/loyaltyApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";
import { notify } from "../../../services/notificationService";
import { getFriendlyApiErrorMessage } from "../../../utils/apiErrorMessage";

interface CartLine {
  stock_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
}

export default function PosCheckoutPage() {
  const { formatCurrency } = useHomeCurrency();

  const [customer, setCustomer] = useState<any>(null);
  const [branchCode, setBranchCode] = useState<string>("");
  const [locCode, setLocCode] = useState<string>("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [qty, setQty] = useState("1");
  const [tenderCash, setTenderCash] = useState("0");
  const [lastReceipt, setLastReceipt] = useState<any>(null);

  const { data: customers } = useQuery({ queryKey: ["customers-all"], queryFn: getCustomers });
  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });
  const { data: locations } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations });
  const { data: shippingCompanies } = useQuery({ queryKey: ["shipping-companies"], queryFn: getShippingCompanies });
  const { data: bankAccounts } = useQuery({ queryKey: ["bank-accounts"], queryFn: getBankAccounts });

  const cashAccount = useMemo(
    () => (bankAccounts ?? []).find((a: any) => Number(a.account_type?.id ?? a.account_type) === 4) ?? (bankAccounts ?? [])[0],
    [bankAccounts]
  );

  // Note: the backend's branches index endpoint returns all branches regardless
  // of query params, so the customer filter is applied client-side here.
  const { data: allBranches } = useQuery({
    queryKey: ["customer-branches", customer?.debtor_no],
    queryFn: () => getBranches(customer.debtor_no),
    enabled: !!customer,
  });

  const branches = useMemo(
    () => (allBranches ?? []).filter((b: any) => String(b.debtor_no) === String(customer?.debtor_no)),
    [allBranches, customer]
  );

  useEffect(() => {
    if (branches.length > 0) {
      setBranchCode(String(branches[0].branch_code));
    } else {
      setBranchCode("");
    }
  }, [branches]);

  useEffect(() => {
    if (locations && locations.length > 0 && !locCode) {
      setLocCode(locations[0].loc_code);
    }
  }, [locations, locCode]);

  const { data: applicableOffers } = useQuery({
    queryKey: ["applicable-offers", customer?.debtor_no],
    queryFn: () => getApplicableOffers({ debtor_no: customer.debtor_no }),
    enabled: !!customer,
  });

  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.quantity * l.unit_price * (1 - l.discount_percent / 100), 0),
    [cart]
  );

  const changeDue = Math.max(0, (Number(tenderCash) || 0) - subtotal);

  const addToCart = () => {
    if (!selectedItem) return;
    const quantity = Number(qty) || 1;
    setCart((prev) => {
      const existing = prev.find((l) => l.stock_id === selectedItem.stock_id);
      if (existing) {
        return prev.map((l) =>
          l.stock_id === selectedItem.stock_id ? { ...l, quantity: l.quantity + quantity } : l
        );
      }
      return [
        ...prev,
        {
          stock_id: selectedItem.stock_id,
          description: selectedItem.description,
          quantity,
          unit_price: Number(selectedItem.purchase_cost) || 0,
          discount_percent: 0,
        },
      ];
    });
    setSelectedItem(null);
    setQty("1");
  };

  const updateLine = (stockId: string, patch: Partial<CartLine>) => {
    setCart((prev) => prev.map((l) => (l.stock_id === stockId ? { ...l, ...patch } : l)));
  };

  const removeLine = (stockId: string) => {
    setCart((prev) => prev.filter((l) => l.stock_id !== stockId));
  };

  const checkoutMutation = useMutation({
    mutationFn: (payload: DirectSalesInvoicePayload) => directSalesInvoice(payload),
    onSuccess: (result) => {
      notify.success("Sale completed and posted to accounts");
      setLastReceipt({ ...result, lines: cart, subtotal, customer });
      setCart([]);
      setTenderCash("0");
    },
    onError: (error) => {
      notify.error(getFriendlyApiErrorMessage(error) || "Failed to complete sale");
    },
  });

  const handleCheckout = () => {
    if (!customer || !branchCode || cart.length === 0) {
      notify.error("Select a customer and add at least one item before checkout");
      return;
    }

    const salesTypeId = customer.sales_type?.id ?? customer.sales_type ?? 0;
    const shipVia = shippingCompanies && shippingCompanies.length > 0 ? shippingCompanies[0].shipper_id : undefined;

    if (!shipVia) {
      notify.error("No shipping company configured — add one under Setup → Miscellaneous → Shipping Company");
      return;
    }
    if (!cashAccount) {
      notify.error("No cash bank account configured — add one under Banking & GL → Maintenance → Bank Accounts");
      return;
    }

    const payload: DirectSalesInvoicePayload = {
      debtor_no: customer.debtor_no,
      branch_code: Number(branchCode),
      tran_date: new Date().toISOString().slice(0, 10),
      order_type: Number(salesTypeId) || 0,
      ship_via: shipVia,
      from_stk_loc: locCode || undefined,
      cash_sale: true,
      bank_account_id: cashAccount.id,
      cost_center_id: 0,
      cost_center2_id: 0,
      reference: `POS-${Date.now()}`,
      lines: cart.map((l) => ({
        stock_id: l.stock_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount_percent: l.discount_percent,
        description: l.description,
      })),
    };

    checkoutMutation.mutate(payload);
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="POS Checkout" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "POS Checkout" }]} />
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Autocomplete
                  sx={{ flex: 2 }}
                  options={items ?? []}
                  getOptionLabel={(i: any) => `${i.stock_id} — ${i.description}`}
                  value={selectedItem}
                  onChange={(_, val) => setSelectedItem(val)}
                  renderInput={(params) => <TextField {...params} label="Scan / Search Product" size="small" autoFocus />}
                />
                <TextField label="Qty" type="number" size="small" sx={{ width: 100 }} value={qty} onChange={(e) => setQty(e.target.value)} />
                <Button variant="contained" startIcon={<AddShoppingCartIcon />} onClick={addToCart} disabled={!selectedItem}>
                  Add
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <TableContainer component={Paper} elevation={2}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="right">Disc %</TableCell>
                  <TableCell align="right">Line Total</TableCell>
                  <TableCell align="center">—</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cart.map((l) => (
                  <TableRow key={l.stock_id}>
                    <TableCell>{l.description}</TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number" size="small" value={l.quantity} sx={{ width: 70 }}
                        onChange={(e) => updateLine(l.stock_id, { quantity: Number(e.target.value) || 0 })}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number" size="small" value={l.unit_price} sx={{ width: 90 }}
                        onChange={(e) => updateLine(l.stock_id, { unit_price: Number(e.target.value) || 0 })}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number" size="small" value={l.discount_percent} sx={{ width: 70 }}
                        onChange={(e) => updateLine(l.stock_id, { discount_percent: Number(e.target.value) || 0 })}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(l.quantity * l.unit_price * (1 - l.discount_percent / 100))}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="error" onClick={() => removeLine(l.stock_id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {cart.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center"><Typography variant="body2">Cart is empty — scan or search a product to begin.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Customer</Typography>
              <Autocomplete
                options={customers ?? []}
                getOptionLabel={(c: any) => c.name ?? ""}
                value={customer}
                onChange={(_, val) => setCustomer(val)}
                renderInput={(params) => <TextField {...params} label="Customer" size="small" />}
              />

              {customer && branches && branches.length > 1 && (
                <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                  <InputLabel>Branch</InputLabel>
                  <Select value={branchCode} label="Branch" onChange={(e) => setBranchCode(e.target.value)}>
                    {branches.map((b: any) => (
                      <MenuItem key={b.branch_code} value={String(b.branch_code)}>{b.br_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {locations && locations.length > 1 && (
                <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                  <InputLabel>Stock Location</InputLabel>
                  <Select value={locCode} label="Stock Location" onChange={(e) => setLocCode(e.target.value)}>
                    {locations.map((loc: any) => (
                      <MenuItem key={loc.loc_code} value={loc.loc_code}>{loc.location_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {applicableOffers && applicableOffers.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>APPLICABLE OFFERS</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                    {applicableOffers.map((o: any) => (
                      <Chip key={o.id} label={o.offer_name} size="small" color="success" />
                    ))}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Payment</Typography>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                  <Typography variant="body2" fontWeight={700}>{formatCurrency(subtotal)}</Typography>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="h6">Total</Typography>
                  <Typography variant="h6" fontWeight={800}>{formatCurrency(subtotal)}</Typography>
                </Stack>
                <TextField
                  label="Cash Received" type="number" size="small" fullWidth
                  value={tenderCash} onChange={(e) => setTenderCash(e.target.value)}
                />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Change Due</Typography>
                  <Typography variant="body2" fontWeight={700}>{formatCurrency(changeDue)}</Typography>
                </Stack>
                <Button
                  variant="contained" size="large" startIcon={<ReceiptLongIcon />}
                  disabled={checkoutMutation.isPending || !customer || cart.length === 0}
                  onClick={handleCheckout}
                >
                  {checkoutMutation.isPending ? "Processing..." : "Complete Sale"}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {lastReceipt && (
            <Card elevation={0} sx={{ border: "1px solid", borderColor: "success.main", borderRadius: 3, mt: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} color="success.main">
                  ✓ Invoice #{lastReceipt.trans_no} posted for {lastReceipt.customer?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {lastReceipt.lines.length} item(s) · {formatCurrency(lastReceipt.subtotal)}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </FormPageLayout>
  );
}
