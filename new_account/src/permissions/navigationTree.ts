// Permission checklist tree that mirrors the REAL sidebar navigation:
// Module (sidebar item) -> Submenu (Transactions/Inquiries and Reports/
// Maintenance/...) -> Page (the actual card/route a user opens).
//
// Each page has its OWN distinct permission ID (wired into that page's
// specific route in Routes.tsx), so checking one page never grants access
// to a different page. Where a page previously shared its parent/hub's ID
// with several other pages, it now points at either an existing-but-unused
// PERMISSION_ID_MAP entry that already matched it semantically, or a newly
// added entry (see the bottom of ./map.ts) minted just for that page.
//
// `path` is the exact route path used by both the module hub screens
// (src/views/**/*.tsx ITEMS arrays) and Routes.tsx, so ModuleHubLayout can
// look up a card's permission and hide/show it accordingly. Pages that link
// to the shared /reports screen have no dedicated path/permission of their
// own and are left visible unconditionally (no per-module report gating
// exists today).
import PERMISSION_ID_MAP from "./map";

export interface NavPage {
  label: string;
  id: number;
  path: string;
}

export interface NavSubmenu {
  label: string;
  pages: NavPage[];
}

export interface NavModule {
  label: string;
  submenus: NavSubmenu[];
}

const id = (key: string): number => PERMISSION_ID_MAP[key];

export const NAVIGATION_PERMISSION_TREE: NavModule[] = [
  {
    label: "Sales",
    submenus: [
      {
        label: "Transactions",
        pages: [
          { label: "Sales Quotation Entry", id: id("Sales quotations"), path: "/sales/transactions/sales-quotation-entry" },
          { label: "Sales Order Entry", id: id("Sales orders edition"), path: "/sales/transactions/sales-order-entry" },
          { label: "Direct Delivery", id: id("Direct sales delivery entry"), path: "/sales/transactions/direct-delivery" },
          { label: "Direct Invoice", id: id("Direct sales invoice entry"), path: "/sales/transactions/direct-invoice" },
          { label: "Delivery Against Sales Orders", id: id("Sales deliveries edition"), path: "/sales/transactions/delivery-against-sales-orders" },
          { label: "Invoice Against Sales Delivery", id: id("Sales invoices edition"), path: "/sales/transactions/invoice-against-sales-delivery" },
          { label: "Invoice Prepaid Orders", id: id("Invoice prepaid orders"), path: "/sales/transactions/invoice-prepaid-orders" },
          { label: "Template Delivery", id: id("Sales templates"), path: "/sales/transactions/template-delivery" },
          { label: "Template Invoice", id: id("Sales template invoice"), path: "/sales/transactions/template-invoice" },
          { label: "Create and Print Recurrent Invoices", id: id("Recurrent invoices definitions"), path: "/sales/transactions/create-print-recurrent-invoices" },
          { label: "Customer Payments", id: id("Customer payments entry"), path: "/sales/transactions/customer-payments" },
          { label: "Customer Credit Notes", id: id("Sales credit notes against invoice"), path: "/sales/transactions/customer-credit-notes" },
          { label: "Allocate Customer Payments or Credit Notes", id: id("Customer payments allocation"), path: "/sales/transactions/allocate-customer-payments-credit-notes" },
        ],
      },
      {
        label: "Inquiries and Reports",
        pages: [
          { label: "Sales Quotation Inquiry", id: id("Sales Related Reports"), path: "/sales/inquiriesandreports/sales-quotation-inquiry" },
          { label: "Sales Order Inquiry", id: id("Sales order inquiry"), path: "/sales/inquiriesandreports/sales-order-inquiry" },
          { label: "Customer Transaction Inquiry", id: id("Customer transaction inquiry"), path: "/sales/inquiriesandreports/customer-transaction-inquiry" },
          { label: "Customer Allocation Inquiry", id: id("Customer allocation inquiry"), path: "/sales/inquiriesandreports/customer-allocation-inquiry" },
          { label: "Customer and Sales Reports", id: id("Customer and sales reports"), path: "/reports" },
        ],
      },
      {
        label: "Maintenance",
        pages: [
          { label: "Add and Manage Customers", id: id("Sales customer and branches changes"), path: "/sales/maintenance/add-and-manage-customers" },
          { label: "Customer Branches", id: id("Customer branches maintenance"), path: "/sales/maintenance/customer-branches" },
          { label: "Sales Groups", id: id("Sales groups changes"), path: "/sales/maintenance/sales-groups" },
          { label: "Recurrent Invoices", id: id("Recurrent invoices maintenance"), path: "/sales/maintenance/recurrent-invoices" },
          { label: "Sales Types", id: id("Sales types"), path: "/sales/maintenance/sales-types" },
          { label: "Sales Persons", id: id("Sales staff maintenance"), path: "/sales/maintenance/sales-persons" },
          { label: "Sales Areas", id: id("Sales areas maintenance"), path: "/sales/maintenance/sales-areas" },
          { label: "Credit Status Setup", id: id("Credit status definitions changes"), path: "/sales/maintenance/credit-status-setup" },
        ],
      },
    ],
  },
  {
    label: "Purchase",
    submenus: [
      {
        label: "Transactions",
        pages: [
          { label: "Purchase Order Entry", id: id("Purchase order entry"), path: "/purchase/transactions/purchase-order-entry" },
          { label: "Outstanding Purchase Orders Maintenance", id: id("Outstanding purchase orders maintenance"), path: "/purchase/transactions/outstanding-purchase-orders-maintenance" },
          { label: "Receive Purchase Order Items", id: id("Purchase receive"), path: "/purchase/transactions/receive-purchase-order-items" },
          { label: "Direct GRN", id: id("Direct GRN entry"), path: "/purchase/transactions/direct-grn" },
          { label: "Direct Supplier Invoice", id: id("Direct supplier invoice entry"), path: "/purchase/transactions/direct-supplier-invoice" },
          { label: "Payment to Suppliers", id: id("Supplier payments"), path: "/purchase/transactions/payment-to-suppliers" },
          { label: "Supplier Invoice", id: id("Supplier invoices"), path: "/purchase/transactions/supplier-invoice" },
          { label: "Supplier Credit Notes", id: id("Supplier credit notes"), path: "/purchase/transactions/supplier-credit-notes" },
          { label: "Allocate Supplier Payments or Credit Notes", id: id("Supplier payments allocations"), path: "/purchase/transactions/allocate-supplier-payments-credit-notes" },
        ],
      },
      {
        label: "Inquiries and Reports",
        pages: [
          { label: "Purchase Orders Inquiry", id: id("Purchase Analytics"), path: "/purchase/inquiriesandreports/purchase-orders-inquiry" },
          { label: "Supplier Transaction Inquiry", id: id("Supplier analytical reports"), path: "/purchase/inquiriesandreports/supplier-transaction-inquiry" },
          { label: "Supplier Allocation Inquiry", id: id("Supplier allocation inquiry"), path: "/purchase/inquiriesandreports/supplier-allocation-inquiry" },
          { label: "Supplier & Purchasing Reports", id: id("Supplier payments report"), path: "/reports" },
        ],
      },
      {
        label: "Maintenance",
        pages: [{ label: "Suppliers", id: id("Suppliers changes"), path: "/purchase/maintenance/suppliers" }],
      },
    ],
  },
  {
    label: "Item and inventory",
    submenus: [
      {
        label: "Transactions",
        pages: [
          { label: "Inventory Location Transfer", id: id("Inventory location transfers"), path: "/itemsandinventory/transactions/inventory-location-transfer" },
          { label: "Inventory Adjustments", id: id("Inventory adjustments"), path: "/itemsandinventory/transactions/inventory-adjustments" },
        ],
      },
      {
        label: "Inquiries and Reports",
        pages: [
          { label: "Inventory Item Movements", id: id("Items analytical reports and inquiries"), path: "/itemsandinventory/inquiriesandreports/inventory-item-movements" },
          { label: "Inventory Item Status", id: id("Inventory item status inquiry"), path: "/itemsandinventory/inquiriesandreports/inventory-item-status" },
          { label: "Inventory Reports", id: id("Inventory reports"), path: "/reports" },
        ],
      },
      {
        label: "Maintenance",
        pages: [
          { label: "Items", id: id("Stock items add/edit"), path: "/itemsandinventory/maintenance/items" },
          { label: "Foreign Item Codes", id: id("Foreign item codes entry"), path: "/itemsandinventory/maintenance/foreign-item-codes" },
          { label: "Sales Kits", id: id("Sales kits"), path: "/itemsandinventory/maintenance/sales-kits" },
          { label: "Item Categories", id: id("Item categories"), path: "/itemsandinventory/maintenance/item-categories" },
          { label: "Inventory Locations", id: id("Inventory locations changes"), path: "/itemsandinventory/maintenance/inventory-locations" },
          { label: "Units of Measure", id: id("Units of measure"), path: "/itemsandinventory/maintenance/units-of-measure" },
          { label: "Reorder Levels", id: id("Reorder levels"), path: "/itemsandinventory/maintenance/reorder-levels" },
        ],
      },
      {
        label: "Pricing and Costs",
        pages: [
          { label: "Sales Pricing", id: id("Sales prices edition"), path: "/itemsandinventory/pricingandcosts/sales-pricing" },
          { label: "Purchasing Pricing", id: id("Purchase price changes"), path: "/itemsandinventory/pricingandcosts/purchasing-pricing" },
          { label: "Standard Costs", id: id("Item standard costs"), path: "/itemsandinventory/pricingandcosts/standard-costs" },
        ],
      },
    ],
  },
  {
    label: "Manufacturing",
    submenus: [
      {
        label: "Transactions",
        pages: [
          { label: "Work Order Entry", id: id("Work order entry"), path: "/manufacturing/transactions/work-order-entry" },
          { label: "Outstanding Work Orders", id: id("Work order releases"), path: "/manufacturing/transactions/outstanding-work-orders" },
        ],
      },
      {
        label: "Inquiries and Reports",
        pages: [
          { label: "Costed Bill of Material Inquiry", id: id("Manufacturing cost inquiry"), path: "/manufacturing/inquiriesandreports/costed-bill-of-material-inquiry" },
          { label: "Inventory Item Where Used Inquiry", id: id("Inventory item where used inquiry"), path: "/manufacturing/inquiriesandreports/inventory-item-where-used-inquiry" },
          { label: "Work Order Inquiry", id: id("Work order analytical reports and inquiries"), path: "/manufacturing/inquiriesandreports/work-order-inquiry" },
          { label: "Manufacturing Reports", id: id("Manufacturing reports"), path: "/reports" },
        ],
      },
      {
        label: "Maintenance",
        pages: [
          { label: "Bills of Materials", id: id("Bill of Materials"), path: "/manufacturing/maintenance/bills-of-material" },
          { label: "Work Centers", id: id("Manufacture work centres"), path: "/manufacturing/maintenance/work-centres" },
        ],
      },
    ],
  },
  {
    label: "Fixed Assets",
    submenus: [
      {
        label: "Transactions",
        pages: [
          { label: "Fixed Assets Purchase", id: id("Fixed Assets Operations"), path: "/fixedassets/transactions/fixed-assets-purchase" },
          { label: "Fixed Assets Location Transfer", id: id("Fixed Asset location transfers"), path: "/fixedassets/transactions/fixed-assets-location-transfer" },
          { label: "Fixed Assets Disposal", id: id("Fixed Asset disposals"), path: "/fixedassets/transactions/fixed-assets-disposal" },
          { label: "Fixed Assets Sale", id: id("Fixed assets sale"), path: "/fixedassets/transactions/fixed-assets-sale" },
          { label: "Process Depreciation", id: id("Depreciation"), path: "/fixedassets/transactions/process-depreciation" },
        ],
      },
      {
        label: "Inquiries and Reports",
        pages: [
          { label: "Fixed Asset Movements", id: id("Fixed Assets Analytics"), path: "/fixedassets/inquiriesandreports/fixed-asset-movements" },
          { label: "Fixed Assets Inquiry", id: id("Fixed Asset analytical reports and inquiries"), path: "/fixedassets/inquiriesandreports/fixed-assets-inquiry" },
          { label: "Fixed Asset Reports", id: id("Fixed asset reports"), path: "/reports" },
        ],
      },
      {
        label: "Maintenance",
        pages: [
          { label: "Fixed Assets", id: id("Fixed Asset items add/edit"), path: "/fixedassets/maintenance/fixed-assets" },
          { label: "Fixed Assets Locations", id: id("Fixed assets locations maintenance"), path: "/fixedassets/maintenance/fixed-asset-locations" },
          { label: "Fixed Assets Categories", id: id("Fixed Asset categories"), path: "/fixedassets/maintenance/fixed-asset-categories" },
          { label: "Fixed Assets Classes", id: id("Fixed Asset classes"), path: "/fixedassets/maintenance/fixed-asset-classes" },
        ],
      },
    ],
  },
  {
    label: "CostCenter",
    submenus: [
      {
        label: "Transactions",
        pages: [
          { label: "Cost Center Entry", id: id("CostCenter entry"), path: "/costCenter/transactions/costCenter-entry" },
          { label: "Outstanding Cost Centers", id: id("CostCenter view"), path: "/costCenter/transactions/outstanding-costCenters" },
        ],
      },
      {
        label: "Inquiries and Reports",
        pages: [
          { label: "Cost Center Inquiry", id: id("CostCenter view"), path: "/costCenter/inquiriesandreports/costCenter-inquiry" },
          { label: "Cost Center Reports", id: id("CostCenters"), path: "/reports" },
        ],
      },
      {
        label: "Maintenance",
        pages: [{ label: "Cost Center Tags", id: id("CostCenter tags"), path: "/costCenter/maintenance/costCenter-tags" }],
      },
    ],
  },
  {
    label: "Banking And General ledger",
    submenus: [
      {
        label: "Transactions",
        pages: [
          { label: "Payments", id: id("Bank payments"), path: "/bankingandgeneralledger/transactions/payments" },
          { label: "Deposits", id: id("Bank deposits"), path: "/bankingandgeneralledger/transactions/deposits" },
          { label: "Bank Account Transfers", id: id("Bank account transfers"), path: "/bankingandgeneralledger/transactions/bank-account-transfers" },
          { label: "Journal Entry", id: id("Journal entries to bank related accounts"), path: "/bankingandgeneralledger/transactions/journal-entry" },
          { label: "Budget Entry", id: id("Budget edition"), path: "/bankingandgeneralledger/transactions/budget-entry" },
          { label: "Reconcile Bank Account", id: id("Bank reconciliation"), path: "/bankingandgeneralledger/transactions/reconcile-bank-account" },
          { label: "Revenue / Cost Accruals", id: id("Revenue / Cost Accruals"), path: "/bankingandgeneralledger/transactions/revenue-cost-accruals" },
        ],
      },
      {
        label: "Inquiries and Reports",
        pages: [
          { label: "Journal Inquiry", id: id("GL analytical reports and inquiries"), path: "/bankingandgeneralledger/inquiriesandreports/journal-inquiry" },
          { label: "GL Inquiry", id: id("GL inquiry"), path: "/bankingandgeneralledger/inquiriesandreports/gl-inquiry" },
          { label: "Bank Account Inquiry", id: id("Bank reports and inquiries"), path: "/bankingandgeneralledger/inquiriesandreports/bank-account-inquiry" },
          { label: "Tax Inquiry", id: id("Tax reports and inquiries"), path: "/bankingandgeneralledger/inquiriesandreports/tax-inquiry" },
          { label: "Trial Balance", id: id("Trial balance inquiry"), path: "/bankingandgeneralledger/inquiriesandreports/trial-balance" },
          { label: "Balance Sheet Drilldown", id: id("Balance sheet drilldown"), path: "/bankingandgeneralledger/inquiriesandreports/balance-sheet-drilldown" },
          { label: "Profit and Loss Drilldown", id: id("Profit and loss drilldown"), path: "/bankingandgeneralledger/inquiriesandreports/profit-and-loss-drilldown" },
          { label: "Banking Reports", id: id("Banking & GL Analytics"), path: "/reports" },
          { label: "General Ledger Reports", id: id("GL reports and inquiries"), path: "/reports" },
        ],
      },
      {
        label: "Maintenance",
        pages: [
          { label: "Bank Accounts", id: id("Bank accounts"), path: "/bankingandgeneralledger/maintenance/bank-accounts" },
          { label: "Quick Entries", id: id("Quick GL entry definitions"), path: "/bankingandgeneralledger/maintenance/quick-entries" },
          { label: "Account Tags", id: id("GL Account tags"), path: "/bankingandgeneralledger/maintenance/account-tags" },
          { label: "Currencies", id: id("Currencies"), path: "/bankingandgeneralledger/maintenance/currencies" },
          { label: "Exchange Rates", id: id("Exchange rate table changes"), path: "/bankingandgeneralledger/maintenance/exchange-rates" },
          { label: "GL Accounts", id: id("GL accounts edition"), path: "/bankingandgeneralledger/maintenance/gl-accounts" },
          { label: "GL Account Groups", id: id("GL account groups"), path: "/bankingandgeneralledger/maintenance/gl-account-groups" },
          { label: "Account Types (GL)", id: id("Company GL setup"), path: "/bankingandgeneralledger/maintenance/gl-types" },
          { label: "GL Account Classes", id: id("GL account classes"), path: "/bankingandgeneralledger/maintenance/gl-account-classes" },
          { label: "Class Types", id: id("Class Types (GL)"), path: "/bankingandgeneralledger/maintenance/class-types" },
          { label: "Closing GL Transactions", id: id("Banking & GL Configuration"), path: "/bankingandgeneralledger/maintenance/closing-gl-transactions" },
          { label: "Revaluation of Currency Accounts", id: id("Revaluation of currency accounts"), path: "/bankingandgeneralledger/maintenance/revaluation-of-currency-accounts" },
        ],
      },
    ],
  },
  {
    label: "Setup",
    submenus: [
      {
        label: "Company Setup",
        pages: [
          { label: "Company Setup", id: id("Company parameters"), path: "/setup/companysetup/company-setup" },
          { label: "User Account Setup", id: id("Users setup"), path: "/setup/companysetup/user-account-setup" },
          { label: "Access Setup", id: id("Access levels edition"), path: "/setup/companysetup/access-setup" },
          { label: "Department Setup", id: id("Department setup page"), path: "/setup/companysetup/department-setup" },
          { label: "Transaction References", id: id("Stock transactions view"), path: "/setup/companysetup/transaction-references" },
          { label: "Taxes", id: id("Tax rates"), path: "/setup/companysetup/taxes" },
          { label: "Tax Groups", id: id("Tax groups"), path: "/setup/companysetup/tax-groups" },
          { label: "Item Tax Types", id: id("Item tax type definitions"), path: "/setup/companysetup/item-tax-types" },
          { label: "System and General GL Setup", id: id("Company GL setup"), path: "/setup/companysetup/system-and-general-gl-setup" },
          { label: "Email Setup", id: id("Email setup page"), path: "/setup/companysetup/email-setup" },
          { label: "Login IP Restriction", id: id("Login IP restriction page"), path: "/setup/companysetup/login-ip-restriction" },
          { label: "Fiscal Years", id: id("Fiscal years maintenance"), path: "/setup/companysetup/fiscal-years" },
          { label: "User Login Activity", id: id("User login activity page"), path: "/setup/companysetup/user-login-activity" },
        ],
      },
      {
        label: "Miscellaneous",
        pages: [
          { label: "Payment Terms", id: id("Payment terms"), path: "/setup/miscellaneous/payment-terms" },
          { label: "Shipping Company", id: id("Shipping ways"), path: "/setup/miscellaneous/shipping-company" },
          { label: "Point of Sale", id: id("Point of Sale definitions"), path: "/setup/miscellaneous/point-of-sale" },
          { label: "Contact Categories", id: id("Contact categories"), path: "/setup/miscellaneous/contact-categories" },
        ],
      },
      {
        label: "Maintenance",
        pages: [
          { label: "Void a Transaction", id: id("Voiding transactions"), path: "/setup/maintenance/void-a-transaction" },
          { label: "View or Print Transaction", id: id("Common view/print transactions interface"), path: "/setup/maintenance/view-or-print-transaction" },
          { label: "Attach Documents", id: id("Attaching documents"), path: "/setup/maintenance/attach-documents" },
          { label: "System Diagnostics", id: id("System diagnostics page"), path: "/setup/maintenance/system-diagnostics" },
          { label: "Backup and Restore", id: id("Database backup/restore"), path: "/setup/maintenance/backup-and-restore" },
          { label: "User Login Activity", id: id("User login activity page"), path: "/setup/maintenance/user-login-logs" },
        ],
      },
    ],
  },
  {
    label: "Smart Supermarket",
    submenus: [
      {
        label: "Screens",
        pages: [
          { label: "POS Checkout", id: id("Supermarket POS checkout"), path: "/supermarket/pos-checkout" },
          { label: "Sales Analytics", id: id("Supermarket sales analytics"), path: "/supermarket/sales-analytics" },
          { label: "Low Stock Alerts", id: id("Supermarket low stock alerts"), path: "/supermarket/low-stock" },
          { label: "Loyalty Tiers", id: id("Supermarket loyalty tiers"), path: "/supermarket/loyalty-tiers" },
          { label: "Loyalty Cards", id: id("Supermarket loyalty cards"), path: "/supermarket/loyalty-cards" },
          { label: "Offers & Discounts", id: id("Supermarket offers and discounts"), path: "/supermarket/offers" },
          { label: "Win-Back Campaigns", id: id("Supermarket win-back campaigns"), path: "/supermarket/win-back" },
          { label: "Stock Damage", id: id("Supermarket stock damage"), path: "/supermarket/stock-damage" },
          { label: "POS Shifts", id: id("Supermarket POS shifts"), path: "/supermarket/pos-shifts" },
          { label: "Stock Adjustments", id: id("Supermarket stock adjustments"), path: "/supermarket/stock-adjustments" },
          { label: "Stock Transfers", id: id("Supermarket stock transfers"), path: "/supermarket/stock-transfers" },
          { label: "Inventory Audits", id: id("Supermarket inventory audits"), path: "/supermarket/inventory-audits" },
          { label: "Offline Sales & Purchases", id: id("Supermarket offline entries"), path: "/supermarket/offline-entries" },
          { label: "Warranty", id: id("Supermarket warranty"), path: "/supermarket/warranty" },
          { label: "Vouchers", id: id("Supermarket vouchers"), path: "/supermarket/vouchers" },
          { label: "Customer Segments", id: id("Supermarket customer segments"), path: "/supermarket/customer-segments" },
          { label: "Product Variants", id: id("Supermarket product variants"), path: "/supermarket/product-variants" },
          { label: "Service Tickets", id: id("Supermarket service tickets"), path: "/supermarket/service-tickets" },
          { label: "POS Settings", id: id("Supermarket pos settings"), path: "/supermarket/pos-settings" },
          { label: "Reports", id: id("Supermarket reports"), path: "/supermarket/reports" },
        ],
      },
    ],
  },
];

// All permission IDs belonging to a module (every page under every one of
// its submenus). Use this — not a hand-picked handful of "hub" IDs — to
// decide whether to show that module at all: a user granted access to any
// single page inside a module must see that module, regardless of which
// specific page(s) they hold.
const MODULE_PERMISSION_IDS: Record<string, number[]> = Object.fromEntries(
  NAVIGATION_PERMISSION_TREE.map((mod) => [
    mod.label,
    mod.submenus.flatMap((sub) => sub.pages.map((p) => p.id)),
  ])
);

export const getModulePermissionIds = (moduleLabel: string): number[] =>
  MODULE_PERMISSION_IDS[moduleLabel] ?? [];

// All permission IDs belonging to one submenu (e.g. Sales > Transactions).
// A hub/listing page for a submenu must accept anyone holding access to any
// single page inside it — not just one hand-picked "hub" ID — otherwise a
// user granted a specific page still can't reach the screen that links to it.
export const getSubmenuPermissionIds = (
  moduleLabel: string,
  submenuLabel: string
): number[] => {
  const mod = NAVIGATION_PERMISSION_TREE.find((m) => m.label === moduleLabel);
  const sub = mod?.submenus.find((s) => s.label === submenuLabel);
  return sub ? sub.pages.map((p) => p.id) : [];
};

// path -> permission id, for filtering individual cards on a hub screen.
// Several distinct cards (the "…Reports" cards in each module's Inquiries
// and Reports submenu) all link to the same shared /reports screen, so path
// alone can't tell them apart — those fall back to a label match instead
// (see getPermissionIdForCard below).
const PATH_PERMISSION_COUNTS: Record<string, number> = {};
NAVIGATION_PERMISSION_TREE.forEach((mod) =>
  mod.submenus.forEach((sub) =>
    sub.pages.forEach((p) => {
      PATH_PERMISSION_COUNTS[p.path] = (PATH_PERMISSION_COUNTS[p.path] ?? 0) + 1;
    })
  )
);

const PATH_TO_PERMISSION_ID: Record<string, number> = {};
const LABEL_TO_PERMISSION_ID: Record<string, number> = {};
NAVIGATION_PERMISSION_TREE.forEach((mod) =>
  mod.submenus.forEach((sub) =>
    sub.pages.forEach((p) => {
      if (PATH_PERMISSION_COUNTS[p.path] === 1) {
        PATH_TO_PERMISSION_ID[p.path] = p.id;
      } else {
        // Ambiguous shared path (e.g. /reports) — index by normalized label
        // instead, since each card's displayed text is still unique.
        LABEL_TO_PERMISSION_ID[p.label.trim().toUpperCase()] = p.id;
      }
    })
  )
);

/** Returns the permission id gating this route path, or undefined if the
 * path isn't tracked — callers should treat "undefined" as "no gate,
 * always show". */
export const getPermissionIdForPath = (path: string): number | undefined =>
  PATH_TO_PERMISSION_ID[path];

/** Same as getPermissionIdForPath, but falls back to a label match for
 * cards that share a path with others (e.g. every "…Reports" card links to
 * the same /reports screen) — pass the card's displayed text as `label`. */
export const getPermissionIdForCard = (
  path: string,
  label: string
): number | undefined =>
  PATH_TO_PERMISSION_ID[path] ?? LABEL_TO_PERMISSION_ID[label.trim().toUpperCase()];

export default NAVIGATION_PERMISSION_TREE;
