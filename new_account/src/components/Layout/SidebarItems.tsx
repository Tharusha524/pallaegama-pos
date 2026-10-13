import DashboardIcon from "@mui/icons-material/Dashboard";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import LocalMallOutlinedIcon from "@mui/icons-material/LocalMallOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PrecisionManufacturingOutlinedIcon from "@mui/icons-material/PrecisionManufacturingOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import ScienceIcon from "@mui/icons-material/Science";
import EmergencyIcon from "@mui/icons-material/Emergency";
import ChangeHistoryIcon from "@mui/icons-material/ChangeHistory";
import FolderIcon from "@mui/icons-material/Folder";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";
import InsightsIcon from "@mui/icons-material/Insights";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import LoyaltyIcon from "@mui/icons-material/Loyalty";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import CampaignIcon from "@mui/icons-material/Campaign";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import InventoryIcon from "@mui/icons-material/Inventory";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import ReceiptIcon from "@mui/icons-material/Receipt";
import AssignmentReturnIcon from "@mui/icons-material/AssignmentReturn";
import SyncProblemIcon from "@mui/icons-material/SyncProblem";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import GroupsIcon from "@mui/icons-material/Groups";
import StyleIcon from "@mui/icons-material/Style";
import BuildIcon from "@mui/icons-material/Build";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ScaleIcon from "@mui/icons-material/Scale";
import ListAltIcon from "@mui/icons-material/ListAlt";
import PriceChangeIcon from "@mui/icons-material/PriceChange";
import PrintIcon from "@mui/icons-material/Print";
import { getModulePermissionIds } from "../../permissions/navigationTree";

export interface SidebarItem {
  title?: string;
  headline?: string;
  icon?: JSX.Element;
  open?: boolean;
  href?: string;
  disabled?: boolean;
  accessKey?: string;
  // Any one of these permission IDs grants visibility (OR-matched). Only
  // enforced for accounts with strict_access — see AuthContext.hasPermission.
  requiredPermission?: number[];
  nestedItems?: {
    title: string;
    href: string;
    icon?: JSX.Element;
    accessKey?: string;
    open?: boolean;
    disabled?: boolean;
    nestedItems?: {
      accessKey?: string;
      title: string;
      href: string;
      icon?: JSX.Element;
      disabled?: boolean;
    }[];
  }[];
}

const baseSidebarItems: Array<SidebarItem> = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: <DashboardIcon fontSize="small" />,
  },
  {
    title: "Supermarket Dashboard",
    href: "/supermarket/dashboard",
    icon: <InsightsIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Smart Supermarket"),
  },
  // The 9 groups below used to sit one level deeper, inside a single
  // "Smart Supermarket" parent button — removed so each group is reached
  // in one click instead of two, straight from the main sidebar. Every
  // link inside them is unchanged.
  {
    title: "POS & Sales", href: "/supermarket/pos-checkout", icon: <PointOfSaleOutlinedIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Smart Supermarket"),
    nestedItems: [
      { title: "POS Checkout", href: "/supermarket/pos-checkout", icon: <PointOfSaleOutlinedIcon fontSize="small" /> },
      { title: "POS Shifts", href: "/supermarket/pos-shifts", icon: <PointOfSaleIcon fontSize="small" /> },
      { title: "Process Return", href: "/supermarket/returns", icon: <AssignmentReturnIcon fontSize="small" /> },
      { title: "Offline Sales", href: "/supermarket/offline-sales", icon: <SyncProblemIcon fontSize="small" /> },
      { title: "Offline Sales & Purchases", href: "/supermarket/offline-entries", icon: <ReceiptIcon fontSize="small" /> },
    ],
  },
  {
    title: "Products", href: "/supermarket/category", icon: <LocalOfferIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Smart Supermarket"),
    nestedItems: [
      { title: "Category", href: "/supermarket/category", icon: <LocalOfferIcon fontSize="small" /> },
      { title: "Add Item", href: "/supermarket/add-item", icon: <AddCircleOutlineIcon fontSize="small" /> },
      { title: "Set Price", href: "/supermarket/set-price", icon: <PriceChangeIcon fontSize="small" /> },
      { title: "MRP Price Setup", href: "/supermarket/mrp-setup", icon: <PriceChangeIcon fontSize="small" /> },
      { title: "Weigh & Print", href: "/supermarket/weigh-and-print", icon: <ScaleIcon fontSize="small" /> },
      { title: "Price Labels", href: "/supermarket/price-labels", icon: <PrintIcon fontSize="small" /> },
      { title: "Promotional Prices", href: "/supermarket/promotional-prices", icon: <LocalOfferIcon fontSize="small" /> },
      // Product Variants — disabled per request, feature/page code kept as-is.
      // { title: "Product Variants", href: "/supermarket/product-variants", icon: <StyleIcon fontSize="small" /> },
    ],
  },
  {
    title: "Inventory", href: "/supermarket/stock", icon: <ListAltIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Smart Supermarket"),
    nestedItems: [
      { title: "Stock", href: "/supermarket/stock", icon: <ListAltIcon fontSize="small" /> },
      { title: "Low Stock Alerts", href: "/supermarket/low-stock", icon: <WarningAmberIcon fontSize="small" /> },
      // Stock Damage — merged into the "Stock" page's "Stock Damage" tab, one button instead of two.
      // { title: "Stock Damage", href: "/supermarket/stock-damage", icon: <ReportProblemIcon fontSize="small" /> },
      // Stock Adjustments — merged into the "Stock" page's Adjustments tab, one button instead of two.
      // { title: "Stock Adjustments", href: "/supermarket/stock-adjustments", icon: <InventoryIcon fontSize="small" /> },
      { title: "Bulk Stock Adjustment", href: "/supermarket/bulk-stock-adjustment", icon: <InventoryIcon fontSize="small" /> },
      { title: "Stock Transfers", href: "/supermarket/stock-transfers", icon: <SwapHorizIcon fontSize="small" /> },
      { title: "Inventory Audits", href: "/supermarket/inventory-audits", icon: <FactCheckIcon fontSize="small" /> },
    ],
  },
  {
    title: "Purchasing", href: "/supermarket/suppliers", icon: <GroupsIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Smart Supermarket"),
    nestedItems: [
      { title: "Suppliers", href: "/supermarket/suppliers", icon: <GroupsIcon fontSize="small" /> },
      { title: "Purchase", href: "/supermarket/purchase", icon: <ReceiptIcon fontSize="small" /> },
      { title: "Direct Supplier Invoice", href: "/supermarket/direct-supplier-invoice", icon: <ReceiptIcon fontSize="small" /> },
    ],
  },
  {
    title: "Customers", href: "/supermarket/customer-segments", icon: <GroupsIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Smart Supermarket"),
    nestedItems: [
      { title: "Customer Segments", href: "/supermarket/customer-segments", icon: <GroupsIcon fontSize="small" /> },
    ],
  },
  {
    title: "Marketing & Loyalty", href: "/supermarket/offers", icon: <CampaignIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Smart Supermarket"),
    nestedItems: [
      { title: "Offers & Discounts", href: "/supermarket/offers", icon: <LocalOfferIcon fontSize="small" /> },
      { title: "Loyalty Tiers", href: "/supermarket/loyalty-tiers", icon: <LoyaltyIcon fontSize="small" /> },
      { title: "Loyalty Customers", href: "/supermarket/loyalty-cards", icon: <CardMembershipIcon fontSize="small" /> },
      { title: "Win-Back Campaigns", href: "/supermarket/win-back", icon: <CampaignIcon fontSize="small" /> },
    ],
  },
  {
    title: "Finance", href: "/supermarket/vouchers", icon: <CardGiftcardIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Smart Supermarket"),
    nestedItems: [
      { title: "Vouchers", href: "/supermarket/vouchers", icon: <CardGiftcardIcon fontSize="small" /> },
      // Warranty — disabled per request, feature/page code kept as-is.
      // { title: "Warranty", href: "/supermarket/warranty", icon: <VerifiedUserIcon fontSize="small" /> },
    ],
  },
  {
    title: "Reports", href: "/supermarket/reports", icon: <AssessmentIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Smart Supermarket"),
    nestedItems: [
      { title: "Reports", href: "/supermarket/reports", icon: <AssessmentIcon fontSize="small" /> },
      { title: "Sales Analytics", href: "/supermarket/sales-analytics", icon: <InsightsIcon fontSize="small" /> },
    ],
  },
  {
    title: "Settings", href: "/supermarket/pos-settings", icon: <SettingsSuggestIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Smart Supermarket"),
    nestedItems: [
      { title: "POS Settings", href: "/supermarket/pos-settings", icon: <SettingsSuggestIcon fontSize="small" /> },
      // Service Tickets — disabled per request, feature/page code kept as-is.
      // { title: "Service Tickets", href: "/supermarket/service-tickets", icon: <BuildIcon fontSize="small" /> },
    ],
  },
  /* Sales — disabled per request, feature/page code kept as-is.
  {
    title: "Sales",
    href: "/sales",
    icon: <ShoppingCartOutlinedIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Sales"),
    nestedItems: [
      {
        title: "Transactions",
        href: "/sales/transactions",
      },
      {
        title: "Inquiries and Reports",
        href: "/sales/inquiriesandreports",
      },
      {
        title: "Maintenance",
        href: "/sales/maintenance",
      },
    ],
  },
  */
  /* Purchase — disabled per request, feature/page code kept as-is.
  {
    title: "Purchase",
    href: "/purchase",
    icon: <LocalMallOutlinedIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Purchase"),
    nestedItems: [
      {
        title: "Transactions",
        href: "/purchase/transactions",
      },
      {
        title: "Inquiries and Reports",
        href: "/purchase/inquiriesandreports",
      },
      {
        title: "Maintenance",
        href: "/purchase/maintenance",
      },
    ],
  },
  */
  /* Item and inventory — disabled per request, feature/page code kept as-is.
  {
    title: "Item and inventory",
    href: "/itemsandinventory",
    icon: <Inventory2OutlinedIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Item and inventory"),
    nestedItems: [
      {
        title: "Transactions",
        href: "/itemsandinventory/transactions",
      },
      {
        title: "Inquiries and Reports",
        href: "/itemsandinventory/inquiriesandreports",
      },
      {
        title: "Maintenance",
        href: "/itemsandinventory/maintenance",
      },
      {
        title: "Pricing and Costs",
        href: "/itemsandinventory/pricingandcosts",
      },
    ],
  },
  */
  /* Manufacturing — disabled per request, feature/page code kept as-is.
  {
    title: "Manufacturing",
    href: "/manufacturing",
    icon: <PrecisionManufacturingOutlinedIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Manufacturing"),
    nestedItems: [
      {
        title: "Transactions",
        href: "/manufacturing/transactions",
      },
      {
        title: "Inquiries and Reports",
        href: "/manufacturing/inquiriesandreports",
      },
      {
        title: "Maintenance",
        href: "/manufacturing/maintenance",
      },
    ],
  },
  */
  /* Fixed Assets — disabled per request, feature/page code kept as-is.
  {
    title: "Fixed Assets",
    href: "/fixedassets",
    icon: <EmergencyIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Fixed Assets"),
    nestedItems: [
      {
        title: "Transactions",
        href: "/fixedassets/transactions",
      },
      {
        title: "Inquiries and Reports",
        href: "/fixedassets/inquiriesandreports",
      },
      {
        title: "Maintenance",
        href: "/fixedassets/maintenance",
      },
    ],
  },
  */
  /* CostCenter — disabled per request, feature/page code kept as-is.
  {
    title: "CostCenter",
    href: "/costCenter",
    icon: <ChangeHistoryIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("CostCenter"),
    nestedItems: [
      {
        title: "Transactions",
        href: "/costCenter/transactions",
      },
      {
        title: "Inquiries and Reports",
        href: "/costCenter/inquiriesandreports",
      },
      {
        title: "Maintenance",
        href: "/costCenter/maintenance",
      },
    ],
  },
  */
  {
    title: "Banking And General ledger",
    href: "/bankingandgeneralledger",
    icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Banking And General ledger"),
    nestedItems: [
      {
        title: "Transactions",
        href: "/bankingandgeneralledger/transactions",
      },
      {
        title: "Inquiries and Reports",
        href: "/bankingandgeneralledger/inquiriesandreports",
      },
      {
        title: "Maintenance",
        href: "/bankingandgeneralledger/maintenance",
      },
    ],
  },
];

export interface SidebarModuleFlags {
  manufacturingEnabled?: boolean;
  fixedAssetsEnabled?: boolean;
  useCostCenters?: boolean;
}

// Filter modules by Company Setup flags and permission; optionally append Setup.
export const getSidebarItems = (
  canAccessSetup = false,
  moduleFlags: SidebarModuleFlags = {},
  hasPermission: (id: number) => boolean = () => true
): Array<SidebarItem> => {
  const {
    manufacturingEnabled = true,
    fixedAssetsEnabled = true,
    useCostCenters = true,
  } = moduleFlags;

  const items = baseSidebarItems.filter((item) => {
    if (item.title === "Manufacturing" && !manufacturingEnabled) return false;
    if (item.title === "Fixed Assets" && !fixedAssetsEnabled) return false;
    if (item.title === "CostCenter" && !useCostCenters) return false;
    if (item.requiredPermission) {
      return item.requiredPermission.some((id) => hasPermission(id));
    }
    return true;
  });

  if (canAccessSetup) {
    items.push({
      title: "Setup",
      href: "/setup",
      icon: <SettingsOutlinedIcon fontSize="small" />,
      nestedItems: [
        {
          title: "Company Setup",
          href: "/setup/companysetup",
        },
        {
          title: "Miscellaneous",
          href: "/setup/miscellaneous",
        },
        {
          title: "Maintenance",
          href: "/setup/maintenance",
        },
      ],
    });
  }

  return items;
};