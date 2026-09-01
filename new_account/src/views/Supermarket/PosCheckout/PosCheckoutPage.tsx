import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Grid, Card, CardContent, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Paper, TextField, Button, Stack, IconButton, Autocomplete, Chip, Divider,
  FormControl, InputLabel, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItemButton, ListItemText,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import RestoreIcon from "@mui/icons-material/Restore";
import AddIcon from "@mui/icons-material/Add";
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
import { lookupBarcode } from "../../../api/Pos/posApi";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CakeIcon from "@mui/icons-material/Cake";
import CameraBarcodeScanDialog from "../../../components/CameraBarcodeScanDialog";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";
import { notify } from "../../../services/notificationService";
import { getFriendlyApiErrorMessage } from "../../../utils/apiErrorMessage";
import useCurrentUser from "../../../hooks/useCurrentUser";
import {
  getHeldSales, holdSale, deleteHeldSale, applyCoupon, confirmCouponUsage, redeemVoucher, getFrequentlyBoughtTogether,
  getPosSettings,
} from "../../../api/Pos/posOpsApi";
import { deductVariantStock } from "../../../api/Pos/posAdvancedApi";
import PosReceiptDialog from "../../../components/PosReceiptDialog";

const QUICK_DISCOUNTS = [5, 10, 15, 20];

interface CartLine {
  stock_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  variant_id?: number;
  variant_name?: string;
}

interface PaymentLine {
  id: string;
  bank_account_id: number | "";
  amount: string;
}

export default function PosCheckoutPage() {
  const { formatCurrency } = useHomeCurrency();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const [customer, setCustomer] = useState<any>(null);
  const [branchCode, setBranchCode] = useState<string>("");
  const [locCode, setLocCode] = useState<string>("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [qty, setQty] = useState("1");
  const [scanCode, setScanCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const { data: posSettings } = useQuery({ queryKey: ["pos-settings"], queryFn: getPosSettings });

  // Quick discount / coupon / voucher
  const [cartDiscountPercent, setCartDiscountPercent] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherAmount, setVoucherAmount] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; amount: number } | null>(null);

  // Split payments
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([{ id: "p1", bank_account_id: "", amount: "0" }]);

  // Held sales (park / recall)
  const [recallOpen, setRecallOpen] = useState(false);

  const { data: customers } = useQuery({ queryKey: ["customers-all"], queryFn: getCustomers });
  const { data: items } = useQuery({ queryKey: ["items-all"], queryFn: getItems });
  const { data: locations } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations });
  const { data: shippingCompanies } = useQuery({ queryKey: ["shipping-companies"], queryFn: getShippingCompanies });
  const { data: bankAccounts } = useQuery({ queryKey: ["bank-accounts"], queryFn: getBankAccounts });

  const cashAccount = useMemo(
    () => (bankAccounts ?? []).find((a: any) => Number(a.account_type?.id ?? a.account_type) === 4) ?? (bankAccounts ?? [])[0],
    [bankAccounts]
  );

  const { data: heldSales, refetch: refetchHeldSales } = useQuery({
    queryKey: ["held-sales", user?.id],
    queryFn: () => getHeldSales(Number(user!.id)),
    enabled: !!user?.id,
  });

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

  // Frequently bought together — suggests complements for the most recently
  // added cart line, purely a UI nudge (no accounting impact).
  const lastAddedStockId = cart.length > 0 ? cart[cart.length - 1].stock_id : null;
  const { data: frequentlyBoughtTogether } = useQuery({
    queryKey: ["fbt", lastAddedStockId],
    queryFn: () => getFrequentlyBoughtTogether(lastAddedStockId as string),
    enabled: !!lastAddedStockId,
  });

  const lineSubtotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.quantity * l.unit_price * (1 - l.discount_percent / 100), 0),
    [cart]
  );

  const couponDiscountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    return appliedCoupon.discount_type === "percent"
      ? (lineSubtotal * Number(appliedCoupon.discount_value)) / 100
      : Math.min(lineSubtotal, Number(appliedCoupon.discount_value));
  }, [appliedCoupon, lineSubtotal]);

  const cartDiscountAmount = useMemo(
    () => (lineSubtotal * cartDiscountPercent) / 100,
    [lineSubtotal, cartDiscountPercent]
  );

  const voucherApplied = appliedVoucher?.amount ?? 0;

  const subtotal = lineSubtotal;
  const grandTotal = Math.max(0, lineSubtotal - cartDiscountAmount - couponDiscountAmount - voucherApplied);

  // Combined extra discount, expressed as a single equivalent percent applied
  // uniformly across every cart line (multiplicatively, so it never exceeds
  // 100%) — this is the only vector the real invoice API exposes for
  // discounting a line, so quick-discount/coupon/voucher all flow through it.
  const extraDiscountPercent = lineSubtotal > 0
    ? (1 - (grandTotal / lineSubtotal)) * 100
    : 0;

  const totalPaid = useMemo(
    () => paymentLines.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [paymentLines]
  );
  const changeDue = Math.max(0, totalPaid - grandTotal);
  const balanceRemaining = Math.max(0, grandTotal - totalPaid);

  // Keep the scan field focused after a scan-driven cart update so a
  // handheld/USB scanner can keep firing without the cashier clicking back in.
  useEffect(() => {
    scanInputRef.current?.focus();
  }, [cart.length]);

  // Default the first payment line to the cash account, and keep its amount
  // synced to the grand total when there's only one payment line (the common
  // case) — the cashier only needs to type an amount when actually splitting.
  useEffect(() => {
    if (cashAccount && paymentLines.length === 1 && paymentLines[0].bank_account_id === "") {
      setPaymentLines([{ id: "p1", bank_account_id: cashAccount.id, amount: grandTotal.toFixed(2) }]);
    }
  }, [cashAccount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (paymentLines.length === 1) {
      setPaymentLines((prev) => [{ ...prev[0], amount: grandTotal.toFixed(2) }]);
    }
  }, [grandTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  const addItemToCart = (item: any, quantity: number) => {
    const variant = item.matched_variant;
    // A specific variant (size/color/etc.) is tracked as its own cart line —
    // it must never merge into the base product's line, since it needs its
    // own variant_id for stock deduction after checkout.
    const lineKey = variant ? `variant:${variant.id}` : item.stock_id;

    setCart((prev) => {
      const existing = prev.find((l) => (l.variant_id ? `variant:${l.variant_id}` : l.stock_id) === lineKey);
      if (existing) {
        return prev.map((l) =>
          (l.variant_id ? `variant:${l.variant_id}` : l.stock_id) === lineKey
            ? { ...l, quantity: l.quantity + quantity }
            : l
        );
      }
      return [
        ...prev,
        {
          stock_id: item.stock_id,
          description: variant ? `${item.description} (${variant.variant_name})` : item.description,
          quantity,
          unit_price: Number(item.purchase_cost) || 0,
          discount_percent: 0,
          variant_id: variant?.id,
          variant_name: variant?.variant_name,
        },
      ];
    });
  };

  const addToCart = () => {
    if (!selectedItem) return;
    addItemToCart(selectedItem, Number(qty) || 1);
    setSelectedItem(null);
    setQty("1");
  };

  /**
   * Real barcode scanning: a USB/hardware barcode scanner behaves like a
   * keyboard — it types the code very fast and sends Enter. This input
   * stays focused for continuous scanning and looks the code up against
   * item_codes (barcode) then stock_master (item code) on Enter.
   */
  const scanAndAddCode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    setScanning(true);
    try {
      const item = await lookupBarcode(trimmed);
      addItemToCart(item, Number(qty) || 1);
      notify.success(`Added: ${item.description}`);
    } catch (err: any) {
      const message = err?.response?.data?.message || `No product found for code "${trimmed}"`;
      notify.error(message);
    } finally {
      setScanning(false);
    }
  };

  const handleScanKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const code = scanCode;
    setScanCode("");
    await scanAndAddCode(code);
    scanInputRef.current?.focus();
  };

  // Optional: camera-based scanning (webcam/laptop camera), additive to the
  // primary USB-scanner "type + Enter" flow above.
  const handleCameraDetected = (code: string) => {
    setCameraOpen(false);
    scanAndAddCode(code);
  };

  const updateLine = (stockId: string, patch: Partial<CartLine>) => {
    setCart((prev) => prev.map((l) => (l.stock_id === stockId ? { ...l, ...patch } : l)));
  };

  const removeLine = (stockId: string) => {
    setCart((prev) => prev.filter((l) => l.stock_id !== stockId));
  };

  const resetSaleState = () => {
    setCart([]);
    setCartDiscountPercent(0);
    setCouponCode("");
    setAppliedCoupon(null);
    setVoucherCode("");
    setVoucherAmount("");
    setAppliedVoucher(null);
    setPaymentLines([{ id: "p1", bank_account_id: cashAccount?.id ?? "", amount: "0" }]);
  };

  const checkoutMutation = useMutation({
    mutationFn: (payload: DirectSalesInvoicePayload) => directSalesInvoice(payload),
    onSuccess: (result) => {
      notify.success("Sale completed and posted to accounts");
      setLastReceipt({ ...result, lines: cart, subtotal: grandTotal, customer });
      resetSaleState();
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

    const validPaymentLines = paymentLines.filter((p) => p.bank_account_id !== "" && (Number(p.amount) || 0) > 0);
    if (validPaymentLines.length === 0) {
      notify.error("Add at least one payment method and amount");
      return;
    }
    if (balanceRemaining > 0.01) {
      notify.error(`Payments don't cover the total — ${formatCurrency(balanceRemaining)} remaining`);
      return;
    }

    // The one place quick-discount/coupon/voucher become real accounting
    // numbers: fold the combined percent into each line's discount_percent
    // (multiplicatively, so a line's own discount and the cart-level
    // discount never exceed 100% combined) before posting the invoice.
    const combinedLines = cart.map((l) => {
      const effectivePercent = Math.min(
        99.99,
        100 * (1 - (1 - l.discount_percent / 100) * (1 - extraDiscountPercent / 100))
      );
      return {
        stock_id: l.stock_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount_percent: Number(effectivePercent.toFixed(2)),
        description: l.description,
      };
    });

    const payload: DirectSalesInvoicePayload = {
      debtor_no: customer.debtor_no,
      branch_code: Number(branchCode),
      tran_date: new Date().toISOString().slice(0, 10),
      order_type: Number(salesTypeId) || 0,
      ship_via: shipVia,
      from_stk_loc: locCode || undefined,
      cash_sale: true,
      cost_center_id: 0,
      cost_center2_id: 0,
      reference: `POS-${Date.now()}`,
      payments: validPaymentLines.map((p) => ({ bank_account_id: Number(p.bank_account_id), amount: Number(p.amount) })),
      lines: combinedLines,
    } as any;

    checkoutMutation.mutate(payload, {
      onSuccess: async (result) => {
        // Best-effort: keep each variant's supplementary stock count in sync.
        // The base product's real stock is already decremented by the
        // invoice/delivery flow above — this never touches accounting.
        for (const line of combinedLines) {
          const cartLine = cart.find((l) => l.stock_id === line.stock_id && l.quantity === line.quantity);
          if (cartLine?.variant_id && locCode) {
            try {
              await deductVariantStock(cartLine.variant_id, { loc_code: locCode, quantity: cartLine.quantity });
            } catch {
              // Non-critical — variant stock tracking is supplementary only.
            }
          }
        }

        setReceiptOpen(true);

        if (appliedVoucher) {
          try {
            await redeemVoucher({
              voucher_code: appliedVoucher.code,
              amount: appliedVoucher.amount,
              debtor_trans_no: result.trans_no,
              debtor_trans_type: result.trans_type,
            });
          } catch {
            notify.error("Sale completed, but the voucher redemption failed to record — please redeem it manually.");
          }
        }
        if (appliedCoupon) {
          try {
            await confirmCouponUsage({
              coupon_code: appliedCoupon.coupon_code,
              debtor_no: customer?.debtor_no,
              discount_amount: couponDiscountAmount,
              debtor_trans_no: result.trans_no,
              debtor_trans_type: result.trans_type,
            });
          } catch {
            // Sale already succeeded; coupon usage tracking is best-effort.
          }
        }
      },
    });
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponChecking(true);
    try {
      const offer = await applyCoupon({ coupon_code: couponCode.trim(), debtor_no: customer?.debtor_no });
      setAppliedCoupon(offer);
      notify.success(`Coupon applied: ${offer.offer_name}`);
    } catch (err: any) {
      setAppliedCoupon(null);
      notify.error(err?.response?.data?.message || "Invalid or expired coupon code");
    } finally {
      setCouponChecking(false);
    }
  };

  const handleApplyVoucher = () => {
    const amount = Number(voucherAmount) || 0;
    if (!voucherCode.trim() || amount <= 0) {
      notify.error("Enter a voucher code and an amount to apply");
      return;
    }
    setAppliedVoucher({ code: voucherCode.trim(), amount });
    notify.success(`Voucher ${voucherCode.trim()} applied for ${formatCurrency(amount)} — confirmed on checkout`);
  };

  const handleHoldSale = async () => {
    if (!user?.id || cart.length === 0) {
      notify.error("Nothing to hold — the cart is empty");
      return;
    }
    try {
      await holdSale({
        user_id: Number(user.id),
        debtor_no: customer?.debtor_no,
        cart_snapshot: { cart, customer, branchCode, locCode, cartDiscountPercent, appliedCoupon, appliedVoucher },
      });
      notify.success("Sale held — recall it any time from 'Recall Sale'");
      resetSaleState();
      queryClient.invalidateQueries({ queryKey: ["held-sales"] });
    } catch {
      notify.error("Failed to hold sale");
    }
  };

  const handleRecall = (held: any) => {
    const snap = held.cart_snapshot;
    setCart(snap.cart ?? []);
    setCustomer(snap.customer ?? null);
    setBranchCode(snap.branchCode ?? "");
    setLocCode(snap.locCode ?? "");
    setCartDiscountPercent(snap.cartDiscountPercent ?? 0);
    setAppliedCoupon(snap.appliedCoupon ?? null);
    setAppliedVoucher(snap.appliedVoucher ?? null);
    setRecallOpen(false);
    deleteHeldSale(held.id).then(() => queryClient.invalidateQueries({ queryKey: ["held-sales"] }));
  };

  const addPaymentLine = () => {
    setPaymentLines((prev) => [...prev, { id: `p${prev.length + 1}-${Date.now()}`, bank_account_id: "", amount: "0" }]);
  };

  const updatePaymentLine = (id: string, patch: Partial<PaymentLine>) => {
    setPaymentLines((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removePaymentLine = (id: string) => {
    setPaymentLines((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Box>
          <PageTitle title="POS Checkout" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "POS Checkout" }]} />
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<PauseCircleOutlineIcon />} onClick={handleHoldSale} disabled={cart.length === 0}>
            Hold Sale
          </Button>
          <Button variant="outlined" startIcon={<RestoreIcon />} onClick={() => setRecallOpen(true)}>
            Recall Sale {heldSales && heldSales.length > 0 ? `(${heldSales.length})` : ""}
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <TextField
                    inputRef={scanInputRef}
                    label="Barcode Scanner"
                    placeholder="Scan a barcode — cursor here, scan, item adds automatically"
                    size="small"
                    fullWidth
                    autoFocus
                    value={scanCode}
                    onChange={(e) => setScanCode(e.target.value)}
                    onKeyDown={handleScanKeyDown}
                    disabled={scanning}
                    InputProps={{ startAdornment: <QrCodeScannerIcon sx={{ mr: 1, color: "text.secondary" }} /> }}
                    helperText="Works with any USB/handheld barcode scanner — it types the code and presses Enter for you."
                  />
                  <Button
                    variant="outlined"
                    startIcon={<CameraAltIcon />}
                    onClick={() => setCameraOpen(true)}
                    sx={{ whiteSpace: "nowrap", mt: 0.25 }}
                  >
                    Scan with Camera
                  </Button>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Autocomplete
                    sx={{ flex: 2 }}
                    options={items ?? []}
                    getOptionLabel={(i: any) => `${i.stock_id} — ${i.description}`}
                    value={selectedItem}
                    onChange={(_, val) => setSelectedItem(val)}
                    renderInput={(params) => <TextField {...params} label="Or Search Product Manually" size="small" />}
                  />
                  <TextField label="Qty" type="number" size="small" sx={{ width: 100 }} value={qty} onChange={(e) => setQty(e.target.value)} />
                  <Button variant="contained" startIcon={<AddShoppingCartIcon />} onClick={addToCart} disabled={!selectedItem}>
                    Add
                  </Button>
                </Stack>
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

          {frequentlyBoughtTogether && frequentlyBoughtTogether.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>CUSTOMERS ALSO BOUGHT</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                {frequentlyBoughtTogether.slice(0, 6).map((r: any) => (
                  <Chip
                    key={r.stock_id}
                    label={r.description}
                    clickable
                    onClick={() => {
                      const fullItem = (items ?? []).find((i: any) => i.stock_id === r.stock_id);
                      addItemToCart(fullItem ?? { stock_id: r.stock_id, description: r.description, purchase_cost: 0 }, 1);
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}
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

              {customer?.date_of_birth && (() => {
                const dob = new Date(customer.date_of_birth);
                const today = new Date();
                return dob.getUTCMonth() === today.getMonth() && dob.getUTCDate() === today.getDate();
              })() && (
                <Chip
                  sx={{ mt: 2 }}
                  color="secondary"
                  icon={<CakeIcon />}
                  label={`It's ${customer.name}'s birthday today — consider a birthday offer!`}
                />
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

          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Discounts</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
                {QUICK_DISCOUNTS.map((pct) => (
                  <Chip
                    key={pct}
                    label={`${pct}%`}
                    color={cartDiscountPercent === pct ? "primary" : "default"}
                    onClick={() => setCartDiscountPercent(pct)}
                    clickable
                  />
                ))}
                <Chip label="Clear" variant="outlined" onClick={() => setCartDiscountPercent(0)} clickable />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <TextField
                  label="Coupon Code" size="small" fullWidth value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  disabled={!!appliedCoupon}
                />
                {appliedCoupon ? (
                  <Button variant="outlined" color="error" onClick={() => { setAppliedCoupon(null); setCouponCode(""); }}>Remove</Button>
                ) : (
                  <Button variant="outlined" onClick={handleApplyCoupon} disabled={couponChecking}>Apply</Button>
                )}
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Voucher Code" size="small" value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  disabled={!!appliedVoucher}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Amount" type="number" size="small" value={voucherAmount}
                  onChange={(e) => setVoucherAmount(e.target.value)}
                  disabled={!!appliedVoucher}
                  sx={{ width: 110 }}
                />
                {appliedVoucher ? (
                  <Button variant="outlined" color="error" onClick={() => { setAppliedVoucher(null); setVoucherCode(""); setVoucherAmount(""); }}>Remove</Button>
                ) : (
                  <Button variant="outlined" onClick={handleApplyVoucher}>Apply</Button>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Payment</Typography>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                  <Typography variant="body2" fontWeight={700}>{formatCurrency(subtotal)}</Typography>
                </Stack>
                {cartDiscountAmount > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Cart Discount ({cartDiscountPercent}%)</Typography>
                    <Typography variant="body2" color="error">-{formatCurrency(cartDiscountAmount)}</Typography>
                  </Stack>
                )}
                {couponDiscountAmount > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Coupon ({appliedCoupon?.coupon_code})</Typography>
                    <Typography variant="body2" color="error">-{formatCurrency(couponDiscountAmount)}</Typography>
                  </Stack>
                )}
                {voucherApplied > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Voucher ({appliedVoucher?.code})</Typography>
                    <Typography variant="body2" color="error">-{formatCurrency(voucherApplied)}</Typography>
                  </Stack>
                )}
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="h6">Total</Typography>
                  <Typography variant="h6" fontWeight={800}>{formatCurrency(grandTotal)}</Typography>
                </Stack>

                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mt: 1 }}>PAYMENT METHOD(S)</Typography>
                {paymentLines.map((p) => (
                  <Stack direction="row" spacing={1} key={p.id} alignItems="center">
                    <FormControl size="small" sx={{ flex: 1 }}>
                      <InputLabel>Account</InputLabel>
                      <Select
                        value={p.bank_account_id}
                        label="Account"
                        onChange={(e) => updatePaymentLine(p.id, { bank_account_id: Number(e.target.value) })}
                      >
                        {(bankAccounts ?? []).map((a: any) => (
                          <MenuItem key={a.id} value={a.id}>{a.bank_account_name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Amount" type="number" size="small" sx={{ width: 110 }}
                      value={p.amount}
                      onChange={(e) => updatePaymentLine(p.id, { amount: e.target.value })}
                    />
                    {paymentLines.length > 1 && (
                      <IconButton size="small" color="error" onClick={() => removePaymentLine(p.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                ))}
                <Button size="small" startIcon={<AddIcon />} onClick={addPaymentLine} sx={{ alignSelf: "flex-start" }}>
                  Split into another payment method
                </Button>

                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Change Due</Typography>
                  <Typography variant="body2" fontWeight={700}>{formatCurrency(changeDue)}</Typography>
                </Stack>
                {balanceRemaining > 0.01 && (
                  <Typography variant="caption" color="error">
                    {formatCurrency(balanceRemaining)} still needs to be covered by a payment method
                  </Typography>
                )}
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

      <Dialog open={recallOpen} onClose={() => setRecallOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Recall Held Sale</DialogTitle>
        <DialogContent>
          <List>
            {(heldSales ?? []).map((held: any) => (
              <ListItemButton key={held.id} onClick={() => handleRecall(held)}>
                <ListItemText
                  primary={held.cart_snapshot?.customer?.name ?? "Walk-in"}
                  secondary={`${held.cart_snapshot?.cart?.length ?? 0} item(s) · Held ${new Date(held.created_at).toLocaleString()}`}
                />
              </ListItemButton>
            ))}
            {(!heldSales || heldSales.length === 0) && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No held sales.</Typography>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecallOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <CameraBarcodeScanDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onDetected={handleCameraDetected}
      />

      <PosReceiptDialog
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        transNo={lastReceipt?.trans_no}
        customerName={lastReceipt?.customer?.name}
        lines={lastReceipt?.lines ?? []}
        total={lastReceipt?.subtotal ?? 0}
        businessLogoUrl={posSettings?.receipt_business_logo_url}
        paperSize={posSettings?.receipt_paper_size}
      />
    </FormPageLayout>
  );
}
