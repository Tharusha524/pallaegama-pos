import DashboardIcon from "@mui/icons-material/Dashboard";
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
    title: "Smart Supermarket",
    href: "/supermarket",
    icon: <StorefrontOutlinedIcon fontSize="small" />,
    requiredPermission: getModulePermissionIds("Smart Supermarket"),
    nestedItems: [
      { title: "POS Checkout", href: "/supermarket/pos-checkout" },
      { title: "Sales Analytics", href: "/supermarket/sales-analytics" },
      { title: "Low Stock Alerts", href: "/supermarket/low-stock" },
      { title: "Loyalty Tiers", href: "/supermarket/loyalty-tiers" },
      { title: "Loyalty Cards", href: "/supermarket/loyalty-cards" },
      { title: "Offers & Discounts", href: "/supermarket/offers" },
      { title: "Win-Back Campaigns", href: "/supermarket/win-back" },
      { title: "Stock Damage", href: "/supermarket/stock-damage" },
      { title: "POS Shifts", href: "/supermarket/pos-shifts" },
    ],
  },
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