import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Grid, Card, CardContent, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Paper, TextField, Button, Stack, IconButton, Autocomplete, Chip, Divider,
  FormControl, InputLabel, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItemButton, ListItemText, Tooltip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import RestoreIcon from "@mui/icons-material/Restore";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import PersonIcon from "@mui/icons-material/Person";
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
import { createQuotation } from "../../../api/Quotations/QuotationsApi";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import { getApplicableOffers } from "../../../api/Loyalty/loyaltyApi";
import { lookupBarcode, getLowStock, getPosShifts } from "../../../api/Pos/posApi";
import { getStockList } from "../../../api/Inventory/StockListApi";
import { getSalesPricingByStockId } from "../../../api/SalesPricing/SalesPricingApi";
import { getPromotionalPrices } from "../../../api/PromotionalPrice/PromotionalPriceApi";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CakeIcon from "@mui/icons-material/Cake";
import CameraBarcodeScanDialog from "../../../components/CameraBarcodeScanDialog";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";
import { useIsSquareScreen } from "../../../hooks/useScreenAspect";
import { notify } from "../../../services/notificationService";
import { getFriendlyApiErrorMessage } from "../../../utils/apiErrorMessage";
import useCurrentUser from "../../../hooks/useCurrentUser";
import {
  getHeldSales, holdSale, deleteHeldSale, applyCoupon, confirmCouponUsage, redeemVoucher, getVoucherByCode,
  getFrequentlyBoughtTogether, getPosSettings,
} from "../../../api/Pos/posOpsApi";
import { deductVariantStock } from "../../../api/Pos/posAdvancedApi";
import { getCardTypes, tagPaymentCardType } from "../../../api/CardType/CardTypeApi";
import { getLoyaltyCards, redeemLoyaltyPoints, getLoyaltyByPhone, registerLoyaltyByPhone } from "../../../api/Loyalty/loyaltyApi";
import PosReceiptDialog from "../../../components/PosReceiptDialog";
import QuickAddCustomerDialog from "../../../components/QuickAddCustomerDialog";
import { useOnlineStatus, getOrCreateTerminalId } from "../../../offline/useOnlineStatus";
import {
  isDesktopApp, queuePendingSale, saveProductsSnapshot, saveCustomersSnapshot,
  listProducts as listOfflineProducts, listCustomers, findProductByBarcode,
  saveReferenceData, getReferenceData,
} from "../../../offline/db";
import { syncPendingSales } from "../../../offline/sync";
import WifiOffIcon from "@mui/icons-material/WifiOff";

const QUICK_DISCOUNTS = [5, 10, 15, 20];

interface CartLine {
  stock_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  // UI-only: lets the cashier type the line discount as a flat amount
  // instead of a percentage — discount_percent (above) stays the single
  // source of truth used for Net Price/Line Total and what's posted.
  discount_mode?: "percent" | "amount";
  discount_input?: string;
  variant_id?: number;
  variant_name?: string;
  mrp_price?: number;
  // The catalog price this line was added at — never shown or edited, kept
  // only so a manual unit_price edit can be flagged as a price override.
  original_unit_price?: number;
  // Wholesale — set from the product master (Set Price -> Wholesale
  // Pricing tab). wholesale_applied is only ever true after the cashier
  // enters the Wholesale Authorization PIN at checkout, never automatic.
  wholesale_qty_threshold?: number;
  wholesale_price?: number;
  wholesale_applied?: boolean;
}

interface PaymentLine {
  id: string;
  bank_account_id: number | "";
  amount: string;
  // Reporting-only tag (Visa/Mastercard/...) — shown only when the chosen
  // account's name looks like a card account. Never affects the sale.
  card_type_id?: number | "";
}

// Strips comma separators back out of a display-formatted number (e.g.
// "42,066" -> 42066) so the underlying cart value stays a clean number.
const parseFormattedNumber = (value: string): number => Number(value.replace(/,/g, "")) || 0;

export default function PosCheckoutPage() {
  // Square POS touchscreens (1024x1024, 1080x1080, ...) get a dedicated
  // compact layout further down — everything else keeps the existing
  // wide-screen layout untouched.
  const isSquareScreen = useIsSquareScreen();
  const { formatCurrency, symbol: currencySymbol } = useHomeCurrency();
  // Cart table cells show the currency once in the column header instead of
  // repeating "LKR" on every row — plain number formatting for those cells.
  const formatNumber = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Tags each sale with the cashier's open shift, for the Sales by
  // Cashier/Shift report only — not required to check out, so a missing
  // or not-yet-opened shift never blocks a sale.
  const { data: openShifts } = useQuery({
    queryKey: ["pos-open-shift", user?.id],
    queryFn: () => getPosShifts({ status: "open", user_id: user?.id }),
    enabled: !!user?.id,
  });
  const currentShiftId: number | undefined = openShifts?.[0]?.id;

  const [customer, setCustomer] = useState<any>(null);
  // Which price list to charge — a Wholesale customer gets the Wholesale
  // price list instead of always Retail. Falls back to undefined (backend
  // defaults to Retail) when the customer has no price list assigned.
  const customerSalesTypeId = Number(customer?.sales_type?.id ?? customer?.sales_type) || undefined;

  // Loyalty card for the selected customer — read-only lookup, purely to
  // show/limit how many points they can redeem right here at checkout.
  const { data: loyaltyCards } = useQuery({ queryKey: ["loyalty-cards"], queryFn: getLoyaltyCards });
  const customerLoyaltyCard = (loyaltyCards ?? []).find(
    (c: any) => c.debtor_no === customer?.debtor_no && c.status === "active"
  );
  const loyaltyRedemptionRate = Number(customerLoyaltyCard?.tier?.redemption_rate) || 0;
  const [branchCode, setBranchCode] = useState<string>("");
  const [locCode, setLocCode] = useState<string>("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  // Whatever product was last scanned or picked — feeds the "Product
  // Details" panel (S.Price / S.Code / Available Stock), matching the
  // always-visible details box the old till software showed per item.
  const [lastViewedProduct, setLastViewedProduct] = useState<any>(null);

  // Live clock for the User/Date/Time info box, matching what the old till
  // software always kept visible in its corner.
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Full-screen mode: a fixed overlay that visually covers the sidebar and
  // top ERP header, showing only the till itself — the old software always
  // ran full-screen with nothing else on the monitor. Doesn't touch
  // MainLayout/routing; it just sits on top of it at a high z-index.
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [qty, setQty] = useState("1");
  const [scanCode, setScanCode] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  // When a barcode is shared by more than one product (e.g. a generic
  // "Snack" code used for both the 50g and 100g pack), the lookup returns
  // every match instead of guessing — this holds that list so the cashier
  // can pick the right one.
  const [barcodeMatches, setBarcodeMatches] = useState<any[] | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const itemSearchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const lineDiscountInputRef = useRef<HTMLInputElement>(null);
  // Selling Price / Discount shown next to manual item search once an item
  // is picked — keyboard flow: Item -> Enter -> Discount -> Enter -> Qty ->
  // Enter -> added to cart. Discount starts blank (treated as 0 if left as is).
  const [manualSellingPrice, setManualSellingPrice] = useState("");
  const [manualSellingPriceTouched, setManualSellingPriceTouched] = useState(false);
  const [manualDiscountInput, setManualDiscountInput] = useState("");
  const [manualDiscountMode2, setManualDiscountMode2] = useState<"percent" | "amount">("percent");
  const customerInputRef = useRef<HTMLInputElement>(null);
  const paymentAmountInputRef = useRef<HTMLInputElement>(null);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [isQuoteReceipt, setIsQuoteReceipt] = useState(false);
  // Wholesale — which cart line (if any) is currently waiting on PIN entry.
  const [wholesalePinTarget, setWholesalePinTarget] = useState<string | null>(null);
  const [wholesalePinInput, setWholesalePinInput] = useState("");
  const [quickAddCustomerOpen, setQuickAddCustomerOpen] = useState(false);

  // Phone-based loyalty lookup
  const [loyaltyPhone, setLoyaltyPhone] = useState("");
  const [loyaltySearching, setLoyaltySearching] = useState(false);
  const [loyaltyRegisterOpen, setLoyaltyRegisterOpen] = useState(false);
  const [loyaltyRegisterName, setLoyaltyRegisterName] = useState("");
  const [loyaltyRegisterPhone, setLoyaltyRegisterPhone] = useState("");
  const [loyaltyCard, setLoyaltyCard] = useState<any>(null);

  // Offline mode (desktop app only): when the connection drops, sales are
  // queued locally instead of posted live, then synced back automatically
  // once it returns.
  const isOnline = useOnlineStatus();
  const isOffline = isDesktopApp() && !isOnline;
  useEffect(() => {
    if (isDesktopApp() && isOnline) {
      syncPendingSales();
      // Also pull fresh prices/customers right away, instead of waiting for
      // the 5-minute refetch interval — closes the stale-price gap as soon
      // as the connection comes back.
      queryClient.invalidateQueries({ queryKey: ["items-all"] });
      queryClient.invalidateQueries({ queryKey: ["customers-all"] });
    }
  }, [isOnline]);

  const { data: posSettings } = useQuery({ queryKey: ["pos-settings"], queryFn: getPosSettings });
  const { data: cardTypes } = useQuery({ queryKey: ["card-types"], queryFn: () => getCardTypes() });

  // Quick discount / coupon / voucher
  const [cartDiscountPercent, setCartDiscountPercent] = useState(0);
  const [manualDiscountMode, setManualDiscountMode] = useState<"percent" | "amount">("percent");
  const [manualDiscountValue, setManualDiscountValue] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [voucherChecking, setVoucherChecking] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherAmount, setVoucherAmount] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; amount: number } | null>(null);

  // Loyalty points redemption — same "flat amount deducted from the total"
  // shape as appliedVoucher above, so it folds into extraDiscountPercent the
  // same way. The points themselves are only actually deducted from the
  // customer's balance after the sale succeeds (see redeemLoyaltyPoints call
  // in checkoutMutation's onSuccess), same pattern as voucher redemption.
  const [redeemPointsInput, setRedeemPointsInput] = useState("");
  const [appliedLoyaltyRedemption, setAppliedLoyaltyRedemption] = useState<{ points: number; amount: number } | null>(null);

  // Split payments
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([{ id: "p1", bank_account_id: "", amount: "0" }]);

  // Held sales (park / recall)
  const [recallOpen, setRecallOpen] = useState(false);

  // Refetch every 5 minutes while online so the offline SQLite snapshot
  // (prices especially) doesn't go stale just because the app was left open
  // — no manual refresh needed before a price change is safe to use offline.
  // react-query pauses this automatically while the tab isn't visible and
  // resumes on focus, and it's a no-op anyway once offline.
  const { data: customersFromApi } = useQuery({
    queryKey: ["customers-all"], queryFn: getCustomers, refetchInterval: 5 * 60 * 1000,
  });
  const { data: itemsFromApi } = useQuery({
    queryKey: ["items-all"], queryFn: getItems, refetchInterval: 5 * 60 * 1000,
  });

  // Offline fallback (desktop app only): products/customers synced down to
  // SQLite the last time we were online, so checkout still works — cart,
  // barcode scan, customer pick — after an app restart with no connection.
  const [offlineItems, setOfflineItems] = useState<any[]>([]);
  const [offlineCustomers, setOfflineCustomers] = useState<any[]>([]);

  useEffect(() => {
    if (!isDesktopApp()) return;
    listOfflineProducts()
      .then((rows) =>
        setOfflineItems(rows.map((r) => ({ stock_id: r.stock_id, description: r.description, sale_price: r.unit_price })))
      )
      .catch(() => { });
    listCustomers()
      .then((rows) =>
        setOfflineCustomers(
          rows.map((r) => {
            try {
              return { ...JSON.parse(r.customer_json), debtor_no: r.debtor_no, name: r.name };
            } catch {
              return { debtor_no: r.debtor_no, name: r.name };
            }
          })
        )
      )
      .catch(() => { });
  }, []);

  // Refresh the local offline snapshot every time a fresh copy arrives from
  // the server — this is what makes offline lookups possible after a restart.
  useEffect(() => {
    if (!isDesktopApp() || !itemsFromApi || itemsFromApi.length === 0) return;
    saveProductsSnapshot(
      itemsFromApi.map((i: any) => ({
        stock_id: i.stock_id,
        barcode: i.stock_id, // best-effort: foreign/variant barcodes still need a live lookup
        description: i.description,
        unit_price: Number(i.sale_price ?? i.purchase_cost) || 0,
        updated_at: new Date().toISOString(),
      }))
    ).catch(() => { });
  }, [itemsFromApi]);

  useEffect(() => {
    if (!isDesktopApp() || !customersFromApi || customersFromApi.length === 0) return;
    // Store the whole customer record (sales_type, date_of_birth, etc.) —
    // not just the few fields the customer picker needs — so checkout
    // doesn't quietly break on a field nobody thought to cache separately.
    saveCustomersSnapshot(
      customersFromApi.map((c: any) => ({
        debtor_no: String(c.debtor_no),
        name: c.name,
        customer_json: JSON.stringify(c),
        updated_at: new Date().toISOString(),
      }))
    ).catch(() => { });
  }, [customersFromApi]);

  const customers = customersFromApi && customersFromApi.length > 0 ? customersFromApi : offlineCustomers;
  const items = itemsFromApi && itemsFromApi.length > 0 ? itemsFromApi : offlineItems;

  // Default every sale to "Walk-in Customer" — a cashier should never be
  // forced to pick a named customer just to ring up a simple cash sale.
  // Switching to a real customer (for loyalty/credit) stays one click away.
  useEffect(() => {
    if (!customer && customers && customers.length > 0) {
      const walkIn = customers.find((c: any) => c.name === "Walk-in Customer");
      if (walkIn) setCustomer(walkIn);
    }
  }, [customers, customer]);

  // Low stock — surfaced live at the till, not just as a separate report.
  const { data: lowStockItems } = useQuery({
    queryKey: ["low-stock", locCode],
    queryFn: () => getLowStock(30, locCode || undefined),
    enabled: !!locCode,
    refetchInterval: 60_000,
  });
  const lowStockStockIds = useMemo(
    () => new Set((lowStockItems ?? []).map((r: any) => r.stock_id)),
    [lowStockItems]
  );

  // Available stock at the till, matching what the old till software always
  // showed next to each scanned item — shares its cache key with the Stock
  // page, and falls back to the same offline snapshot when there's no
  // connection, so it's never a live-only lookup that can block the sale.
  const { data: stockListFromApi } = useQuery({ queryKey: ["stock-list-all"], queryFn: () => getStockList(), refetchInterval: 60_000, staleTime: 0 });
  const [offlineStockList, setOfflineStockList] = useState<any[]>([]);
  useEffect(() => {
    if (!isDesktopApp()) return;
    getReferenceData<any[]>("stock_list").then((v) => v && setOfflineStockList(v)).catch(() => { });
  }, []);
  const stockQtyByStockId = useMemo(() => {
    const list = stockListFromApi && stockListFromApi.length > 0 ? stockListFromApi : offlineStockList;
    const map = new Map<string, number>();
    for (const s of list ?? []) map.set(String(s.stock_id), Number(s.quantity) || 0);
    return map;
  }, [stockListFromApi, offlineStockList]);
  const { data: locations } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations });

  // Checkout can't even submit a sale without a shipping company and a bank
  // account to post the payment to — both are small, rarely-changing lists,
  // so cache them in SQLite the same way as products/customers instead of
  // letting a failed live call silently block every offline sale.
  const { data: shippingCompaniesFromApi } = useQuery({ queryKey: ["shipping-companies"], queryFn: getShippingCompanies });
  const { data: bankAccountsFromApi } = useQuery({ queryKey: ["bank-accounts"], queryFn: getBankAccounts });
  const [offlineShippingCompanies, setOfflineShippingCompanies] = useState<any[]>([]);
  const [offlineBankAccounts, setOfflineBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (!isDesktopApp()) return;
    getReferenceData<any[]>("shipping_companies").then((v) => v && setOfflineShippingCompanies(v)).catch(() => { });
    getReferenceData<any[]>("bank_accounts").then((v) => v && setOfflineBankAccounts(v)).catch(() => { });
    getReferenceData<any[]>("branches").then((v) => v && setOfflineBranchesAll(v)).catch(() => { });
  }, []);

  useEffect(() => {
    if (!isDesktopApp() || !shippingCompaniesFromApi || shippingCompaniesFromApi.length === 0) return;
    saveReferenceData("shipping_companies", shippingCompaniesFromApi).catch(() => { });
  }, [shippingCompaniesFromApi]);

  useEffect(() => {
    if (!isDesktopApp() || !bankAccountsFromApi || bankAccountsFromApi.length === 0) return;
    saveReferenceData("bank_accounts", bankAccountsFromApi).catch(() => { });
  }, [bankAccountsFromApi]);

  const shippingCompanies = shippingCompaniesFromApi && shippingCompaniesFromApi.length > 0 ? shippingCompaniesFromApi : offlineShippingCompanies;
  const bankAccounts = bankAccountsFromApi && bankAccountsFromApi.length > 0 ? bankAccountsFromApi : offlineBankAccounts;

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
  // of query params, so the customer filter is applied client-side here —
  // and since it's really "all branches", it's fetched once (not re-fetched
  // per customer) and cached the same way as shipping companies/bank
  // accounts, so resolving a customer's branch still works offline.
  const { data: allBranchesFromApi } = useQuery({
    queryKey: ["all-branches"],
    queryFn: () => getBranches(customer?.debtor_no ?? ""),
  });
  const [offlineBranchesAll, setOfflineBranchesAll] = useState<any[]>([]);

  useEffect(() => {
    if (!isDesktopApp() || !allBranchesFromApi || allBranchesFromApi.length === 0) return;
    saveReferenceData("branches", allBranchesFromApi).catch(() => { });
  }, [allBranchesFromApi]);

  const allBranches = allBranchesFromApi && allBranchesFromApi.length > 0 ? allBranchesFromApi : offlineBranchesAll;

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
  const loyaltyRedemptionApplied = appliedLoyaltyRedemption?.amount ?? 0;

  const subtotal = lineSubtotal;
  const grandTotal = Math.max(0, lineSubtotal - cartDiscountAmount - couponDiscountAmount - voucherApplied - loyaltyRedemptionApplied);

  // Automatic birthday offer — if it's this customer's birthday today and an
  // active "birthday" offer exists, apply its discount straight away instead
  // of just showing a reminder chip and relying on the cashier to remember.
  // Only fires once per customer selection (won't fight a cashier who's
  // already set/cleared a manual discount).
  const birthdayOfferAppliedForRef = useRef<number | null>(null);
  useEffect(() => {
    if (!customer || !applicableOffers) return;
    const birthdayOffer = applicableOffers.find((o: any) => o.offer_type === "birthday");
    if (!birthdayOffer || birthdayOfferAppliedForRef.current === customer.debtor_no) return;
    birthdayOfferAppliedForRef.current = customer.debtor_no;
    const pct = birthdayOffer.discount_type === "percent"
      ? Number(birthdayOffer.discount_value) || 0
      : (lineSubtotal > 0 ? Math.min(100, (Number(birthdayOffer.discount_value) / lineSubtotal) * 100) : 0);
    if (pct > 0) {
      setCartDiscountPercent(pct);
      notify.success(`🎂 Birthday offer applied automatically: ${birthdayOffer.offer_name}`);
    }
  }, [customer, applicableOffers, lineSubtotal]);

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

  const addItemToCart = (
    item: any,
    quantity: number,
    overrides?: { unitPrice?: number; discountPercent?: number }
  ) => {
    const variant = item.matched_variant;
    // A specific variant (size/color/etc.) is tracked as its own cart line —
    // it must never merge into the base product's line, since it needs its
    // own variant_id for stock deduction after checkout.
    const lineKey = variant ? `variant:${variant.id}` : item.stock_id;
    const catalogPrice = Number(item.sale_price ?? item.purchase_cost) || 0;
    const unitPrice = overrides?.unitPrice ?? catalogPrice;
    const discountPercent = overrides?.discountPercent ?? 0;

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
          // Charge the real Selling Price when one is set (via Set Price) —
          // purchase_cost is what we paid the supplier, never what the
          // customer should be charged. Falls back to purchase_cost only
          // when no Selling Price has been configured for this product yet.
          // The cashier can override it manually at add-time (overrides.unitPrice).
          unit_price: unitPrice,
          discount_percent: discountPercent,
          variant_id: variant?.id,
          variant_name: variant?.variant_name,
          mrp_price: item.mrp_price != null ? Number(item.mrp_price) : undefined,
          original_unit_price: catalogPrice,
          wholesale_qty_threshold: item.wholesale_qty_threshold != null ? Number(item.wholesale_qty_threshold) : undefined,
          wholesale_price: item.wholesale_price != null ? Number(item.wholesale_price) : undefined,
        },
      ];
    });
  };

  const resolveSellingPrice = async (stockId: string): Promise<number | undefined> => {
    try {
      const promos = await getPromotionalPrices({ stock_id: stockId, active_only: true });
      const today = new Date().toISOString().slice(0, 10);
      const activePromo = (Array.isArray(promos) ? promos : []).find((p: any) =>
        p.active && p.start_date <= today && p.end_date >= today
      );
      if (activePromo) return Number(activePromo.promo_price);
    } catch { /* fall through */ }
    try {
      const pricing = await getSalesPricingByStockId(stockId);
      // eslint-disable-next-line eqeqeq
      const rows = (Array.isArray(pricing) ? pricing : []).filter((p: any) => p.currency_id == 8);
      // eslint-disable-next-line eqeqeq
      return (customerSalesTypeId && rows.find((p: any) => p.sales_type_id == customerSalesTypeId)?.price)
        // eslint-disable-next-line eqeqeq
        ?? rows.find((p: any) => p.sales_type_id == 3)?.price;
    } catch { /* fall through */ }
    return undefined;
  };

  const addToCart = async () => {
    if (!selectedItem) return;
    const stockQty = stockQtyByStockId.get(String(selectedItem.stock_id)) ?? 0;
    if (stockQty <= 0) {
      notify.error(`"${selectedItem.description}" is out of stock`);
      return;
    }
    // Manual search comes from the shared item list (no sale_price field —
    // that endpoint is used across the whole ERP and must keep
    // purchase_cost meaning real cost). Fetch the real Selling Price
    // separately here so manual search charges the same correct price a
    // barcode scan of the same product would.
    //
    // Offline: skip this live call entirely — `selectedItem` already came
    // from the combined items list, which falls back to the offline SQLite
    // snapshot (unit_price) when there's no server data, so it already has
    // a usable price.
    const salePrice: number | undefined = selectedItem.sale_price;
    const catalogPrice = Number(salePrice ?? selectedItem.purchase_cost) || 0;
    const discountRaw = Math.max(0, Number(manualDiscountInput) || 0);

    // Add to cart immediately with catalog price so the row appears instantly,
    // then resolve promotional/sales pricing in the background and patch the
    // price if a better one is found — cashier sees the correct price within
    // ~0.5 s without any visible delay on Enter.
    const initialUnitPrice = manualSellingPriceTouched && manualSellingPrice !== ""
      ? Number(manualSellingPrice) || 0
      : catalogPrice;
    const initialDiscountPercent = manualDiscountMode2 === "percent"
      ? Math.min(100, discountRaw)
      : (initialUnitPrice > 0 ? Math.min(100, (discountRaw / initialUnitPrice) * 100) : 0);

    const stockId = String(selectedItem.stock_id);
    addItemToCart(
      { ...selectedItem, sale_price: salePrice },
      Number(qty) || 1,
      { unitPrice: initialUnitPrice, discountPercent: initialDiscountPercent }
    );

    if (!isOffline && !(manualSellingPriceTouched && manualSellingPrice !== "")) {
      resolveSellingPrice(stockId).then((resolved) => {
        if (resolved !== undefined) {
          const resolvedDiscountPercent = manualDiscountMode2 === "percent"
            ? Math.min(100, discountRaw)
            : (resolved > 0 ? Math.min(100, (discountRaw / resolved) * 100) : 0);
          updateLine(stockId, { unit_price: Number(resolved), original_unit_price: Number(resolved), discount_percent: resolvedDiscountPercent });
        }
      }).catch(() => { /* keep catalog price on error */ });
    }
    setSelectedItem(null);
    setQty("1");
    setManualSellingPrice("");
    setManualSellingPriceTouched(false);
    setManualDiscountInput("");
    setManualDiscountMode2("percent");
    // Keyboard-only flow (no mouse/scanner): Code -> Enter -> Qty -> Enter ->
    // added to cart -> back to Code automatically, ready for the next item.
    setTimeout(() => itemSearchInputRef.current?.focus(), 0);
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

    // Offline: skip the live API entirely and match against the local
    // SQLite snapshot (synced down the last time we were online). Only
    // covers the item's own code, not foreign/variant barcodes — those need
    // a live lookup and simply won't resolve until back online.
    if (isOffline) {
      try {
        const local = await findProductByBarcode(trimmed);
        if (!local) {
          notify.error(`No offline product found for code "${trimmed}"`);
          return;
        }
        addItemToCart({ stock_id: local.stock_id, description: local.description, sale_price: local.unit_price }, Number(qty) || 1);
        setLastViewedProduct({ stock_id: local.stock_id, description: local.description, sale_price: local.unit_price });
        notify.success(`Added: ${local.description}`);
      } catch {
        notify.error("Offline lookup failed");
      }
      return;
    }

    try {
      const result = await lookupBarcode(trimmed, customerSalesTypeId);
      if (result?.matches) {
        setBarcodeMatches(result.matches);
        return;
      }
      if ((stockQtyByStockId.get(String(result.stock_id)) ?? result.quantity ?? 0) <= 0) {
        notify.error(`"${result.description}" is out of stock`);
        return;
      }
      addItemToCart(result, Number(qty) || 1);
      setLastViewedProduct(result);
      notify.success(`Added: ${result.description}`);
    } catch (err: any) {
      const message = err?.response?.data?.message || `No product found for code "${trimmed}"`;
      notify.error(message);
    }
  };

  const handlePickBarcodeMatch = (item: any) => {
    if ((stockQtyByStockId.get(String(item.stock_id)) ?? item.quantity ?? 0) <= 0) {
      notify.error(`"${item.description}" is out of stock`);
      setBarcodeMatches(null);
      return;
    }
    addItemToCart(item, Number(qty) || 1);
    setLastViewedProduct(item);
    notify.success(`Added: ${item.description}`);
    setBarcodeMatches(null);
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

  const confirmWholesalePin = () => {
    if (!wholesalePinTarget) return;
    const correctPin = posSettings?.wholesale_pin;
    if (!correctPin) {
      notify.error("No Wholesale Authorization PIN has been set — set one under Supermarket → POS Settings");
      return;
    }
    if (wholesalePinInput !== correctPin) {
      notify.error("Incorrect PIN");
      return;
    }
    const line = cart.find((l) => l.stock_id === wholesalePinTarget);
    if (line?.wholesale_price != null) {
      updateLine(wholesalePinTarget, { unit_price: line.wholesale_price, wholesale_applied: true });
    }
    setWholesalePinTarget(null);
    setWholesalePinInput("");
  };

  // Alt+W — open the Wholesale PIN dialog for the last cart line that
  // qualifies (qty >= threshold, wholesale_applied not yet set).
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (!e.altKey || e.key !== "w") return;
      e.preventDefault();
      if (wholesalePinTarget) return; // dialog already open
      const eligible = [...cart]
        .reverse()
        .find(
          (l) =>
            !l.wholesale_applied &&
            l.wholesale_price != null &&
            l.wholesale_qty_threshold != null &&
            l.quantity >= l.wholesale_qty_threshold
        );
      if (!eligible) {
        notify.error("No cart line qualifies for wholesale pricing");
        return;
      }
      setWholesalePinTarget(eligible.stock_id);
      setWholesalePinInput("");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart, wholesalePinTarget]);

  const resetSaleState = () => {
    setCart([]);
    setCartDiscountPercent(0);
    setCouponCode("");
    setAppliedCoupon(null);
    setVoucherCode("");
    setVoucherAmount("");
    setAppliedVoucher(null);
    setRedeemPointsInput("");
    setAppliedLoyaltyRedemption(null);
    setPaymentLines([{ id: "p1", bank_account_id: cashAccount?.id ?? "", amount: "0" }]);
    // Reset to Walk-in for the next sale — never carry a customer over.
    const walkIn = (customers ?? []).find((c: any) => c.name === "Walk-in Customer");
    setCustomer(walkIn ?? null);
  };

  const handleLoyaltyPhoneLookup = async () => {
    if (!loyaltyPhone.trim()) return;
    setLoyaltySearching(true);
    try {
      const card = await getLoyaltyByPhone(loyaltyPhone.trim());
      setLoyaltyCard(card);
      // Auto-select the customer in checkout
      const match = (customers ?? []).find((c: any) => String(c.debtor_no) === String(card.debtor_no));
      if (match) setCustomer(match);
      notify.success(`Loyalty customer found: ${card.debtor?.name} — ${card.points_balance} pts`);
    } catch (err: any) {
      if (err?.response?.status === 404 && err?.response?.data?.debtor) {
        // Customer exists in debtors but no loyalty account yet
        notify.info("Customer found but no loyalty account. Register below.");
        setLoyaltyRegisterPhone(loyaltyPhone.trim());
        setLoyaltyRegisterOpen(true);
      } else if (err?.response?.status === 404) {
        // No customer at all
        setLoyaltyRegisterPhone(loyaltyPhone.trim());
        setLoyaltyRegisterOpen(true);
      } else {
        notify.error("Phone lookup failed");
      }
    } finally {
      setLoyaltySearching(false);
    }
  };

  const handleLoyaltyRegister = async () => {
    if (!loyaltyRegisterName || !loyaltyRegisterPhone) return;
    try {
      const card = await registerLoyaltyByPhone({ name: loyaltyRegisterName, mobile: loyaltyRegisterPhone });
      setLoyaltyCard(card);
      const match = (customers ?? []).find((c: any) => String(c.debtor_no) === String(card.debtor_no));
      if (match) setCustomer(match);
      notify.success(`Loyalty customer registered: ${card.debtor?.name}`);
      setLoyaltyRegisterOpen(false);
      setLoyaltyRegisterName("");
      setLoyaltyRegisterPhone("");
    } catch (err: any) {
      notify.error(err?.response?.data?.message || "Registration failed");
    }
  };

  const checkoutMutation = useMutation({
    mutationFn: (payload: DirectSalesInvoicePayload) => directSalesInvoice(payload),
    onSuccess: (result) => {
      notify.success("Sale completed and posted to accounts");
      const receiptPayments = paymentLines
        .filter((p) => p.bank_account_id !== "" && (Number(p.amount) || 0) > 0)
        .map((p) => ({
          method: (bankAccounts ?? []).find((a: any) => a.id === p.bank_account_id)?.bank_account_name ?? "Payment",
          amount: Number(p.amount) || 0,
        }));
      setLastReceipt({ ...result, lines: cart, subtotal: grandTotal, customer, payments: receiptPayments, cashReceived: totalPaid, couponCode: appliedCoupon?.coupon_code, voucherCode: appliedVoucher?.code, shift_id: currentShiftId });
      resetSaleState();
    },
    onError: (error) => {
      notify.error(getFriendlyApiErrorMessage(error) || "Failed to complete sale");
    },
  });

  // Let the cashier hit Enter anywhere on the page to complete the sale,
  // same as clicking "Complete Sale" — but not while Enter is being used
  // for its own purpose in a text field (barcode scan box, voucher/coupon
  // code, or any other free-text input/textarea).
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      // Always read the latest cart/customer/payment state through the ref
      // (see keyboardShortcutStateRef above) instead of closing over it
      // here, since this listener is registered once on mount.
      const s = keyboardShortcutStateRef.current;

      // F9/F12/Esc — familiar function-key shortcuts from the old till
      // software the client is used to. These work regardless of focus,
      // same as Enter below, since a scanner/keyboard-only cashier
      // shouldn't need the mouse for common actions.
      if (e.key === "F9") {
        e.preventDefault();
        scanInputRef.current?.focus();
        return;
      }
      if (e.key === "Home") {
        // Matches the client's old till software: Home swaps focus between
        // the Barcode Scanner and the manual Item Code/Search field — away
        // from whichever one you're currently on, toward the other. Doesn't
        // touch Home's normal cursor behavior in any other input (Qty,
        // Payment Amount, Customer, Coupon/Voucher, Discount, ...).
        const active = document.activeElement;
        const target = e.target as HTMLElement | null;
        const isOtherInput =
          (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") &&
          active !== scanInputRef.current && active !== itemSearchInputRef.current;
        if (isOtherInput) return;
        e.preventDefault();
        if (active === scanInputRef.current) {
          itemSearchInputRef.current?.focus();
        } else {
          scanInputRef.current?.focus();
        }
        return;
      }
      if (e.key === "F11") {
        e.preventDefault();
        setIsFullScreen((v) => !v);
        return;
      }
      if (e.key === "F12") {
        e.preventDefault();
        if (s.cart.length === 0 || window.confirm("Start a new bill? Current cart will be cleared.")) {
          s.resetSaleState();
        }
        return;
      }
      if (e.key === "Escape") {
        if (s.cart.length > 0 && window.confirm("Clear the current bill? This does not undo a completed sale.")) {
          s.resetSaleState();
        }
        return;
      }
      if (e.key === "F10") {
        e.preventDefault();
        if (s.cart.length > 0) s.handleHoldSale();
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        if (!s.checkoutPending && s.customer && s.cart.length > 0 && s.cashAccount) s.handleCheckout();
        return;
      }
      if (e.key === "F3") {
        e.preventDefault();
        if (!s.quotePending && s.customer && s.cart.length > 0) s.handleGiveQuote();
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        qtyInputRef.current?.focus();
        return;
      }
      if (e.key === "F5") {
        e.preventDefault();
        customerInputRef.current?.focus();
        return;
      }
      if (e.key === "F6") {
        e.preventDefault();
        paymentAmountInputRef.current?.focus();
        return;
      }
      if (e.ctrlKey && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        setCartDiscountPercent(QUICK_DISCOUNTS[Number(e.key) - 1]);
        return;
      }
      if (e.ctrlKey && e.key === "Delete") {
        e.preventDefault();
        if (s.cart.length > 0) s.removeLine(s.cart[s.cart.length - 1].stock_id);
        return;
      }

      if (e.key !== "Enter") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (s.checkoutPending || !s.customer || s.cart.length === 0 || !s.cashAccount) return;
      e.preventDefault();
      s.handleCheckout();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
      notify.error(`Payments don't cover the total — ${formatCurrency(balanceRemaining, 2)} remaining`);
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

    // Flags any line where the cashier typed a different unit price than
    // the catalog price it was added at — audit trail only, the sale still
    // posts at whatever unit_price is on the line either way.
    const priceOverrides = cart
      .filter((l) => l.original_unit_price != null && Math.abs(l.unit_price - l.original_unit_price) > 0.01)
      .map((l) => ({
        stock_id: l.stock_id,
        original_price: l.original_unit_price,
        new_price: l.unit_price,
      }));

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
      pos_shift_id: currentShiftId,
      price_overrides: priceOverrides.length > 0 ? priceOverrides : undefined,
      payments: validPaymentLines.map((p) => ({ bank_account_id: Number(p.bank_account_id), amount: Number(p.amount) })),
      lines: combinedLines,
    } as any;

    // Offline (desktop app, no connection): don't call the live API — queue
    // the sale locally with a UUID + terminal/cashier id so it can't collide
    // with another terminal's offline sale, and still print a receipt from
    // the local data. It's pushed to Laravel automatically once back online.
    if (isOffline) {
      const uuid = crypto.randomUUID();
      const receiptPayments = validPaymentLines.map((p) => ({
        method: (bankAccounts ?? []).find((a: any) => a.id === p.bank_account_id)?.bank_account_name ?? "Cash",
        amount: Number(p.amount) || 0,
      }));
      queuePendingSale({
        uuid,
        terminal_id: getOrCreateTerminalId(),
        cashier_id: String(user?.id ?? user?.email ?? "unknown"),
        customer_id: customer?.debtor_no ?? null,
        payload: JSON.stringify(payload),
        total: grandTotal,
        created_at: new Date().toISOString(),
      }).catch(() => {
        notify.error("Could not save this sale offline — please retry");
      });

      notify.success("Sale saved offline — it will sync automatically once the connection is back");
      setIsQuoteReceipt(false);
      setLastReceipt({
        trans_no: uuid.slice(0, 8).toUpperCase(),
        lines: cart,
        subtotal: grandTotal,
        customer,
        payments: receiptPayments,
        cashReceived: totalPaid,
        couponCode: appliedCoupon?.coupon_code,
        voucherCode: appliedVoucher?.code,
        shift_id: currentShiftId,
      });
      setReceiptOpen(true);
      resetSaleState();
      return;
    }

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

        setIsQuoteReceipt(false);
        setReceiptOpen(true);

        // Card Type tag — purely a reporting label, written after the sale
        // is already posted. Best-effort: never blocks or undoes the sale.
        for (const p of validPaymentLines) {
          if (!p.card_type_id) continue;
          try {
            await tagPaymentCardType({
              debtor_trans_no: result.trans_no,
              debtor_trans_type: result.trans_type,
              bank_account_id: Number(p.bank_account_id),
              card_type_id: Number(p.card_type_id),
            });
          } catch {
            // Non-critical — reporting tag only.
          }
        }

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
        if (appliedLoyaltyRedemption && customer?.debtor_no) {
          try {
            await redeemLoyaltyPoints({
              debtor_no: customer.debtor_no,
              points: appliedLoyaltyRedemption.points,
              debtor_trans_no: result.trans_no,
              debtor_trans_type: result.trans_type,
            });
          } catch {
            notify.error("Sale completed, but the loyalty points redemption failed to record — please redeem it manually.");
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

  // "Give Quote" — a price estimate the customer can take away, not a real
  // sale. Uses the ERP's already-existing Sales Quotation feature (real FA
  // sales_orders record, trans_type 32) — recorded and retrievable, but
  // deliberately posts no GL entries and deducts no stock, since nothing
  // has actually been sold yet. Only becomes an accounting transaction if
  // it's later converted into an actual sale.
  const quoteMutation = useMutation({
    mutationFn: createQuotation,
    onSuccess: (result) => {
      notify.success(`Quotation #${result?.quotation?.order_no ?? ""} created — not a sale, no stock or accounts affected`);
      // Printed on the same receipt layout/printer as a sale — there's only
      // one printer on site, so a separate PDF quotation format isn't usable.
      setIsQuoteReceipt(true);
      setLastReceipt({
        trans_no: result?.quotation?.order_no ?? "",
        lines: cart,
        subtotal: grandTotal,
        customer,
      });
      setReceiptOpen(true);
    },
    onError: (err: any) => {
      notify.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to create quotation");
    },
  });

  const handleGiveQuote = () => {
    if (!customer || cart.length === 0) {
      notify.error("Select a customer and add at least one item before giving a quote");
      return;
    }

    const salesTypeId = customer.sales_type?.id ?? customer.sales_type ?? 0;
    const shipVia = shippingCompanies && shippingCompanies.length > 0 ? shippingCompanies[0].shipper_id : undefined;

    if (!Number(salesTypeId)) {
      notify.error("This customer has no price list (sales type) set — set one before giving a quote");
      return;
    }
    if (!locCode) {
      notify.error("Select a stock location first");
      return;
    }

    quoteMutation.mutate({
      quotation_number: `POSQ-${Date.now()}`,
      trans_type: 32,
      debtor_no: customer.debtor_no,
      branch_code: branchCode || undefined,
      reference: `POS-QUOTE-${Date.now()}`,
      quotation_date: new Date().toISOString().slice(0, 19).replace("T", " "),
      order_type: Number(salesTypeId),
      ship_via: shipVia != null ? String(shipVia) : undefined,
      from_stk_loc: locCode,
      details: cart.map((l) => ({
        stk_code: l.stock_id,
        trans_type: 32,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount_percent: l.discount_percent,
      })),
    });
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    // Coupon/voucher balances live on the server — trusting a locally cached
    // value while offline risks two offline terminals both redeeming the
    // same one. Safer to just defer this until back online.
    if (isOffline) {
      notify.error("Coupons can't be verified offline — apply this once the connection is back");
      return;
    }
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

  const handleApplyVoucher = async (scannedCode?: string) => {
    const code = (scannedCode ?? voucherCode).trim();
    if (!code) {
      notify.error("Enter or scan a voucher code");
      return;
    }
    // Same reasoning as coupons — a voucher's balance can't be trusted
    // offline, since another terminal could be redeeming it at the same time.
    if (isOffline) {
      notify.error("Vouchers can't be verified offline — apply this once the connection is back");
      return;
    }

    // Validate the voucher for real — exists, still active, not expired,
    // has enough balance — BEFORE it ever touches the sale total. Applying
    // it blind and only checking at redemption time (after the sale posts)
    // meant a fake/expired/insufficient voucher could discount a completed
    // sale with nothing backing it.
    setVoucherChecking(true);
    try {
      const voucher = await getVoucherByCode(code);
      if (!voucher || voucher.status !== "active") {
        notify.error("This voucher is not active");
        return;
      }
      if (voucher.expiry_date && new Date(voucher.expiry_date) < new Date(new Date().toDateString())) {
        notify.error("This voucher has expired");
        return;
      }

      // Barcode scan gives us only the code, not an amount — default to the
      // full voucher balance (capped to what's still owed) so a scan applies
      // the voucher in one motion. A manually typed amount is still honoured.
      const typedAmount = Number(voucherAmount) || 0;
      const amount = typedAmount > 0 ? typedAmount : Math.min(Number(voucher.balance), grandTotal);

      if (amount <= 0) {
        notify.error("Enter an amount to apply");
        return;
      }
      if (Number(voucher.balance) < amount) {
        notify.error(`Insufficient voucher balance — only ${formatCurrency(voucher.balance, 2)} left`);
        return;
      }

      setAppliedVoucher({ code, amount });
      notify.success(`Voucher ${code} applied for ${formatCurrency(amount, 2)}`);
    } catch {
      notify.error("Voucher not found");
    } finally {
      setVoucherChecking(false);
    }
  };

  // Voucher cards are printed with a barcode; a barcode-scanner types the
  // code into this field and fires an Enter keystroke — catch that and
  // apply the voucher immediately instead of waiting for a button click.
  const handleVoucherCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !appliedVoucher && !voucherChecking) {
      e.preventDefault();
      handleApplyVoucher(voucherCode);
    }
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

  // The global keydown listener below is registered once (so it doesn't
  // thrash the DOM listener on every keystroke) but still needs to act on
  // whatever is on screen *right now* — cart edits, a newly-typed payment
  // amount, the cash account finishing its load, etc. Closing over those
  // directly in the listener would freeze them at registration time, so
  // instead we keep a ref that's refreshed every render and read through
  // it inside the listener.
  const keyboardShortcutStateRef = useRef({
    cart, customer, cashAccount,
    checkoutPending: checkoutMutation.isPending,
    quotePending: quoteMutation.isPending,
    handleCheckout, handleGiveQuote, handleHoldSale, resetSaleState, removeLine,
  });
  useEffect(() => {
    keyboardShortcutStateRef.current = {
      cart, customer, cashAccount,
      checkoutPending: checkoutMutation.isPending,
      quotePending: quoteMutation.isPending,
      handleCheckout, handleGiveQuote, handleHoldSale, resetSaleState, removeLine,
    };
  });

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

  // Full-screen: skip FormPageLayout's normal page container and instead
  // cover the entire viewport (sidebar + top ERP header included) at a high
  // z-index — nothing in MainLayout/routing needs to change for this.
  // Split into header/body so full-screen can pin the header and only let
  // the body scroll internally — the whole page never scrolls away from it.
  const headerContent = (
    <>
      <Box
        sx={{
          p: isSquareScreen ? 1 : 2, boxShadow: 2, borderRadius: 1, mb: isSquareScreen ? 1 : 2,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1,
        }}
      >
        <Box>
          {!isFullScreen && (
            <>
              <PageTitle title="POS Checkout" />
              <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "POS Checkout" }]} />
            </>
          )}
          {/* User / Date / Time / Receipt — the always-visible info box the
              old till software kept in its corner. Receipt # is only known
              once the sale actually posts (assigned by the server), so it
              shows "New" until then instead of a fake number. Dropped on
              square screens — not essential to the checkout workflow, and
              every bit of vertical space matters there. */}
          {!isSquareScreen && (
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">User: <b>{user?.first_name || user?.email || "—"}</b></Typography>
              <Typography variant="caption" color="text.secondary">Date: <b>{now.toLocaleDateString()}</b></Typography>
              <Typography variant="caption" color="text.secondary">Time: <b>{now.toLocaleTimeString()}</b></Typography>
              <Typography variant="caption" color="text.secondary">Receipt: <b>{lastReceipt ? `#${lastReceipt.trans_no}` : "New"}</b></Typography>
            </Stack>
          )}
          {isOffline && (
            <Chip
              icon={<WifiOffIcon />}
              label="Offline Mode — sales are being saved locally and will sync automatically"
              color="warning"
              size="small"
              sx={{ mt: 1 }}
            />
          )}
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
          <Button
            variant="contained" color="primary" size={isSquareScreen ? "small" : "medium"}
            startIcon={<SearchIcon />} onClick={() => scanInputRef.current?.focus()}
            sx={{ minHeight: isSquareScreen ? 34 : 44 }}
          >
            {isSquareScreen ? "Find" : "Find (F9)"}
          </Button>
          <Button
            variant="contained" color="warning" size={isSquareScreen ? "small" : "medium"}
            startIcon={<PauseCircleOutlineIcon />} onClick={handleHoldSale} disabled={cart.length === 0}
            sx={{ minHeight: isSquareScreen ? 34 : 44 }}
          >
            Hold Sale
          </Button>
          <Button
            variant="contained" color="info" size={isSquareScreen ? "small" : "medium"}
            startIcon={<RestoreIcon />} onClick={() => setRecallOpen(true)}
            sx={{ minHeight: isSquareScreen ? 34 : 44 }}
          >
            Recall Sale {heldSales && heldSales.length > 0 ? `(${heldSales.length})` : ""}
          </Button>
          <Button
            variant="contained" color="error" size={isSquareScreen ? "small" : "medium"}
            startIcon={<CloseIcon />}
            onClick={() => {
              if (cart.length === 0 || window.confirm("Clear the current bill? This does not undo a completed sale.")) {
                resetSaleState();
              }
            }}
            sx={{ minHeight: isSquareScreen ? 34 : 44 }}
          >
            {isSquareScreen ? "Close" : "Close (Esc)"}
          </Button>
          <Button
            variant="contained" color="success" size={isSquareScreen ? "small" : "medium"}
            startIcon={<AddIcon />}
            onClick={() => {
              if (cart.length === 0 || window.confirm("Start a new bill? Current cart will be cleared.")) {
                resetSaleState();
              }
            }}
            sx={{ minHeight: isSquareScreen ? 34 : 44 }}
          >
            {isSquareScreen ? "New" : "New (F12)"}
          </Button>
          <Button
            variant="contained" color="secondary" size={isSquareScreen ? "small" : "medium"}
            startIcon={isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            onClick={() => setIsFullScreen((v) => !v)}
            sx={{ minHeight: isSquareScreen ? 34 : 44 }}
          >
            {isSquareScreen ? (isFullScreen ? "Exit Full Screen" : "Full Screen") : (isFullScreen ? "Exit Full Screen (F11)" : "Full Screen (F11)")}
          </Button>
          <Tooltip title={isFullScreen ? "Exit Full Screen" : "Full Screen"}>
            <IconButton onClick={() => setIsFullScreen((v) => !v)} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
              {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </>
  );

  // Square POS touchscreens (≈1:1 aspect ratio — 1024x1024, 1080x1080,
  // 1280x1024, ...) get this dedicated compact layout instead of the
  // wide-screen Grid below: cart gets the majority of vertical space, and
  // Customer/Discount/Payment/Coupon/Voucher/Totals sit in one compact
  // multi-column bottom panel instead of a tall right sidebar, since a
  // square screen has width to spare but not height. Same state/handlers
  // as the wide layout — no duplicated business logic, only layout.
  const squareLayoutContent = (
    <Box
      sx={{
        display: "flex", flexDirection: "column", gap: 1.5,
        // flex:1 on a direct flex-item child of a flex column parent is a
        // far more reliable way to fill available vertical space than a
        // percentage height nested a few levels deep — that's what was
        // actually failing (content just grew past the screen edge with
        // nothing to stop it, instead of being capped).
        ...(isFullScreen ? { flex: "1 1 auto", minHeight: 0, overflowY: "auto" } : { minHeight: 0 }),
      }}
    >
      {/* Compact: size="small" fields + tight padding, so this card leaves
          as much room as possible for the cart/checkout panel below on a
          short square screen, while still keeping a real (44px) touch
          target via minHeight on the inputs — not shrunk to the point of
          being hard to tap. */}
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, flexShrink: 0 }}>
        <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
          <Stack spacing={0.75}>
            <TextField
              inputRef={scanInputRef}
              label="Barcode Scanner"
              placeholder="Scan a barcode — cursor here, scan, item adds automatically"
              size="small"
              fullWidth
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={handleScanKeyDown}
              InputProps={{
                startAdornment: <QrCodeScannerIcon sx={{ mr: 1, color: "text.secondary" }} />,
                sx: { minHeight: 44 },
              }}
            />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Autocomplete
                size="small"
                sx={{ flex: "1 1 220px" }}
                options={items ?? []}
                getOptionLabel={(i: any) => `${i.stock_id} — ${i.description}`}
                autoHighlight
                value={selectedItem}
                onChange={(_, val) => {
                  setSelectedItem(val);
                  setLastViewedProduct(val);
                  setManualSellingPrice(val ? String(Number(val.sale_price ?? val.purchase_cost) || 0) : "");
                  setManualSellingPriceTouched(false);
                  setManualDiscountInput("");
                  setManualDiscountMode2("percent");
                  if (val && !isOffline) {
                    resolveSellingPrice(String(val.stock_id)).then((sp) => {
                      if (sp != null) {
                        setManualSellingPrice(String(Number(sp)));
                        setManualSellingPriceTouched(false);
                      }
                    }).catch(() => { });
                  }
                  if (val) setTimeout(() => { lineDiscountInputRef.current?.focus(); lineDiscountInputRef.current?.select(); }, 0);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Item Code / Search Product"
                    sx={{ "& .MuiInputBase-root": { minHeight: 44 } }}
                    inputRef={(node) => {
                      const paramsInputRef = (params as any).inputRef;
                      if (typeof paramsInputRef === "function") paramsInputRef(node);
                      else if (paramsInputRef) paramsInputRef.current = node;
                      itemSearchInputRef.current = node;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "End" && !selectedItem && !itemSearchInputRef.current?.value) {
                        e.preventDefault();
                        paymentAmountInputRef.current?.focus();
                        paymentAmountInputRef.current?.select();
                      }
                    }}
                  />
                )}
              />
              {selectedItem && (
                <>
                  <TextField
                    label="Selling Price" type="number" size="small" sx={{ width: 100, "& .MuiInputBase-root": { minHeight: 44 } }}
                    value={manualSellingPrice}
                    onChange={(e) => { setManualSellingPrice(e.target.value); setManualSellingPriceTouched(true); }}
                  />
                  <TextField
                    inputRef={lineDiscountInputRef}
                    label="Discount" type="number" size="small" sx={{ width: 80, "& .MuiInputBase-root": { minHeight: 44 } }}
                    placeholder="0"
                    value={manualDiscountInput}
                    onChange={(e) => setManualDiscountInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      qtyInputRef.current?.focus();
                      qtyInputRef.current?.select();
                    }}
                  />
                  <FormControl size="small" sx={{ width: 64 }}>
                    <Select
                      value={manualDiscountMode2}
                      onChange={(e) => setManualDiscountMode2(e.target.value as "percent" | "amount")}
                    >
                      <MenuItem value="percent">%</MenuItem>
                      <MenuItem value="amount">Rs</MenuItem>
                    </Select>
                  </FormControl>
                </>
              )}
              <TextField
                inputRef={qtyInputRef}
                label="Qty" type="number" size="small" sx={{ width: 90, "& .MuiInputBase-root": { minHeight: 44 } }} value={qty}
                onChange={(e) => setQty(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && selectedItem) { e.preventDefault(); addToCart(); } }}
              />
              <Button
                variant="contained" startIcon={<AddShoppingCartIcon />} onClick={addToCart} disabled={!selectedItem}
                sx={{ minHeight: 44, px: 2.5 }}
              >
                Add
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Cart — the main working area, gets whatever vertical space is left
          over after the search card above and checkout panel below. */}
      <TableContainer
        component={Paper} elevation={0}
        sx={{
          border: "1px solid", borderColor: "divider", borderRadius: 3, overflowY: "auto",
          // Capped rather than a bare flex:1 — guarantees the checkout
          // panel below always gets its space, instead of the cart
          // potentially consuming all of it if the flex-height chain
          // doesn't resolve cleanly in every browser/zoom combination.
          // A genuinely FIXED height (not a min/max range) — the cart box
          // never resizes as items are added or removed, so the checkout
          // panel below it never moves. Extra items scroll inside this
          // box instead (sticky header stays put while scrolling).
          flex: "0 0 auto", height: isFullScreen ? "32vh" : 320,
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ "& .MuiTableCell-root": { backgroundColor: "#79c4faff" } }}>
              <TableCell>Item</TableCell>
              <TableCell align="center">Qty</TableCell>
              <TableCell align="right">Unit Price</TableCell>
              <TableCell align="right">Disc %</TableCell>
              <TableCell align="right">Net Price</TableCell>
              <TableCell align="right">Line Total</TableCell>
              <TableCell align="center">—</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cart.map((l) => (
              <TableRow key={l.stock_id} hover>
                <TableCell>{l.description}</TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                    <IconButton size="small" sx={{ width: 44, height: 44 }} onClick={() => updateLine(l.stock_id, { quantity: Math.max(1, l.quantity - 1) })}>
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                    <Typography sx={{ minWidth: 28, textAlign: "center" }}>{l.quantity}</Typography>
                    <IconButton size="small" sx={{ width: 44, height: 44 }} onClick={() => updateLine(l.stock_id, { quantity: l.quantity + 1 })}>
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
                <TableCell align="right">{formatNumber(l.unit_price)}</TableCell>
                <TableCell align="right">{l.discount_percent || 0}%</TableCell>
                <TableCell align="right">{formatNumber(l.unit_price * (1 - l.discount_percent / 100))}</TableCell>
                <TableCell align="right">
                  <Typography fontWeight={700}>{formatNumber(l.quantity * l.unit_price * (1 - l.discount_percent / 100))}</Typography>
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small" color="error" sx={{ width: 44, height: 44 }} onClick={() => removeLine(l.stock_id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {cart.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><Typography variant="body2" color="text.secondary">Cart is empty — scan or search a product to begin.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Bottom checkout panel — Customer/Location/Discount, Payment +
          Coupon/Voucher, and Totals arranged in a compact 3-column grid
          (stacks to 1 column only on a genuinely narrow width), with
          Complete Sale / Give Quote always visible underneath — never
          needs scrolling to reach. */}
      {/* Checkout panel — split in two so the persistent summary/action bar
          (Total, Change Due, Give Quote, Complete Sale) is NEVER inside a
          scrollable area and can never disappear off-screen. Customer/
          Payment/Coupon/Voucher are secondary details — if they don't all
          fit at once on an 800x800 screen, only THIS smaller section
          scrolls internally, never the whole page and never the summary. */}
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Box sx={{ overflowY: "auto", maxHeight: isFullScreen ? "26vh" : 260, p: 1.25 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <Stack spacing={0.75}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">CUSTOMER</Typography>
              <Stack direction="row" spacing={0.5}>
                <TextField
                  size="small" fullWidth
                  label="Phone Number (Loyalty)"
                  value={loyaltyPhone}
                  onChange={(e) => setLoyaltyPhone(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleLoyaltyPhoneLookup(); }}
                  placeholder="07XXXXXXXX"
                />
                <Button size="small" variant="outlined" onClick={handleLoyaltyPhoneLookup} disabled={loyaltySearching} sx={{ whiteSpace: "nowrap", minWidth: 60 }}>
                  {loyaltySearching ? "..." : "Find"}
                </Button>
              </Stack>
              {loyaltyCard && (
                <Typography variant="caption" color="success.main">
                  {loyaltyCard.debtor?.name} — {loyaltyCard.points_balance} pts ({loyaltyCard.tier?.tier_name ?? "No tier"})
                </Typography>
              )}
              <Autocomplete
                size="small"
                options={customers ?? []}
                getOptionLabel={(c: any) => c.name ?? ""}
                value={customer}
                onChange={(_, val) => setCustomer(val)}
                renderInput={(params) => <TextField {...params} label="Customer" size="small" inputRef={customerInputRef} />}
              />
              {locations && locations.length > 1 && (
                <FormControl size="small">
                  <InputLabel>Stock Location</InputLabel>
                  <Select value={locCode} label="Stock Location" onChange={(e) => setLocCode(e.target.value)}>
                    {locations.map((loc: any) => (
                      <MenuItem key={loc.loc_code} value={loc.loc_code}>{loc.location_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <Stack direction="row" spacing={1}>
                <TextField
                  label={manualDiscountMode === "percent" ? "Discount %" : "Discount (LKR)"}
                  type="number" size="small" fullWidth
                  value={manualDiscountValue}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setManualDiscountValue(raw);
                    const val = Math.max(0, Number(raw) || 0);
                    const pct = manualDiscountMode === "percent" ? Math.min(100, val) : (subtotal > 0 ? Math.min(100, (val / subtotal) * 100) : 0);
                    setCartDiscountPercent(pct);
                  }}
                />
                <FormControl size="small" sx={{ width: 80 }}>
                  <Select value={manualDiscountMode} onChange={(e) => { setManualDiscountMode(e.target.value as "percent" | "amount"); setManualDiscountValue(""); setCartDiscountPercent(0); }}>
                    <MenuItem value="percent">%</MenuItem>
                    <MenuItem value="amount">Rs</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>

            <Stack spacing={1}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">PAYMENT / COUPON / VOUCHER</Typography>
              <Stack spacing={1}>
                {paymentLines.map((p, pIndex) => (
                  <Stack direction="row" spacing={1} key={p.id} alignItems="center">
                    <FormControl size="small" sx={{ minWidth: 110, flex: 1 }}>
                      <InputLabel>Account</InputLabel>
                      <Select value={p.bank_account_id} label="Account" onChange={(e) => updatePaymentLine(p.id, { bank_account_id: Number(e.target.value) })}>
                        {(bankAccounts ?? []).map((a: any) => (
                          <MenuItem key={a.id} value={a.id}>{a.bank_account_name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      inputRef={pIndex === 0 ? paymentAmountInputRef : undefined}
                      label="Amount" size="small" sx={{ width: 100 }}
                      value={Number(p.amount) ? Number(p.amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : p.amount}
                      onChange={(e) => updatePaymentLine(p.id, { amount: e.target.value.replace(/,/g, "") })}
                      onFocus={(e) => e.target.select()}
                    />
                    {cardTypes && cardTypes.length > 0 && (
                      <FormControl size="small" sx={{ minWidth: 90 }}>
                        <InputLabel>Card</InputLabel>
                        <Select value={p.card_type_id ?? ""} label="Card" onChange={(e) => updatePaymentLine(p.id, { card_type_id: Number(e.target.value) || undefined })}>
                          <MenuItem value=""><em>None</em></MenuItem>
                          {cardTypes.map((c: any) => (
                            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    {paymentLines.length > 1 && (
                      <IconButton size="small" color="error" sx={{ width: 44, height: 44 }} onClick={() => removePaymentLine(p.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                    {pIndex === paymentLines.length - 1 && (
                      <IconButton size="small" color="secondary" sx={{ width: 44, height: 44 }} onClick={addPaymentLine}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                ))}
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField label="Coupon Code" size="small" fullWidth value={couponCode} onChange={(e) => setCouponCode(e.target.value)} disabled={!!appliedCoupon} />
                {appliedCoupon ? (
                  <Button variant="outlined" color="error" size="small" onClick={() => { setAppliedCoupon(null); setCouponCode(""); }}>Remove</Button>
                ) : (
                  <Button variant="contained" color="success" size="small" onClick={handleApplyCoupon} disabled={couponChecking}>Apply</Button>
                )}
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField label="Voucher Code" size="small" fullWidth value={voucherCode} onChange={(e) => setVoucherCode(e.target.value)} onKeyDown={handleVoucherCodeKeyDown} disabled={!!appliedVoucher} />
                {appliedVoucher ? (
                  <Button variant="outlined" color="error" size="small" onClick={() => { setAppliedVoucher(null); setVoucherCode(""); setVoucherAmount(""); }}>Remove</Button>
                ) : (
                  <Button variant="contained" color="success" size="small" onClick={() => handleApplyVoucher()} disabled={voucherChecking}>Apply</Button>
                )}
              </Stack>
            </Stack>
          </Box>
        </Box>

        <Divider />

        {/* Pinned summary + action bar — never inside the scroll area above,
            so Total/Change Due/Complete Sale are always visible. */}
        <Box sx={{ p: 1.25, flexShrink: 0 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="baseline" justifyContent="space-between">
            <Stack direction="row" spacing={2}>
              <Typography variant="caption" color="text.secondary">Items <b>{cart.reduce((sum, l) => sum + l.quantity, 0)}</b></Typography>
              <Typography variant="caption" color="text.secondary">Subtotal <b>{formatCurrency(subtotal, 2)}</b></Typography>
              {totalPaid > 0 && (
                <Typography variant="caption" color="text.secondary">Cash Received <b>{formatCurrency(totalPaid, 2)}</b></Typography>
              )}
            </Stack>
            <Stack direction="row" spacing={2} alignItems="baseline">
              <Stack direction="row" spacing={0.5} alignItems="baseline">
                <Typography variant="body2" fontWeight={700}>Total</Typography>
                <Typography variant="h6" fontWeight={800} color="primary.main">{formatCurrency(grandTotal, 2)}</Typography>
              </Stack>
              {totalPaid > 0 && (
                <Stack direction="row" spacing={0.5} alignItems="baseline">
                  <Typography variant="body2" fontWeight={700}>Change</Typography>
                  <Typography variant="h6" fontWeight={800} color="success.main">{formatCurrency(changeDue, 2)}</Typography>
                </Stack>
              )}
            </Stack>
          </Stack>
          {balanceRemaining > 0.01 && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.25 }}>{formatCurrency(balanceRemaining, 2)} still needs to be covered</Typography>
          )}

          <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
            <Button
              variant="contained" color="warning" startIcon={<RequestQuoteIcon />}
              disabled={quoteMutation.isPending || !customer || cart.length === 0}
              onClick={handleGiveQuote}
              sx={{ flex: 1, minHeight: 48, fontSize: "0.9rem" }}
            >
              {quoteMutation.isPending ? "Creating Quote..." : "Give Quote"}
            </Button>
            <Button
              variant="contained" startIcon={<ReceiptLongIcon />}
              disabled={checkoutMutation.isPending || !customer || cart.length === 0 || !cashAccount}
              onClick={handleCheckout}
              sx={{ flex: 2, minHeight: 48, fontSize: "1rem" }}
            >
              {checkoutMutation.isPending ? "Processing..." : "Complete Sale"}
            </Button>
          </Stack>
        </Box>
      </Card>
    </Box>
  );

  const bodyContent = (
    <>
      {/* Always-reachable icon button while in full-screen — stays fixed in
          the corner regardless of scroll, so exiting never needs the mouse
          to hunt for the header. */}
      {isFullScreen && (
        <Tooltip title="Exit Full Screen">
          <IconButton
            onClick={() => setIsFullScreen(false)}
            sx={{
              position: "fixed", top: 12, right: 12, zIndex: 1400,
              bgcolor: "background.paper", border: "1px solid", borderColor: "divider",
              boxShadow: 2,
            }}
          >
            <FullscreenExitIcon />
          </IconButton>
        </Tooltip>
      )}

      {isSquareScreen ? squareLayoutContent : (
      <Grid container spacing={2} sx={isFullScreen ? { height: "100%", minHeight: 0 } : undefined}>
        {/* ---- Left: scan/search + cart (a cashier's main working area) ----
            In full-screen mode this column is a flex column pinned to the
            real available height: the scan card and Payment/Checkout box
            keep their natural size, and the cart box gets exactly whatever
            is left over (flex: 1) with its own scrollbar. That's what
            guarantees the three pieces always add up to the actual screen
            height instead of a guessed pixel number that can overflow. */}
        <Grid
          item xs={12} md={9}
          sx={isFullScreen ? { height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" } : undefined}
        >
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2, flexShrink: 0 }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <TextField
                    inputRef={scanInputRef}
                    label="Barcode Scanner"
                    placeholder="Scan a barcode — cursor here, scan, item adds automatically"
                    size="small"
                    fullWidth
                    value={scanCode}
                    onChange={(e) => setScanCode(e.target.value)}
                    onKeyDown={handleScanKeyDown}
                    InputProps={{ startAdornment: <QrCodeScannerIcon sx={{ mr: 1, color: "text.secondary" }} /> }}
                  />
                </Stack>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Autocomplete
                    sx={{ flex: 2 }}
                    options={items ?? []}
                    getOptionLabel={(i: any) => `${i.stock_id} — ${i.description}`}
                    autoHighlight
                    value={selectedItem}
                    onChange={(_, val) => {
                      setSelectedItem(val);
                      setLastViewedProduct(val);
                      // Prefill Selling Price with the catalog price — the
                      // cashier can still override it, tracked via "touched".
                      setManualSellingPrice(val ? String(Number(val.sale_price ?? val.purchase_cost) || 0) : "");
                      setManualSellingPriceTouched(false);
                      setManualDiscountInput("");
                      setManualDiscountMode2("percent");
                      if (val && !isOffline) {
                        resolveSellingPrice(String(val.stock_id)).then((sp) => {
                          if (sp != null) {
                            setManualSellingPrice(String(Number(sp)));
                            setManualSellingPriceTouched(false);
                          }
                        }).catch(() => { });
                      }
                      // Keyboard-only flow: pick item -> Enter -> Discount -> Enter -> Qty.
                      if (val) setTimeout(() => { lineDiscountInputRef.current?.focus(); lineDiscountInputRef.current?.select(); }, 0);
                    }}
                    renderOption={(props, option: any) => (
                      <Box component="li" {...props} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                        <span>{option.stock_id} — {option.description}</span>
                        {lowStockStockIds.has(option.stock_id) && (
                          <Chip label="LOW STOCK" size="small" color="warning" icon={<WarningAmberIcon />} />
                        )}
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Item Code / Search Product"
                        size="small"
                        autoFocus
                        inputRef={(node) => {
                          const paramsInputRef = (params as any).inputRef;
                          if (typeof paramsInputRef === "function") paramsInputRef(node);
                          else if (paramsInputRef) paramsInputRef.current = node;
                          itemSearchInputRef.current = node;
                        }}
                        onKeyDown={(e) => {
                          // "END" — old till software's shortcut to finish item
                          // entry and jump straight to the payment amount,
                          // same as pressing F6. Only fires when the field is
                          // empty and ready for the next item (not mid-type).
                          if (e.key === "End" && !selectedItem && !itemSearchInputRef.current?.value) {
                            e.preventDefault();
                            // Keep it pre-filled to the exact total, but
                            // select the whole value — one Backspace (or
                            // just typing) clears it instantly, so the
                            // cashier can type what cash was actually
                            // handed over (e.g. 3000 for a 2900 bill).
                            paymentAmountInputRef.current?.focus();
                            paymentAmountInputRef.current?.select();
                          }
                        }}
                      />
                    )}
                  />
                  {selectedItem && (
                    <>
                      <TextField
                        label="Selling Price" type="number" size="small" sx={{ width: 110 }}
                        value={manualSellingPrice}
                        onChange={(e) => { setManualSellingPrice(e.target.value); setManualSellingPriceTouched(true); }}
                      />
                      <TextField
                        inputRef={lineDiscountInputRef}
                        label="Discount" type="number" size="small" sx={{ width: 90 }}
                        placeholder="0"
                        value={manualDiscountInput}
                        onChange={(e) => setManualDiscountInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          qtyInputRef.current?.focus();
                          qtyInputRef.current?.select();
                        }}
                      />
                      <FormControl size="small" sx={{ width: 68 }}>
                        <Select
                          value={manualDiscountMode2}
                          onChange={(e) => setManualDiscountMode2(e.target.value as "percent" | "amount")}
                        >
                          <MenuItem value="percent">%</MenuItem>
                          <MenuItem value="amount">Rs</MenuItem>
                        </Select>
                      </FormControl>
                    </>
                  )}
                  <TextField
                    inputRef={qtyInputRef} label="Qty" type="number" size="small" sx={{ width: 90 }} value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && selectedItem) { e.preventDefault(); addToCart(); } }}
                  />
                  <Button variant="contained" startIcon={<AddShoppingCartIcon />} onClick={addToCart} disabled={!selectedItem}>
                    Add
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {/* The cart box itself never grows — in full-screen mode it takes
              exactly the space left over (flex: 1) after the scan card and
              Payment/Checkout box above/below it, and scrolls internally.
              Outside full-screen it just caps at a sensible height. */}
          <TableContainer
            component={Paper} elevation={0}
            sx={{
              border: "1px solid", borderColor: "divider", borderRadius: 3, overflowY: "auto",
              ...(isFullScreen ? { flex: 1, minHeight: 0 } : { maxHeight: 420 }),
            }}
          >
            <Table size="small" stickyHeader>
              {/* stickyHeader makes each <th> sticky with its OWN background
                  (defaults to white), which overrides a color set on
                  TableHead itself — so the tint has to go on the cells. */}
              <TableHead>
                <TableRow sx={{ "& .MuiTableCell-root": { backgroundColor: "#79c4faff" } }}>
                  <TableCell>Item</TableCell>
                  <TableCell align="center">Qty</TableCell>
                  <TableCell align="right">Unit Price ({currencySymbol})</TableCell>
                  <TableCell align="right">Disc %</TableCell>
                  <TableCell align="right">Net Price ({currencySymbol})</TableCell>
                  <TableCell align="right">Line Total ({currencySymbol})</TableCell>
                  <TableCell align="center">—</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cart.map((l) => (
                  <TableRow key={l.stock_id} hover sx={{ backgroundColor: "#e0dedeff" }}>
                    <TableCell>{l.description}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                        <IconButton
                          size="small"
                          onClick={() => updateLine(l.stock_id, { quantity: Math.max(1, l.quantity - 1) })}
                        >
                          <RemoveIcon fontSize="inherit" />
                        </IconButton>
                        <TextField
                          type="text" inputMode="numeric" size="small" value={l.quantity.toLocaleString()} sx={{ width: 90 }}
                          inputProps={{ style: { textAlign: "center" } }}
                          onChange={(e) => updateLine(l.stock_id, { quantity: Math.max(0, parseFormattedNumber(e.target.value)) })}
                        />
                        <IconButton
                          size="small"
                          onClick={() => updateLine(l.stock_id, { quantity: l.quantity + 1 })}
                        >
                          <AddIcon fontSize="inherit" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="text" inputMode="numeric" size="small" value={l.unit_price.toLocaleString()} sx={{ width: 140 }}
                        inputProps={{ style: { textAlign: "right" } }}
                        onChange={(e) => updateLine(l.stock_id, { unit_price: parseFormattedNumber(e.target.value) })}
                      />
                      {/* Wholesale — only offered once quantity passes this
                          product's threshold, and only ever applied after
                          the Wholesale Authorization PIN is entered; never
                          automatic. */}
                      {l.wholesale_price != null && l.wholesale_qty_threshold != null && l.quantity > l.wholesale_qty_threshold && (
                        l.wholesale_applied ? (
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center" sx={{ mt: 0.5 }}>
                            <Chip label="WHOLESALE" size="small" color="success" />
                            <Button
                              size="small" variant="text"
                              onClick={() => updateLine(l.stock_id, { unit_price: l.original_unit_price ?? l.unit_price, wholesale_applied: false })}
                            >
                              Revert
                            </Button>
                          </Stack>
                        ) : (
                          <Button
                            size="small" variant="outlined" sx={{ mt: 0.5 }}
                            onClick={() => { setWholesalePinTarget(l.stock_id); setWholesalePinInput(""); }}
                          >
                            Apply Wholesale
                          </Button>
                        )
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <TextField
                          type="number" size="small" sx={{ width: 70 }}
                          value={l.discount_input ?? (l.discount_percent || "")}
                          inputProps={{ style: { textAlign: "right" } }}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const mode = l.discount_mode ?? "percent";
                            const val = Math.max(0, Number(raw) || 0);
                            const pct = mode === "percent" ? Math.min(100, val) : (l.unit_price > 0 ? Math.min(100, (val / l.unit_price) * 100) : 0);
                            updateLine(l.stock_id, { discount_input: raw, discount_percent: pct });
                          }}
                        />
                        <FormControl size="small" sx={{ width: 68 }}>
                          <Select
                            value={l.discount_mode ?? "percent"}
                            onChange={(e) => {
                              updateLine(l.stock_id, { discount_mode: e.target.value as "percent" | "amount", discount_input: "", discount_percent: 0 });
                            }}
                          >
                            <MenuItem value="percent">%</MenuItem>
                            <MenuItem value="amount">Rs</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {formatNumber(l.unit_price * (1 - l.discount_percent / 100))}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700}>
                        {formatNumber(l.quantity * l.unit_price * (1 - l.discount_percent / 100))}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="error" onClick={() => removeLine(l.stock_id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {cart.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><Typography variant="body2" color="text.secondary">Cart is empty — scan or search a product to begin.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block", flexShrink: 0 }}>
            Works with any USB/handheld barcode scanner — it types the code and presses Enter for you.
          </Typography>

          {/* Coupon / Voucher — moved here from the right-side Discounts
              panel, sitting at the bottom of the left column where the
              Payment Method(s) box used to be before that moved to the
              right panel. Shares a row with Complete Sale / Give Quote
              (also moved out of the right panel, which was getting too
              tall and forcing a scroll) — coupon/voucher fills the space
              on the left, the two buttons sit on the right. */}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-end" }} sx={{ mt: 2 }}>
            <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, flexShrink: 0, flex: 1 }}>
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <TextField
                    label="Coupon Code" size="small" fullWidth value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    disabled={!!appliedCoupon}
                  />
                  {appliedCoupon ? (
                    <Button variant="outlined" color="error" onClick={() => { setAppliedCoupon(null); setCouponCode(""); }}>Remove</Button>
                  ) : (
                    <Button variant="contained" color="success" onClick={handleApplyCoupon} disabled={couponChecking}>Apply</Button>
                  )}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Voucher Code (scan or type)" size="small" value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    onKeyDown={handleVoucherCodeKeyDown}
                    disabled={!!appliedVoucher}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Amount" type="number" size="small" value={voucherAmount}
                    onChange={(e) => setVoucherAmount(e.target.value)}
                    disabled={!!appliedVoucher}
                    placeholder="Full balance"
                    sx={{ width: 110 }}
                  />
                  {appliedVoucher ? (
                    <Button variant="outlined" color="error" onClick={() => { setAppliedVoucher(null); setVoucherCode(""); setVoucherAmount(""); }}>Remove</Button>
                  ) : (
                    <Button variant="contained" color="success" onClick={() => handleApplyVoucher()} disabled={voucherChecking}>
                      {voucherChecking ? "Checking..." : "Apply"}
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Stack direction="row" spacing={2} flexShrink={0}>
              <Tooltip title="Give the customer a price estimate — not a sale, no payment needed, nothing posted to accounts yet">
                <span style={{ display: "flex" }}>
                  <Button
                    variant="contained" color="warning" startIcon={<RequestQuoteIcon />}
                    disabled={quoteMutation.isPending || !customer || cart.length === 0}
                    onClick={handleGiveQuote}
                    sx={{ whiteSpace: "nowrap", px: 2 }}
                  >
                    {quoteMutation.isPending ? "Creating Quote..." : "Give Quote"}
                  </Button>
                </span>
              </Tooltip>
              <Button
                variant="contained" startIcon={<ReceiptLongIcon />}
                disabled={checkoutMutation.isPending || !customer || cart.length === 0 || !cashAccount}
                onClick={handleCheckout}
                sx={{ whiteSpace: "nowrap", px: 2 }}
              >
                {checkoutMutation.isPending ? "Processing..." : "Complete Sale"}
              </Button>
            </Stack>
          </Stack>
        </Grid>

        {/* ---- Right: one consolidated till panel — customer, discounts, payment, checkout ---- */}
        <Grid
          item xs={12} md={3}
          sx={isFullScreen ? { height: "100%", minHeight: 0, overflowY: "auto" } : undefined}
        >
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, position: { md: isFullScreen ? "static" : "sticky" }, top: { md: 16 } }}>
            <CardContent>
              {/* Customer */}
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <PersonIcon fontSize="small" color="action" />
                <Typography variant="subtitle2" fontWeight={700}>Customer</Typography>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Autocomplete
                  sx={{ flex: 1 }}
                  options={customers ?? []}
                  getOptionLabel={(c: any) => c.name ?? ""}
                  value={customer}
                  onChange={(_, val) => setCustomer(val)}
                  renderInput={(params) => <TextField {...params} label="Customer" size="small" inputRef={customerInputRef} />}
                />
                <Tooltip title="Add New Customer">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => setQuickAddCustomerOpen(true)}
                    sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}
                  >
                    <PersonAddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                {branches && branches.length > 1 && (
                  <FormControl fullWidth size="small">
                    <InputLabel>Branch</InputLabel>
                    <Select value={branchCode} label="Branch" onChange={(e) => setBranchCode(e.target.value)}>
                      {branches.map((b: any) => (
                        <MenuItem key={b.branch_code} value={String(b.branch_code)}>{b.br_name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {locations && locations.length > 1 && (
                  <FormControl fullWidth size="small">
                    <InputLabel>Stock Location</InputLabel>
                    <Select value={locCode} label="Stock Location" onChange={(e) => setLocCode(e.target.value)}>
                      {locations.map((loc: any) => (
                        <MenuItem key={loc.loc_code} value={loc.loc_code}>{loc.location_name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Stack>

              {customer?.date_of_birth && (() => {
                const dob = new Date(customer.date_of_birth);
                const today = new Date();
                return dob.getUTCMonth() === today.getMonth() && dob.getUTCDate() === today.getDate();
              })() && (
                  <Chip
                    sx={{ mt: 1.5 }}
                    color="secondary"
                    icon={<CakeIcon />}
                    label={`It's ${customer.name}'s birthday — consider a birthday offer!`}
                  />
                )}

              {applicableOffers && applicableOffers.length > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>APPLICABLE OFFERS</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {applicableOffers.map((o: any) => (
                      <Chip key={o.id} label={o.offer_name} size="small" color="success" />
                    ))}
                  </Stack>
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Discounts */}
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Discounts</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                <TextField
                  label={manualDiscountMode === "percent" ? "Manual Discount %" : "Manual Discount (LKR)"}
                  type="number" size="small" fullWidth
                  value={manualDiscountValue}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setManualDiscountValue(raw);
                    const val = Math.max(0, Number(raw) || 0);
                    const pct = manualDiscountMode === "percent"
                      ? Math.min(100, val)
                      : (subtotal > 0 ? Math.min(100, (val / subtotal) * 100) : 0);
                    setCartDiscountPercent(pct);
                  }}
                />
                <FormControl size="small" sx={{ width: 90 }}>
                  <Select
                    value={manualDiscountMode}
                    onChange={(e) => {
                      setManualDiscountMode(e.target.value as "percent" | "amount");
                      setManualDiscountValue("");
                      setCartDiscountPercent(0);
                    }}
                  >
                    <MenuItem value="percent">%</MenuItem>
                    <MenuItem value="amount">LKR</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              {customerLoyaltyCard && (
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Loyalty Points: {customerLoyaltyCard.points_balance} available
                    {loyaltyRedemptionRate > 0 ? ` (worth ${formatCurrency(customerLoyaltyCard.points_balance * loyaltyRedemptionRate)})` : ""}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      label="Redeem Points" type="number" size="small" fullWidth
                      value={redeemPointsInput}
                      onChange={(e) => setRedeemPointsInput(e.target.value)}
                      disabled={!!appliedLoyaltyRedemption || loyaltyRedemptionRate <= 0}
                      helperText={loyaltyRedemptionRate <= 0 ? "This tier has no redemption rate set" : undefined}
                    />
                    {appliedLoyaltyRedemption ? (
                      <Button variant="outlined" color="error" onClick={() => { setAppliedLoyaltyRedemption(null); setRedeemPointsInput(""); }}>Remove</Button>
                    ) : (
                      <Button
                        variant="contained" color="success"
                        disabled={loyaltyRedemptionRate <= 0 || !redeemPointsInput || Number(redeemPointsInput) <= 0 || Number(redeemPointsInput) > customerLoyaltyCard.points_balance}
                        onClick={() => {
                          const points = Number(redeemPointsInput);
                          setAppliedLoyaltyRedemption({ points, amount: Math.round(points * loyaltyRedemptionRate * 100) / 100 });
                        }}
                      >
                        Apply
                      </Button>
                    )}
                  </Stack>
                </Stack>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Payment method(s) — moved next to Customer/Discounts/Totals
                  so the cashier enters tendered amount right where the
                  Total and Change Due are shown, instead of scrolling down
                  to a separate box under the cart. */}
              <Typography variant="caption" color="text.secondary" fontWeight={700}>PAYMENT METHOD(S)</Typography>

              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mt: 1 }}>
                {paymentLines.map((p, pIndex) => (
                  <Stack direction="row" spacing={1} key={p.id} alignItems="center">
                    <FormControl size="small" sx={{ width: 180 }}>
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
                      inputRef={pIndex === 0 ? paymentAmountInputRef : undefined}
                      label="Amount" size="small" sx={{ width: 110 }}
                      value={Number(p.amount) ? Number(p.amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : p.amount}
                      onChange={(e) => updatePaymentLine(p.id, { amount: e.target.value.replace(/,/g, "") })}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (pIndex !== 0 || e.key !== "Enter") return;
                        e.preventDefault();
                        if (!checkoutMutation.isPending && customer && cart.length > 0 && cashAccount) handleCheckout();
                      }}
                    />
                    {(() => {
                      const acct = (bankAccounts ?? []).find((a: any) => a.id === p.bank_account_id);
                      const isCardAccount = acct?.bank_account_name?.toLowerCase().includes("card");
                      if (!isCardAccount) return null;
                      return (
                        <FormControl size="small" sx={{ width: 150 }}>
                          <InputLabel>Card Type</InputLabel>
                          <Select
                            value={p.card_type_id ?? ""}
                            label="Card Type"
                            onChange={(e) => updatePaymentLine(p.id, { card_type_id: Number(e.target.value) })}
                          >
                            {(cardTypes ?? []).map((c: any) => (
                              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      );
                    })()}
                    {paymentLines.length > 1 && (
                      <IconButton size="small" color="error" onClick={() => removePaymentLine(p.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                    {pIndex === paymentLines.length - 1 && (
                      <Tooltip title="Split into another payment method">
                        <IconButton size="small" color="secondary" onClick={addPaymentLine}>
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                ))}
              </Stack>

              {balanceRemaining > 0.01 && (
                <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
                  {formatCurrency(balanceRemaining, 2)} still needs to be covered by a payment method
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Payment / totals */}
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body1" fontWeight={700} color="text.secondary">Total Items</Typography>
                  <Typography variant="body1" fontWeight={700}>{cart.reduce((sum, l) => sum + l.quantity, 0)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body1" fontWeight={700} color="text.secondary">Subtotal</Typography>
                  <Typography variant="body1" fontWeight={700}>{formatCurrency(subtotal, 2)}</Typography>
                </Stack>
                {cartDiscountAmount > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Cart Discount ({cartDiscountPercent}%)</Typography>
                    <Typography variant="body2" color="error">-{formatCurrency(cartDiscountAmount, 2)}</Typography>
                  </Stack>
                )}
                {couponDiscountAmount > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Coupon ({appliedCoupon?.coupon_code})</Typography>
                    <Typography variant="body2" color="error">-{formatCurrency(couponDiscountAmount, 2)}</Typography>
                  </Stack>
                )}
                {voucherApplied > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Voucher ({appliedVoucher?.code})</Typography>
                    <Typography variant="body2" color="error">-{formatCurrency(voucherApplied, 2)}</Typography>
                  </Stack>
                )}
                {loyaltyRedemptionApplied > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Loyalty Points ({appliedLoyaltyRedemption?.points} pts)</Typography>
                    <Typography variant="body2" color="error">-{formatCurrency(loyaltyRedemptionApplied, 2)}</Typography>
                  </Stack>
                )}
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                  <Typography variant="h6">Total</Typography>
                  <Typography variant="h5" fontWeight={800} color="primary.main">{formatCurrency(grandTotal, 2)}</Typography>
                </Stack>
                {totalPaid > 0 && (
                  <>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body1" fontWeight={700} color="text.secondary">Cash Received</Typography>
                      <Typography variant="body1" fontWeight={700}>{formatCurrency(totalPaid, 2)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                      <Typography variant="h6">Change Due</Typography>
                      <Typography variant="h5" fontWeight={800} color="success.main">{formatCurrency(changeDue, 2)}</Typography>
                    </Stack>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>

        </Grid>
      </Grid>
      )}

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

      <Dialog open={!!wholesalePinTarget} onClose={() => setWholesalePinTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Wholesale Authorization Required</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the Wholesale Authorization PIN to charge this line at the wholesale price.
          </Typography>
          <TextField
            label="PIN" type="password" size="small" fullWidth autoFocus
            value={wholesalePinInput}
            onChange={(e) => setWholesalePinInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmWholesalePin(); }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWholesalePinTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmWholesalePin}>Confirm</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!barcodeMatches} onClose={() => setBarcodeMatches(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Multiple products share this barcode — pick one</DialogTitle>
        <DialogContent>
          <List>
            {(barcodeMatches ?? []).map((m: any) => (
              <ListItemButton key={m.stock_id} onClick={() => handlePickBarcodeMatch(m)}>
                <ListItemText
                  primary={`${m.stock_id} — ${m.description}`}
                  secondary={formatCurrency(Number(m.sale_price ?? m.purchase_cost) || 0, 2)}
                />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBarcodeMatches(null)}>Cancel</Button>
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
        payments={lastReceipt?.payments}
        cashReceived={lastReceipt?.cashReceived}
        paperSize={posSettings?.receipt_paper_size}
        isQuote={isQuoteReceipt}
        receiptSettings={(() => { try { const s = posSettings?.receipt_settings ? JSON.parse(posSettings.receipt_settings) : {}; return { ...s, thermal_printer_name: posSettings?.thermal_printer_name }; } catch { return { thermal_printer_name: posSettings?.thermal_printer_name }; } })()}
        couponCode={lastReceipt?.couponCode}
        voucherCode={lastReceipt?.voucherCode}
        shiftId={lastReceipt?.shift_id}
      />

      <QuickAddCustomerDialog
        open={quickAddCustomerOpen}
        onClose={() => setQuickAddCustomerOpen(false)}
        onCreated={(newCustomer) => {
          queryClient.invalidateQueries({ queryKey: ["customers-all"] });
          setCustomer(newCustomer);
        }}
      />

      {/* Register new loyalty customer by phone */}
      <Dialog open={loyaltyRegisterOpen} onClose={() => setLoyaltyRegisterOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Register Loyalty Customer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Customer Name" value={loyaltyRegisterName} onChange={(e) => setLoyaltyRegisterName(e.target.value)} fullWidth size="small" />
            <TextField label="Phone Number" value={loyaltyRegisterPhone} onChange={(e) => setLoyaltyRegisterPhone(e.target.value)} fullWidth size="small" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoyaltyRegisterOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!loyaltyRegisterName || !loyaltyRegisterPhone} onClick={handleLoyaltyRegister}>
            Register & Attach
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  if (isFullScreen) {
    return (
      <Box
        sx={{
          position: "fixed", inset: 0, zIndex: 1300,
          bgcolor: "#ffffffff",
          display: "flex", flexDirection: "column", overflow: "hidden",
          p: 2,
        }}
      >
        {/* Header stays put. The page itself never scrolls — text is never
            scaled or shrunk, the cart list has its own fixed-height
            scrollbar (see the TableContainer) and the Payment/Checkout box
            is a fixed size, so nothing here ever needs to move or resize as
            the cart grows. */}
        <Box sx={{ flexShrink: 0 }}>{headerContent}</Box>
        <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {bodyContent}
        </Box>
      </Box>
    );
  }

  return <FormPageLayout>{headerContent}{bodyContent}</FormPageLayout>;
}
