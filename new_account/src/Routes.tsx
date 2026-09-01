import React, { Suspense, useMemo } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import MainLayout from "./components/Layout/MainLayout";
import PageLoader from "./components/PageLoader";
import useCurrentUser from "./hooks/useCurrentUser";
import { PermissionKeys } from "./views/Administration/SectionList";
import PermissionDenied from "./components/PermissionDenied";
import { useQuery } from "@tanstack/react-query";
import { User, validateUser } from "./api/userApi";
import Maintenance from "./views/Sales/Maintenance/SalesMaintenance";
import InquiriesAndReports from "./views/Sales/InquiriesAndReports/SalesInquiriesAndReports";
import SalesQuotationEntry from "./views/Sales/Transactions/SalesQuotationEntry/SalesQuotationEntry";
import SalesTransactions from "./views/Sales/Transactions/SalesTransactions";
import PurchaseTransactions from "./views/Purchases/Transactions/PurchaseTransactions";
import PurchaseInquiriesAndReports from "./views/Purchases/InquiriesAndReports/PurchaseInquiriesAndReports";
import PurchaseMaintenance from "./views/Purchases/Maintenance/PurchaseMaintenance";
import ItemsTransactions from "./views/ItemsAndInventory/Transactions/ItemsTransactions";
import ItemsInquiriesAndReports from "./views/ItemsAndInventory/InquiriesAndReports/ItemsInquiriesAndReports";
import ItemsMaintenance from "./views/ItemsAndInventory/Maintenance/ItemsMaintenance";
import ItemsPricingAndCosts from "./views/ItemsAndInventory/PricingAndCosts/PricingAndCosts";
import ManufacturingTransactions from "./views/Manufacturing/Transactions/ManufacturingTransactions";
import ManufacturingInquiriesAndReports from "./views/Manufacturing/InquiriesAndReports/ManufacturingInquiriesAndReports";
import ManufacturingMaintenance from "./views/Manufacturing/Maintenance/ManufacturingMaintenance";
import FixedAssestsTransactions from "./views/FixedAssets/Transactions/FixedAssestsTransactions";
import CostCenterTransactions from "./views/CostCenters/Transactions/CostCenterTransactions";
import CostCenterInquiriesAndReports from "./views/CostCenters/InquiriesAndReports/CostCenterInquiriesAndReports";
import CostCenterMaintenance from "./views/CostCenters/Maintenance/CostCenterMaintenance";
import BankingTransactions from "./views/BankindAndGeneralLedger/Transactions/BankingTransactions";
import BankingInquiriesAndReports from "./views/BankindAndGeneralLedger/InquiriesAndReports/BankingInquiriesAndReports";
import BankingMaintenance from "./views/BankindAndGeneralLedger/Maintenance/BankingMaintenance";
import SetupMaintenance from "./views/Setup/Maintenance/SetupMaintenance";
import Dashboard from "./views/Dashboard/Dashboard";
import SupermarketHub from "./views/Supermarket/SupermarketHub";
import SalesAnalyticsPage from "./views/Supermarket/SalesAnalytics/SalesAnalyticsPage";
import LowStockPage from "./views/Supermarket/LowStock/LowStockPage";
import LoyaltyTiersPage from "./views/Supermarket/LoyaltyTiers/LoyaltyTiersPage";
import LoyaltyCardsPage from "./views/Supermarket/LoyaltyCards/LoyaltyCardsPage";
import OffersPage from "./views/Supermarket/Offers/OffersPage";
import WinBackPage from "./views/Supermarket/WinBack/WinBackPage";
import StockDamagePage from "./views/Supermarket/StockDamage/StockDamagePage";
import PosShiftPage from "./views/Supermarket/PosShift/PosShiftPage";
import PosCheckoutPage from "./views/Supermarket/PosCheckout/PosCheckoutPage";
import CompanySetup from "./views/Setup/CompanySetup/CompanySetup";
import Miscellaneous from "./views/Setup/Miscellaneous/Miscellaneous";
import FixedAssestsMaintenance from "./views/FixedAssets/Maintenance/FixedAssestsMaintenance";
import FixedAssestsInquiriesAndReports from "./views/FixedAssets/InquiriesAndReports/FixedAssestsInquiriesAndReports";
import CompanySetupForm from "./views/Setup/CompanySetup/CompanySetup/CompanySetupForm";
import AddUserForm from "./views/Setup/CompanySetup/User/AddUserForm";
import UserManagementTable from "./views/Setup/CompanySetup/User/UserManagementTable";
import FiscalYear from "./views/Setup/CompanySetup/FiscalYear/AddFiscalYear";
import FiscalYearTable from "./views/Setup/CompanySetup/FiscalYear/FiscalYearTable";
import TaxGroupsTable from "./views/Setup/CompanySetup/TaxGroups/TaxGroupsTable";
import TaxGroups from "./views/Setup/CompanySetup/TaxGroups/AddTaxGroups";
import TaxTypes from "./views/Setup/CompanySetup/TaxTypes/AddTaxTypes";
import TaxTypesTable from "./views/Setup/CompanySetup/TaxTypes/TaxTypesTable";
import Currencies from "./views/BankindAndGeneralLedger/Maintenance/Currencies/AddCurrencies";
import CurrenciesTable from "./views/BankindAndGeneralLedger/Maintenance/Currencies/CurrenciesTable";
import UserAccessForm from "./views/Setup/CompanySetup/UserAccess/AddUserAccessForm";
import AddUserAccessForm from "./views/Setup/CompanySetup/UserAccess/AddUserAccessForm";
import UpdateUserAccessForm from "./views/Setup/CompanySetup/UserAccess/UpdateUserAccessForm";
import DepartmentSetupForm from "./views/Setup/CompanySetup/Department/DepartmentSetupForm";
import UpdateUserForm from "./views/Setup/CompanySetup/User/UpdateUserForm";
import AddTaxTypes from "./views/Setup/CompanySetup/TaxTypes/AddTaxTypes";
import UpdateTaxTypes from "./views/Setup/CompanySetup/TaxTypes/UpdateTaxTypes";
import AddTaxGroupsForm from "./views/Setup/CompanySetup/TaxGroups/AddTaxGroups";
import UpdateTaxGroupsForm from "./views/Setup/CompanySetup/TaxGroups/UpdateTaxGroups";
import AddFiscalYear from "./views/Setup/CompanySetup/FiscalYear/AddFiscalYear";
import UpdateFiscalYear from "./views/Setup/CompanySetup/FiscalYear/UpdateFiscalYear";
import AddCurrencies from "./views/BankindAndGeneralLedger/Maintenance/Currencies/AddCurrencies";
import UpdateCurrencies from "./views/BankindAndGeneralLedger/Maintenance/Currencies/UpdateCurrencies";
import AddSalesPerson from "./views/Sales/Maintenance/SalesPersons/AddSalesPersonForm";
import UpdateSalesPerson from "./views/Sales/Maintenance/SalesPersons/UpdateSalesPersonForm";
import SalesPersonTable from "./views/Sales/Maintenance/SalesPersons/SalesPersonTable";
import AddSalesAreaForm from "./views/Sales/Maintenance/SalesAreas/AddSalesAreaForm";
import UpdateSalesAreaForm from "./views/Sales/Maintenance/SalesAreas/UpdateSalesAreaForm";
import SalesAreaTable from "./views/Sales/Maintenance/SalesAreas/SalesAreaTable";
import SalesTypesTable from "./views/Sales/Maintenance/SalesTypes/SalesTypesTable";
import AddSalesTypesForm from "./views/Sales/Maintenance/SalesTypes/AddSalesTypesForm";
import UpdateSalesTypesForm from "./views/Sales/Maintenance/SalesTypes/UpdateSalesTypesForm";
import CreditStatusTable from "./views/Sales/Maintenance/CreditStatusSetup/CreditStatusTable";
import AddCreditStatusForm from "./views/Sales/Maintenance/CreditStatusSetup/AddCreditStatusForm";
import UpdateCreditStatusForm from "./views/Sales/Maintenance/CreditStatusSetup/UpdateCreditStatusForm";
import AddManageCutomers from "./views/Sales/Maintenance/AddManageCustomers/AddManageCustomers";
import AddSalesGroupsForm from "./views/Sales/Maintenance/SalesGroups/AddSalesGroupsForm";
import UpdateSalesGroupsForm from "./views/Sales/Maintenance/SalesGroups/UpdateSalesGroupsForm";
import SalesGroupsTable from "./views/Sales/Maintenance/SalesGroups/SalesGroupsTable";
import Suppliers from "./views/Purchases/Maintenance/Suppliers/Suppliers";
import GeneralSettingsForm from "./views/Sales/Maintenance/AddManageCustomers/GeneralSettingsForm/GeneralSettingsForm";
import SupplierGeneralSettingsForm from "./views/Purchases/Maintenance/Suppliers/GeneralSettings/SupplierGeneralSettingsForm";
import UpdateSupplierGeneralSettingsForm from "./views/Purchases/Maintenance/Suppliers/GeneralSettings/UpdateSupplierGeneralSettingsForm";
import UnitsOfMeasureTable from "./views/ItemsAndInventory/Maintenance/UnitsOfMeasure/UnitsOfMeasureTable";
import AddUnitsOfMeasureForm from "./views/ItemsAndInventory/Maintenance/UnitsOfMeasure/AddUnitsOfMeasureForm";
import UpdateUnitsOfMeasureForm from "./views/ItemsAndInventory/Maintenance/UnitsOfMeasure/UpdateUnitsOfMeasureForm";
import Items from "./views/ItemsAndInventory/Maintenance/Items/Items";
import ItemsGeneralSettingsForm from "./views/ItemsAndInventory/Maintenance/Items/ItemsGeneralSettings/ItemsGeneralSettingsForm";
import InventoryLocationTable from "./views/ItemsAndInventory/Maintenance/InventoryLocations/InventoryLocationTable";
import AddInventoryLocationForm from "./views/ItemsAndInventory/Maintenance/InventoryLocations/AddInventoryLocationsForm";
import UpdateInventoryLocationForm from "./views/ItemsAndInventory/Maintenance/InventoryLocations/UpdateInventoryLocationsForm";
import ItemCategoriesTable from "./views/ItemsAndInventory/Maintenance/ItemCategories/ItemCategoriesTable";
import AddItemCategoriesForm from "./views/ItemsAndInventory/Maintenance/ItemCategories/AddItemCategoriesForm";
import UpdateItemCategoriesForm from "./views/ItemsAndInventory/Maintenance/ItemCategories/UpdateItemCategoriesForm";
import WorkCentresTable from "./views/Manufacturing/Maintenance/WorkCenter/WorkCentresTable";
import AddWorkCentresForm from "./views/Manufacturing/Maintenance/WorkCenter/AddWorkCentresForm";
import UpdateWorkCentresForm from "./views/Manufacturing/Maintenance/WorkCenter/UpdateWorkCentresForm";
import BankAccountsTable from "./views/BankindAndGeneralLedger/Maintenance/BankAccounts/BankAccountsTable";
import AddBankAccountsForm from "./views/BankindAndGeneralLedger/Maintenance/BankAccounts/AddBankAccountsForm";
import UpdateBankAccountsForm from "./views/BankindAndGeneralLedger/Maintenance/BankAccounts/UpdateBankAccountsForm";
import AddQuickEntriesForm from "./views/BankindAndGeneralLedger/Maintenance/QuickEntries/AddQuickEntriesForm";
import UpdateQuickEntriesForm from "./views/BankindAndGeneralLedger/Maintenance/QuickEntries/UpdateQuickEntriesForm";
import QuickEntriesTable from "./views/BankindAndGeneralLedger/Maintenance/QuickEntries/QuickEntriesTable";
import GlAccountGroupsTable from "./views/BankindAndGeneralLedger/Maintenance/GlAccountGroups/GlAccountGroupsTable";
import AddGlAccountGroupsForm from "./views/BankindAndGeneralLedger/Maintenance/GlAccountGroups/AddGlAccountGroupsForm";
import UpdateGlAccountGroupsForm from "./views/BankindAndGeneralLedger/Maintenance/GlAccountGroups/UpdateGlAccountGroupsForm";
import GlTypesTable from "./views/BankindAndGeneralLedger/Maintenance/GlTypes/GlTypesTable";
import AddGlTypeForm from "./views/BankindAndGeneralLedger/Maintenance/GlTypes/AddGlTypeForm";
import UpdateGlTypeForm from "./views/BankindAndGeneralLedger/Maintenance/GlTypes/UpdateGlTypeForm";
import RevaluateCurrenciesForm from "./views/BankindAndGeneralLedger/Maintenance/RevaluationOfCurrencyAccounts/RevaluateCurrencies";
import GlAccountClassesTable from "./views/BankindAndGeneralLedger/Maintenance/GlAccountClasses/GlAccountClassesTable";
import AddGlAccountClassesForm from "./views/BankindAndGeneralLedger/Maintenance/GlAccountClasses/AddGlAccountClassesForm";
import UpdateGlAccountClassesForm from "./views/BankindAndGeneralLedger/Maintenance/GlAccountClasses/UpdateGlAccountClassesForm";
import ClassTypesTable from "./views/BankindAndGeneralLedger/Maintenance/ClassTypes/ClassTypesTable";
import AddClassTypeForm from "./views/BankindAndGeneralLedger/Maintenance/ClassTypes/AddClassTypeForm";
import UpdateClassTypeForm from "./views/BankindAndGeneralLedger/Maintenance/ClassTypes/UpdateClassTypeForm";
import AddChartofAccounts from "./views/Setup/Maintenance/ChartOfAccounts/AddChartOfAccounts";
import ItemTaxTypesTable from "./views/Setup/CompanySetup/ItemTaxTypes/ItemTaxTypesTable";
import AddItemTaxTypes from "./views/Setup/CompanySetup/ItemTaxTypes/AddItemTaxTypes";
import UpdateItemTaxTypes from "./views/Setup/CompanySetup/ItemTaxTypes/UpdateItemTaxTypes";
import SystemGLSetupForm from "./views/Setup/CompanySetup/SystemAndGeneralGlSetup/SystemGLSetupForm";
import EmailSetupForm from "./views/Setup/CompanySetup/EmailSetup/EmailSetupForm";
import LoginIpSetupForm from "./views/Setup/CompanySetup/LoginIpSetup/LoginIpSetupForm";
import CustomersContactsTable from "./views/Sales/Maintenance/AddManageCustomers/Contacts/CustomersContactsTable";
import AttachmentsTable from "./views/Sales/Maintenance/AddManageCustomers/Attachments/AttachmentsTable";
import AddAttachmentsForm from "./views/Sales/Maintenance/AddManageCustomers/Attachments/AddAttachments";
import UpdateAttachmentsForm from "./views/Sales/Maintenance/AddManageCustomers/Attachments/UpdateAttachments";
import SalesOrdersTable from "./views/Sales/Maintenance/AddManageCustomers/SalesOrders/SalesOrdersTable";
import TransactionsTable from "./views/Sales/Maintenance/AddManageCustomers/Transactions/TransactionsTable";
import AccountTagsTable from "./views/BankindAndGeneralLedger/Maintenance/AccountTags/AccountTagsTable";
import AddAccountTagsForm from "./views/BankindAndGeneralLedger/Maintenance/AccountTags/AddAccountTagsForm";
import UpdateAccountTagsForm from "./views/BankindAndGeneralLedger/Maintenance/AccountTags/UpdateAccountTagsForm";
import AddExchangeRateForm from "./views/BankindAndGeneralLedger/Maintenance/ExchangeRates/AddExchangeRateForm";
import UpdateExchangeRateForm from "./views/BankindAndGeneralLedger/Maintenance/ExchangeRates/UpdateExchangeRateForm";
import ExchangeRateTable from "./views/BankindAndGeneralLedger/Maintenance/ExchangeRates/ExchangeRateTable";
import AddGlAccount from "./views/BankindAndGeneralLedger/Maintenance/GlAccounts/AddGlAccount";
import AddSalesPricingForm from "./views/ItemsAndInventory/Maintenance/Items/SalesPricing/AddSalesPricingForm";
import UpdateSalesPricingForm from "./views/ItemsAndInventory/Maintenance/Items/SalesPricing/UpdateSalesPricingForm";
import SalesPricingTable from "./views/ItemsAndInventory/Maintenance/Items/SalesPricing/SalesPricingTable";
import PurchasingPricingTable from "./views/ItemsAndInventory/Maintenance/Items/PurchasingPricing/PurchasingPricingTable";
import AddPurchasingPricingForm from "./views/ItemsAndInventory/Maintenance/Items/PurchasingPricing/AddPurchasingPricingForm";
import UpdatePurchasePricingForm from "./views/ItemsAndInventory/Maintenance/Items/PurchasingPricing/UpdatePurchasingPricingForm";
import AddStandardCostForm from "./views/ItemsAndInventory/Maintenance/Items/StandardCosts/AddStandardCostForm";
import StatusTable from "./views/ItemsAndInventory/Maintenance/Items/Status/StatusTable";
import SuppliersContactsTable from "./views/Purchases/Maintenance/Suppliers/Contacts/SuppliersContactsTable";
import SuppliersAttachmentsTable from "./views/Purchases/Maintenance/Suppliers/Attachments/SuppliersAttachmentsTable";
import AddSuppliersAttachmentsForm from "./views/Purchases/Maintenance/Suppliers/Attachments/AddSuppliersAttachmentsForm";
import UpdateSuppliersAttachmentsForm from "./views/Purchases/Maintenance/Suppliers/Attachments/UpdateSuppliersAttachmentsForm";
import SuppliersTransactionsTable from "./views/Purchases/Maintenance/Suppliers/Transactions/SuppliersTransactionsTable";
import SupplierPurchaseOrdersTable from "./views/Purchases/Maintenance/Suppliers/PurchaseOrders/SupplierPurchaseOrders";
import AddSuppliersContactsForm from "./views/Purchases/Maintenance/Suppliers/Contacts/AddSuppliersContactsForm";
import UpdateSuppliersContactsForm from "./views/Purchases/Maintenance/Suppliers/Contacts/UpdateSuppliersContactsForm";
import CustomersBranches from "./views/Sales/Maintenance/CustomerBranches/CustomerBranches";
import AddCustomerBranchesGeneralSettingForm from "./views/Sales/Maintenance/CustomerBranches/GeneralSettings/AddCustomerBranchesGeneralSettingForm";
import UpdateCustomerBranchesGeneralSettingForm from "./views/Sales/Maintenance/CustomerBranches/GeneralSettings/UpdateCustomerBranchesGeneralSettingForm";
import CustomerBranchesTable from "./views/Sales/Maintenance/CustomerBranches/GeneralSettings/CustomerBranchesTable";
import AddContactsForm from "./views/Sales/Maintenance/CustomerBranches/Contacts/AddContactsForm";
import UpdateContactsForm from "./views/Sales/Maintenance/CustomerBranches/Contacts/UpdateContactsForm";
import ItemAttachmentsTable from "./views/ItemsAndInventory/Maintenance/Items/Attachments/ItemAttachmentsTable";
import AddItemAttachmentsForm from "./views/ItemsAndInventory/Maintenance/Items/Attachments/AddItemAttachmentsForm";
import UpdateItemAttachmentsForm from "./views/ItemsAndInventory/Maintenance/Items/Attachments/UpdateItemAttachmentsForm";
import ReOrderLevelsForm from "./views/ItemsAndInventory/Maintenance/Items/ReOrderLevels/ReOrderLevelsForm";
import ItemTransactionsTable from "./views/ItemsAndInventory/Maintenance/Items/Transactions/ItemTransactionsTable";
import ForeignItemCodesTable from "./views/ItemsAndInventory/Maintenance/ForeignItemCodes/ForeignItemCodesTable";
import AddForeignItemCodesForm from "./views/ItemsAndInventory/Maintenance/ForeignItemCodes/AddForeignItemCodesForm";
import UpdateForeignItemCodesForm from "./views/ItemsAndInventory/Maintenance/ForeignItemCodes/UpdateForeignItemCodesForm";
import AddSalesKitsForm from "./views/ItemsAndInventory/Maintenance/SalesKits/AddSalesKitsForm";
import AddSalesKitComponentPage from "./views/ItemsAndInventory/Maintenance/SalesKits/AddSalesKitComponentPage";
import UpdateCustomersContactsForm from "./views/Sales/Maintenance/AddManageCustomers/Contacts/UpdateCustomersContactsForm";
import AddCustomersContactsForm from "./views/Sales/Maintenance/AddManageCustomers/Contacts/AddCustomersContactsForm";
import ContactsTable from "./views/Sales/Maintenance/CustomerBranches/Contacts/ContactsTable";
import VoidTransactionTable from "./views/Setup/Maintenance/VoidTransaction/VoidTransactionTable";
import VoidTransaction from "./views/Setup/Maintenance/VoidTransaction/VoidTransaction";
import ViewPrintTransactions from "./views/Setup/Maintenance/ViewPrintTransactions/ViewPrintTransactions";
import DocumentsTable from "./views/Setup/Maintenance/AttachDocuments/DocumentsTable";
import AddDocumentsForm from "./views/Setup/Maintenance/AttachDocuments/AddDocumentsForm";
import UpdateDocumentsForm from "./views/Setup/Maintenance/AttachDocuments/UpdateDocumentsForm";
import BackupRestore from "./views/Setup/Maintenance/BackupAndRestore/BackupRestore";
import CompanyTable from "./views/Setup/Maintenance/CreateUpdateCompany/CompanyTable";
import AddCompanyForm from "./views/Setup/Maintenance/CreateUpdateCompany/AddCompanyForm";
import UpdateCompanyForm from "./views/Setup/Maintenance/CreateUpdateCompany/UpdateCompanyForm";
import FixedAssetsLocationsTable from "./views/FixedAssets/Maintenance/FixedAssetsLocations/FixedAssetsLocationsTable";
import AddFixedAssetsLocations from "./views/FixedAssets/Maintenance/FixedAssetsLocations/AddFixedAssetsLocationsForm";
import UpdateFixedAssetsLocations from "./views/FixedAssets/Maintenance/FixedAssetsLocations/UpdateFixedAssetsLocationsForm";
import CostCenterTagsTable from "./views/CostCenters/Maintenance/CostCenterTags/CostCenterTagsTable";
import AddCostCenterTagsForm from "./views/CostCenters/Maintenance/CostCenterTags/AddCostCenterTagsForm";
import UpdateCostCenterTagsForm from "./views/CostCenters/Maintenance/CostCenterTags/UpdateCostCenterTagsForm";
import LanguagesTable from "./views/Setup/Maintenance/InstallUpdateLanguages/LanguagesTable";
import AddLanguagesForm from "./views/Setup/Maintenance/InstallUpdateLanguages/AddLanguagesForm";
import UpdateLanguagesForm from "./views/Setup/Maintenance/InstallUpdateLanguages/UpdateLanguagesForm";
import InstallExtensions from "./views/Setup/Maintenance/InstallActivateExtensions/InstallExtensions";
import InstallThemes from "./views/Setup/Maintenance/InstallActivateThemes/InstallThemes";
import SoftwareUpdateTable from "./views/Setup/Maintenance/SoftwareUpgrade/SoftwareUpgrade";
import InstallChartOfAccounts from "./views/Setup/Maintenance/InstallChartOfAccounts/InstallChartOfAccounts";
import SystemDiagnostics from "./views/Setup/Maintenance/SystemDiagnostic/SystemDiagnostics";
import UserLoginLogs from "./views/Setup/Maintenance/UserLoginLogs/UserLoginLogs";
import UpdateGeneralSettingsForm from "./views/Sales/Maintenance/AddManageCustomers/GeneralSettingsForm/UpdateGeneralSettingsForm";
import TransactionReferencesTable from "./views/Setup/CompanySetup/TransactionReferences/TransactionReferencesTable";
import AddTransactionReferencesForm from "./views/Setup/CompanySetup/TransactionReferences/AddTransactionReferencesForm";
import UpdateTransactionReferencesForm from "./views/Setup/CompanySetup/TransactionReferences/UpdateTransactionReferencesForm";
import AddPaymentTermsForm from "./views/Setup/Miscellaneous/PaymentTerms/AddPaymentTermsForm";
import UpdatePaymentTermsForm from "./views/Setup/Miscellaneous/PaymentTerms/UpdatePaymentTermsForm";
import PaymentTermsTable from "./views/Setup/Miscellaneous/PaymentTerms/PaymentTermsTable";
import ShippingCompanyTable from "./views/Setup/Miscellaneous/ShippingCompany/ShippingCompanyTable";
import AddShippingCompanyForm from "./views/Setup/Miscellaneous/ShippingCompany/AddShippinCompanyForm";
import UpdateShippingCompanyForm from "./views/Setup/Miscellaneous/ShippingCompany/UpdateShippinCompanyForm";
import ContactCategoryTable from "./views/Setup/Miscellaneous/ContactCategories/ContactCategoryTable";
import AddContactCategory from "./views/Setup/Miscellaneous/ContactCategories/AddContactCategoryForm";
import UpdateContactCategory from "./views/Setup/Miscellaneous/ContactCategories/UpdateContactCategoryForm";
import PrintersTable from "./views/Setup/Miscellaneous/Printers/PrintersTable";
import AddPrintersForm from "./views/Setup/Miscellaneous/Printers/AddPrintersForm";
import UpdatePrintersForm from "./views/Setup/Miscellaneous/Printers/UpdatePrintersForm";
import PosTable from "./views/Setup/Miscellaneous/PointsOfSales/PosTable";
import AddPosForm from "./views/Setup/Miscellaneous/PointsOfSales/AddPosForm";
import UpdatePosForm from "./views/Setup/Miscellaneous/PointsOfSales/UpdatePosForm";
import UpdateGlAccount from "./views/BankindAndGeneralLedger/Maintenance/GlAccounts/UpdateGlAccount";
import ProtectedRoute from "./components/ProtectedRoute";
import { PERMISSION_ID_MAP } from "./permissions/map";
import { getModulePermissionIds, getSubmenuPermissionIds } from "./permissions/navigationTree";
import ReOrderLevelsTable from "./views/ItemsAndInventory/Maintenance/ReOrderLevels/ReOrderLevelsTable";
import ViewSalesPricing from "./views/ItemsAndInventory/PricingAndCosts/SalesPricing/ViewSalesPricing";
import ViewPurchasingPricing from "./views/ItemsAndInventory/PricingAndCosts/PurchasingPricing/ViewPurchasingPricing";
import ViewAddStandardCostForm from "./views/ItemsAndInventory/PricingAndCosts/StandardCosts/ViewAddStandardCostForm";
import AddPurchasingPricingForm2 from "./views/ItemsAndInventory/PricingAndCosts/PurchasingPricing/AddPurchasingPricingForm2";
import UpdatePurchasingPricingForm2 from "./views/ItemsAndInventory/PricingAndCosts/PurchasingPricing/UpdatePurchasingPricingForm2";
import AddSalesPricingForm2 from "./views/ItemsAndInventory/PricingAndCosts/SalesPricing/AddSalesPricingForm2";
import UpdateSalesPricingForm2 from "./views/ItemsAndInventory/PricingAndCosts/SalesPricing/UpdateSalesPricingForm2";
import AddInventoryAdjustments from "./views/ItemsAndInventory/Transactions/InventoryAdjustments/AddInventoryAdjustments";
import AddInventoryLocationTransfers from "./views/ItemsAndInventory/Transactions/InventoryLocationTransfers/AddInventoryLocationTransfers";
import AddInventoryAdjustmentsSuccess from "./views/ItemsAndInventory/Transactions/InventoryAdjustments/AddInventoryAdjustmentsSuccess";
import ViewInventoryAdjustment from "./views/ItemsAndInventory/Transactions/InventoryAdjustments/ViewInventoryAdjustment";
import InventoryItemMovements from "./views/ItemsAndInventory/InquiriesAndReports/InventoryItemMovements/InventoryItemMovements";
import InventoryItemStatus from "./views/ItemsAndInventory/InquiriesAndReports/InventoryItemStatus/InventoryItemStatus";
import AddInventoryLocationTransfersSuccess from "./views/ItemsAndInventory/Transactions/InventoryLocationTransfers/AddInventoryLocationTransfersSuccess";
import ViewInventoryLocationTransfer from "./views/ItemsAndInventory/Transactions/InventoryLocationTransfers/ViewInventoryLocationTransfer";
import TemplateDelivery from "./views/Sales/Transactions/TemplateDelivery/TemplateDelivery";
import TemplateInvoice from "./views/Sales/Transactions/TemplateInvoice/TemplateInvoice";
import CreateAndPrintRecurrentInvoices from "./views/Sales/Transactions/RecurrentInvoices/CreateAndPrintRecurrentInvoices";
import DeliveryAgainstSalesOrders from "./views/Sales/Transactions/DeliveryAgainstSalesOrders/DeliveryAgainstSalesOrders";
import InvoiceAgainstSalesDelivery from "./views/Sales/Transactions/InvoiceAgainstSalesDelivery/InvoiceAgainstSalesDelivery";
import InvoicePrepaidOrders from "./views/Sales/Transactions/InvoicePrepaidOrders/InvoicePrepaidOrders";
import CustomerAllocations from "./views/Sales/Transactions/CustomerAllocations/CustomerAllocations";
import ItemTransactionsDetails from "./views/ItemsAndInventory/Maintenance/Items/Transactions/ItemLocationTransferDetails";
import ItemAdjustmentDetails from "./views/ItemsAndInventory/Maintenance/Items/Transactions/ItemAdjustmentDetails";
import Payments from "./views/BankindAndGeneralLedger/Transactions/Payments/Payments";
import SalesOrderEntry from "./views/Sales/Transactions/SalesOrderEntry/SalesOrderEntry";
import DirectDelivery from "./views/Sales/Transactions/DirectDelivery/DirectDelivery";
import DirectInvoice from "./views/Sales/Transactions/DirectInvoice/DirectInvoice";
import CustomerPayments from "./views/Sales/Transactions/CustomerPayments/CustomerPayments";
import CustomerCreditNotes from "./views/Sales/Transactions/CustomerCreditNotes/CustomerCreditNotes";
import SalesQuotationInquiry from "./views/Sales/InquiriesAndReports/SalesQuotationInquiry/SalesQuotationInquiry";
import SalesOrderInquiry from "./views/Sales/InquiriesAndReports/SalesOrderInquiry/SalesOrderInquiry";
import CustomerAllocationInquiry from "./views/Sales/InquiriesAndReports/CustomerAllocationInquiry/CustomerAllocationInquiry";
import CustomerTransactionInquiry from "./views/Sales/InquiriesAndReports/CustomerTransactionInquiry/CustomerTransactionInquiry";
import SalesQuotationEntrySuccess from "./views/Sales/Transactions/SalesQuotationEntry/SalesQuotationEntrySuccess";
import ViewSalesQuotationEntry from "./views/Sales/Transactions/SalesQuotationEntry/ViewSalesQuotationEntry";
import SalesOrderEntrySuccess from "./views/Sales/Transactions/SalesOrderEntry/SalesOrderEntrySuccess";
import ViewSalesOrderEntry from "./views/Sales/Transactions/SalesOrderEntry/ViewSalesOrderEntry";
import CustomerDelivery from "./views/Sales/Transactions/CustomerDelivery/CustomerDelivery";
import DirectDeliverySuccess from "./views/Sales/Transactions/DirectDelivery/DirectDeliverySuccess";
import ViewDirectDelivery from "./views/Sales/Transactions/DirectDelivery/ViewDirectDelivery";
import DirectInvoiceSuccess from "./views/Sales/Transactions/DirectInvoice/DirectInvoiceSuccess";

import CustomerPaymentsSuccess from "./views/Sales/Transactions/CustomerPayments/CustomerPaymentsSuccess";
import ViewCustomerPayments from "./views/Sales/Transactions/CustomerPayments/ViewCustomerPayments";
import CustomerCreditNotesSuccess from "./views/Sales/Transactions/CustomerCreditNotes/CustomerCreditNotesSuccess";
import ViewCustomerCreditNotes from "./views/Sales/Transactions/CustomerCreditNotes/ViewCustomerCreditNotes";
import ViewDirectInvoice from "./views/Sales/Transactions/DirectInvoice/viewDirectInvoice";
import ViewSalesGLJournalEntries from "./views/Sales/Transactions/GLJournalEntries/ViewSalesGLJournalEntries";
import ViewPurchasesGLJournalEntries from "./views/Purchases/Transactions/GLJournalEntries/ViewPurchasesGLJournalEntries";
import ViewInventoryGLJournalEntries from "./views/ItemsAndInventory/Transactions/GLJournalEntries/ViewInventoryGLJournalEntries";
import ViewFixedAssetsGLJournalEntries from "./views/FixedAssets/Transactions/GLJournalEntries/ViewFixedAssetsGLJournalEntries";


import Deposits from "./views/BankindAndGeneralLedger/Transactions/Deposit/Deposit";
import BankAccountTransfers from "./views/BankindAndGeneralLedger/Transactions/BankAccountTransfers/BankAccountTransfers";
import JournalEntry from "./views/BankindAndGeneralLedger/Transactions/JournalEntry/JournalEntry";
import ClosingGlTransactions from "./views/BankindAndGeneralLedger/Maintenance/ClosingGlTransactions/ClosingGlTransactions";
import BudgetEntry from "./views/BankindAndGeneralLedger/Transactions/BudgetEntry/BudgetEntry";
import ReconcileBankAccount from "./views/BankindAndGeneralLedger/Transactions/ReconcileBankAccount/ReconcileBankAccount";
import JournalInquiry from "./views/BankindAndGeneralLedger/InquiriesAndReports/JournalInquiry/JournalInquiry";
import GLInquiry from "./views/BankindAndGeneralLedger/InquiriesAndReports/GLInquiry/GLInquiry";
import BankAccountInquiry from "./views/BankindAndGeneralLedger/InquiriesAndReports/BankAccountInquiry/BankAccountInquiry";
import TaxInquiry from "./views/BankindAndGeneralLedger/InquiriesAndReports/TaxInquiry/TaxInquiry";
import TrialBalance from "./views/BankindAndGeneralLedger/InquiriesAndReports/TrialBalance/TrialBalance";
import BalanceSheetDrilldown from "./views/BankindAndGeneralLedger/InquiriesAndReports/BalanceSheetDrilldown/BalanceSheetDrilldown";
import ProfitAndLossDrilldown from "./views/BankindAndGeneralLedger/InquiriesAndReports/ProfitAndLossDrilldown/ProfitAndLossDrilldown";
import PaymentsSuccess from "./views/BankindAndGeneralLedger/Transactions/Payments/PaymentsSuccess";
import GLPostings from "./views/BankindAndGeneralLedger/Transactions/Payments/GLPostings";
import DepositSuccess from "./views/BankindAndGeneralLedger/Transactions/Deposit/DepositSuccess";
import RevenueCostAccruals from "./views/BankindAndGeneralLedger/Transactions/RevenueCostAccruals/RevenueCostAccruals";
import BankAccountTransferSuccess from "./views/BankindAndGeneralLedger/Transactions/BankAccountTransfers/BankAccountTransferSuccess";
import JournalEntrySuccess from "./views/BankindAndGeneralLedger/Transactions/JournalEntry/JournalEntrySuccess";
import ViewJournalEntry from "./views/BankindAndGeneralLedger/Transactions/JournalEntry/ViewJournalEntry";

import Reports from "./views/Reports/Reports";
import BillsOfMaterialTable from "./views/Manufacturing/Maintenance/BillsOfMaterial/BillsOfMaterialTable";
import CustomerDeliverySuccess from "./views/Sales/Transactions/CustomerDelivery/CustomerDeliverySuccess";
import CustomerInvoiceSuccess from "./views/Sales/Transactions/CustomerInvoice/CustomerInvoiceSuccess";
import PurchaseOrderEntry from "./views/Purchases/Transactions/PurchaseOrderEntry/PurchaseOrderEntry";
import PurchaseOrderEntrySuccess from "./views/Purchases/Transactions/PurchaseOrderEntry/PurchaseOrderEntrySuccess";
import ViewPurchaseOrderEntry from "./views/Purchases/Transactions/PurchaseOrderEntry/ViewPurchaseOrderEntry";
import OutstandingPurchaseOrdersMaintenance from "./views/Purchases/Transactions/OutstandingPurchaseOrdersMaintenance/OutstandingPurchaseOrdersMaintenance";
import DirectGRN from "./views/Purchases/Transactions/DirectGRN/DirectGRN";
import DirectGRNSuccess from "./views/Purchases/Transactions/DirectGRN/DirectGRNSuccess";
import ViewDirectGRN from "./views/Purchases/Transactions/DirectGRN/ViewDirectGRN";
import DirectSupplierInvoice from "./views/Purchases/Transactions/DirectSupplierInvoice/DirectSupplierInvoice";
import DirectSupplierInvoiceSuccess from "./views/Purchases/Transactions/DirectSupplierInvoice/DirectSupplierInvoiceSuccess";
import ViewDirectSupplierInvoice from "./views/Purchases/Transactions/DirectSupplierInvoice/ViewDirectSupplierInvoice";
import SupplierPaymentEntry from "./views/Purchases/Transactions/SupplierPaymentEntry/SupplierPaymentEntry";
import SupplierPaymentEntrySuccess from "./views/Purchases/Transactions/SupplierPaymentEntry/SupplierPaymentEntrySuccess";
import ViewSupplierPaymentEntry from "./views/Purchases/Transactions/SupplierPaymentEntry/ViewSupplierPaymentEntry";
import SupplierAllocations from "./views/Purchases/Transactions/SupplierAllocations/SupplierAllocations";
import PurchaseOrdersInquiry from "./views/Purchases/InquiriesAndReports/PurchaseOrdersInquiry/PurchaseOrdersInquiry";
import SupplierTransactionInquiry from "./views/Purchases/InquiriesAndReports/SupplierTransactionInquiry/SupplierTransactionInquiry";
import SupplierAllocationInquiry from "./views/Purchases/InquiriesAndReports/SupplierAllocationInquiry/SupplierAllocationInquiry";
import ReceivePurchaseOrderItems from "./views/Purchases/Transactions/ReceivePurchaseOrderItems/ReceivePurchaseOrderItems";
import ReceivePurchaseOrderItemsSuccess from "./views/Purchases/Transactions/ReceivePurchaseOrderItems/ReceivePurchaseOrderItemsSuccess";
import AddBillsOfMaterialForm from "./views/Manufacturing/Maintenance/BillsOfMaterial/AddBillsOfMaterialForm";
import UpdateBillsOfMaterialForm from "./views/Manufacturing/Maintenance/BillsOfMaterial/UpdateBillsOfMaterialForm";
import CostedBillOfMaterialInquiry from "./views/Manufacturing/InquiriesAndReports/CostedBillOfMaterialInquiry/CostedBillOfMaterialInquiry";
import InventoryItemWhereUsedInquiry from "./views/Manufacturing/InquiriesAndReports/InventoryItemWhereUsedInquiry/InventoryItemWhereUsedInquiry";
import WorkOrderInquiry from "./views/Manufacturing/InquiriesAndReports/WorkOrderInquiry/WorkOrderInquiry";
import WorkOrderEntry from "./views/Manufacturing/Transactions/WorkOrderEntry/WorkOrderEntry";
import OutstandingWorkOrders from "./views/Manufacturing/Transactions/OutstandingWorkOrders/OutstandingWorkOrders";
import WorkOrderEntrySuccess from "./views/Manufacturing/Transactions/WorkOrderEntry/WorkOrderEntrySuccess";
import ViewWorkOrderEntry from "./views/Manufacturing/Transactions/WorkOrderEntry/ViewWorkOrderEntry";
import ViewGLJournalEntry from "./views/Manufacturing/Transactions/WorkOrderEntry/ViewGLJournalEntry";
import UpdateWorkOrderEntry from "./views/Manufacturing/Transactions/WorkOrderEntry/UpdateWorkOrderEntry";
import SupplierInvoice from "./views/Purchases/Transactions/SupplierInvoice/SupplierInvoice";
import SupplierInvoiceSuccess from "./views/Purchases/Transactions/SupplierInvoice/SupplierInvoiceSuccess";
import ViewSupplierInvoice from "./views/Purchases/Transactions/SupplierInvoice/ViewSupplierInvoice";
import SupplierCreditNote from "./views/Purchases/Transactions/SupplierCreditNote/SupplierCreditNote";
import ViewSupplierCreditNote from "./views/Purchases/Transactions/SupplierCreditNote/ViewSupplierCreditNote";
import SupplierCreditNoteSuccess from "./views/Purchases/Transactions/SupplierCreditNote/SupplierCreditNoteSuccess";
import CostCenterEntry from "./views/CostCenters/Transactions/CostCenterEntry/CostCenterEntry";
import CostCenterEntrySuccess from "./views/CostCenters/Transactions/CostCenterEntry/CostCenterEntrySuccess";
import OutstandingCostCenters from "./views/CostCenters/Transactions/OutstandingCostCenters/OutstandingCostCenters";
import CostCenterInquiry from "./views/CostCenters/InquiriesAndReports/CostCenterInquiry/CostCenterInquiry";
import ViewCostCenter from "./views/CostCenters/InquiriesAndReports/ViewCostCenter/ViewCostCenter";
import FixedAssetsLocationTransfers from "./views/FixedAssets/Transactions/FixedAssetsLocationTransfers/FixedAssetsLocationTransfers";
import FixedAssetsInquiry from "./views/FixedAssets/InquiriesAndReports/FixedAssetsInquiry/FixedAssetsInquiry";
import FixedAssetsCategoriesTable from "./views/FixedAssets/Maintenance/FixedAssetsCategories/FixedAssetsCategoriesTable";
import AddFixedAssetsCategories from "./views/FixedAssets/Maintenance/FixedAssetsCategories/AddFixedAssetsCategories";
import FixedAssetClassesTable from "./views/FixedAssets/Maintenance/FixedAssetClasses/FixedAssetClassesTable";
import AddFixedAssetClasses from "./views/FixedAssets/Maintenance/FixedAssetClasses/AddFixedAssetClasses";
import FixedAssets from "./views/FixedAssets/Maintenance/FixedAssets/FixedAssets";
import UpdateFixedAssetsGeneralSettingsForm from "./views/FixedAssets/Maintenance/FixedAssets/FixedAssetsGeneralSettings/UpdateFixedAssetsGeneralSettingsForm";
import FixedAssetsTransactionsTable from "./views/FixedAssets/Maintenance/FixedAssets/Transactions/FixedAssetsTransactionsTable";
import FixedAssetsLocationTransfersSuccess from "./views/FixedAssets/Transactions/FixedAssetsLocationTransfers/FixedAssetsLocationTransfersSuccess";
import ViewFixedAssetsLocationTransfers from "./views/FixedAssets/Transactions/FixedAssetsLocationTransfers/ViewFixedAssetsLocationTransfers";
import FixedAssetsDisposal from "./views/FixedAssets/Transactions/FixedAssetsDisposal/FixedAssetsDisposal";
import FixedAssetsPurchase from "./views/FixedAssets/Transactions/FixedAssetsPurchase/FixedAssetsPurchase";
import FixedAssetsPurchaseSuccess from "./views/FixedAssets/Transactions/FixedAssetsPurchase/FixedAssetsPurchaseSuccess";
import ViewFixedAssetsPurchase from "./views/FixedAssets/Transactions/FixedAssetsPurchase/ViewFixedAssetsPurchase";
import FixedAssetsSale from "./views/FixedAssets/Transactions/FixedAssetsSale/FixedAssetsSale";
import FixedAssetsSaleSuccess from "./views/FixedAssets/Transactions/FixedAssetsSale/FixedAssetsSaleSuccess";
import ViewFixedAssetsSale from "./views/FixedAssets/Transactions/FixedAssetsSale/ViewFixedAssetsSale";
import FixedAssetsMovements from "./views/FixedAssets/InquiriesAndReports/FixedAssetsMovements/FixedAssetsMovements";
import FixedAssetsDisposalSuccess from "./views/FixedAssets/Transactions/FixedAssetsDisposal/FixedAssetsDisposalSuccess";
import ViewFixedAssetsDisposal from "./views/FixedAssets/Transactions/FixedAssetsDisposal/ViewFixedAssetsDisposal";
import ProcessDepreciation from "./views/FixedAssets/Transactions/ProcessDepreciation/ProcessDepreciation";
import ProcessDepreciationSuccess from "./views/FixedAssets/Transactions/ProcessDepreciation/ProcessDepreciationSuccess";
import UpdateSalesOrderEntry from "./views/Sales/Transactions/SalesOrderEntry/UpdateSalesOrderEntry";
import UpdateCustomerInvoice from "./views/Sales/Transactions/CustomerInvoice/UpdateCustomerInvoice";
import UpdateCustomerInvoiceSuccess from "./views/Sales/Transactions/CustomerInvoice/UpdateCustomerInvoiceSuccess";
import UpdateCustomerDelivery from "./views/Sales/Transactions/InvoiceAgainstSalesDelivery/UpdateCustomerDelivery";
import UpdateCustomerDeliveryInvoice from "./views/Sales/Transactions/CustomerDelivery/UpdateCustomerDeliveryInvoice";
import UpdateCustomerDeliverySuccess from "./views/Sales/Transactions/InvoiceAgainstSalesDelivery/UpdateCustomerDeliverySuccess";
import ViewCustomerAllocations from "./views/Sales/Transactions/CustomerAllocations/ViewCustomerAllocations";
import UpdatePurchaseOrderEntry from "./views/Purchases/Transactions/PurchaseOrderEntry/UpdatePurchaseOrderEntry";
import ViewSupplierAllocations from "./views/Purchases/Transactions/SupplierAllocations/ViewSupplierAllocations";
import ModifySalesInvoice from "./views/BankindAndGeneralLedger/InquiriesAndReports/JournalInquiry/ModifySalesInvoice";
import EditCostCenterEntry from "./views/CostCenters/Transactions/CostCenterEntry/EditCostCenterEntry";
import CustomerPaymentEntry from "./views/BankindAndGeneralLedger/InquiriesAndReports/JournalInquiry/CustomerPaymentEntry";
import ModifyPurchaseInvoice from "./views/BankindAndGeneralLedger/InquiriesAndReports/JournalInquiry/ModifyPurchaseInvoice";
import UpdateSalesOrderEntrySuccess from "./views/Sales/Transactions/SalesOrderEntry/UpdateSalesOrderEntrySuccess";
import ViewCustomerDelivery from "./views/Sales/Transactions/CustomerDelivery/ViewCustomerDelivery";
import FinalInvoiceEntry from "./views/Sales/Transactions/InvoicePrepaidOrders/FinalInvoiceEntry";
import ViewFinalInvoice from "./views/Sales/Transactions/InvoicePrepaidOrders/ViewFinalInvoice";
import FinalInvoiceSuccess from "./views/Sales/Transactions/InvoicePrepaidOrders/FinalInvoiceSuccess";
import UpdateSalesQuotationEntry from "./views/Sales/Transactions/SalesQuotationEntry/UpdateSalesQuotationEntry";
import UpdateFixedAssetClasses from "./views/FixedAssets/Maintenance/FixedAssetClasses/UpdateFixedAssetClasses";
import UpdateFixedAssetsCategories from "./views/FixedAssets/Maintenance/FixedAssetsCategories/UpdateFixedAssetsCategories";
import UpdatedSalesQuotationEntrySuccess from "./views/Sales/Transactions/SalesQuotationEntry/UpdatedSalesQuotationEntrySuccess";
import SalesOrderEntryQuotation from "./views/Sales/Transactions/SalesOrderEntry/SalesOrderEntryQuotation";
import CreditInvoice from "./views/Sales/Transactions/CustomerCreditNotes/CreditInvoice";
import UpdateCustomerCreditNotes from "./views/Sales/Transactions/CustomerCreditNotes/UpdateCustomerCreditNotes";
import UpdateCompanySetupForm from "./views/Setup/CompanySetup/CompanySetup/UpdateCompanySetupForm";
import ReleaseWorkOrder from "./views/Manufacturing/Transactions/OutstandingWorkOrders/ReleaseWorkOrder";
import IssueWorkOrder from "./views/Manufacturing/Transactions/OutstandingWorkOrders/IssueWorkOrder";
import CostWorkOrder from "./views/Manufacturing/Transactions/OutstandingWorkOrders/CostWorkOrder";
import ProduceWorkOrder from "./views/Manufacturing/Transactions/OutstandingWorkOrders/ProduceWorkOrder";
import CreditInvoiceSuccess from "./views/Sales/Transactions/CustomerCreditNotes/CreditInvoiceSuccess";
import ViewCreditInvoice from "./views/Sales/Transactions/CustomerCreditNotes/ViewCreditInvoice";
import UpdateCustomerPayments from "./views/Sales/Transactions/CustomerPayments/UpdateCustomerPayments";
import ViewUpdatedCustomerCreditNotes from "./views/Sales/Transactions/CustomerCreditNotes/ViewUpdatedCustomerCreditNotes";
import UpdatedCustomerCreditNotesSuccess from "./views/Sales/Transactions/CustomerCreditNotes/UpdatedCustomerCreditNotesSuccess";
import DeliveyNoteInvoice from "./views/Sales/Transactions/CustomerInvoice/DeliveryNoteInvoice";
import ViewReceivePurchaseOrderItems from "./views/Purchases/Transactions/ReceivePurchaseOrderItems/ViewReceivePurchaseOrderItems";
import UpdateRecurrentInvoices from "./views/Sales/Maintenance/RecurrentInvoices/UpdateRecurrentInvoices";
import AddRecurrentInvoices from "./views/Sales/Maintenance/RecurrentInvoices/AddRecurrentInvoices";
import ViewRecurrentInvoices from "./views/Sales/Maintenance/RecurrentInvoices/ViewRecurrentInvoices";
import CreateInvoice from "./views/Sales/Transactions/RecurrentInvoices/CreateInvoice";

const LoginPage = React.lazy(() => import("./views/LoginPage/LoginPage"));
const BackendConfigPage = React.lazy(
  () => import("./views/LoginPage/BackendConfigPage")
);
const RegistrationPage = React.lazy(
  () => import("./views/RegistrationPage/RegistrationPage")
);
// const InsightsPage = React.lazy(() => import("./views/Insights/Insight"));

//Administration
const UserTable = React.lazy(() => import("./views/Administration/UserTable"));
const AccessManagementTable = React.lazy(
  () => import("./views/Administration/AccessManagementTable")
);
const OrganizationTable = React.lazy(
  () => import("./views/Administration/OrganizationSettings/OrganizationSettingsTable")
);

const UnderDevelopment = React.lazy(
  () => import("./components/UnderDevelopment")
);

//sustainability apps
//chemical management
// const ChemicalRequestTable = React.lazy(
//   () => import("./views/ChemicalMng/ChemicalRequestTable")
// );
// const ChemicalPurchaseInventoryTable = React.lazy(
//   () => import("./views/ChemicalMng/ChemicalPurchaseInventoryTable")
// );
// const ChemicalTransactionTable = React.lazy(
//   () => import("./views/ChemicalMng/TransactionTable")
// );
// const ChemicalDashboard = React.lazy(
//   () => import("./views/ChemicalMng/Dashboard")
// );

//health and safety apps
//document
const DocumentRegister = React.lazy(
  () => import("./views/DocumentsPage/DocumentsTable")
);



const Autocomplete = React.lazy(
  () => import("./views/Components/Autocomplete")
);
const TextField = React.lazy(
  () => import("./views/Components/TextField")
);
const DatePickers = React.lazy(
  () => import("./views/Components/DatePickers")
);
const OtherInputs = React.lazy(
  () => import("./views/Components/OtherInputs")
);


const AccordianAndDividers = React.lazy(
  () => import("./views/Components/AccordianAndDividers")
);
function withLayout(Layout: any, Component: any, restrictAccess = false) {
  return (
    <Layout>
      <Suspense
        fallback={
          <>
            <PageLoader />
          </>
        }
      >
        {restrictAccess ? <PermissionDenied /> : <Component />}
      </Suspense>
    </Layout>
  );
}

function withoutLayout(Component: React.LazyExoticComponent<any>) {
  return (
    <Suspense
      fallback={
        <>
          <PageLoader />
        </>
      }
    >
      <Component />
    </Suspense>
  );
}

// Note: auth and permission checks are handled by `src/context/AuthContext` and
// `src/components/ProtectedRoute`. Use the component below to guard routes.

const AppRoutes = () => {
  const token = localStorage.getItem("token");
  const { data: user, status } = useQuery<User>({
    queryKey: ["current-user"],
    queryFn: validateUser,
    enabled: !!token, // Only run query if token exists
  });

  const userPermissionObject = useMemo(() => {
    if (user && user?.permissionObject) {
      return user?.permissionObject;
    }
  }, [user]);
  // console.log("user", user);
  return (
    <Routes>
      <Route path="/" element={withoutLayout(LoginPage)} />
      <Route path="/configure" element={withoutLayout(BackendConfigPage)} />
      <Route path="/register" element={withoutLayout(RegistrationPage)} />
      <Route path="/not-authorized" element={withLayout(MainLayout, PermissionDenied)} />
      <Route element={<ProtectedRoute />}>
        <Route
          path="/dashboard"
          element={withLayout(MainLayout, Dashboard)}
        />
        <Route path="/supermarket" element={withLayout(MainLayout, SupermarketHub)} />
        <Route path="/supermarket/pos-checkout" element={withLayout(MainLayout, PosCheckoutPage)} />
        <Route path="/supermarket/sales-analytics" element={withLayout(MainLayout, SalesAnalyticsPage)} />
        <Route path="/supermarket/low-stock" element={withLayout(MainLayout, LowStockPage)} />
        <Route path="/supermarket/loyalty-tiers" element={withLayout(MainLayout, LoyaltyTiersPage)} />
        <Route path="/supermarket/loyalty-cards" element={withLayout(MainLayout, LoyaltyCardsPage)} />
        <Route path="/supermarket/offers" element={withLayout(MainLayout, OffersPage)} />
        <Route path="/supermarket/win-back" element={withLayout(MainLayout, WinBackPage)} />
        <Route path="/supermarket/stock-damage" element={withLayout(MainLayout, StockDamagePage)} />
        <Route path="/supermarket/pos-shifts" element={withLayout(MainLayout, PosShiftPage)} />
      </Route>

      {/* Administration */}
      <Route
        path="/admin/organization-settings"
        element={withLayout(
          MainLayout,
          OrganizationTable,
          !userPermissionObject?.[PermissionKeys.ADMIN_USERS_VIEW]
        )}
      />

      <Route
        path="/admin/users"
        element={withLayout(
          MainLayout,
          UserTable,
          !userPermissionObject?.[PermissionKeys.ADMIN_USERS_VIEW]
        )}
      />
      <Route
        path="/admin/access-management"
        element={withLayout(
          MainLayout,
          AccessManagementTable,
          !userPermissionObject?.[PermissionKeys.ADMIN_ACCESS_MNG_VIEW]
        )}
      />

      {/* Audit & Inspection */}
      {/* <Route
          path="/input-fields/autocomplete"
          element={withLayout(
            MainLayout,
            Autocomplete,
            !userPermissionObject?.[
            PermissionKeys.AUDIT_INSPECTION_DASHBOARD_VIEW
            ]
          )}
        />
        <Route
          path="/input-fields/textfield"
          element={withLayout(
            MainLayout,
            TextField,
            !userPermissionObject?.[
            PermissionKeys.AUDIT_INSPECTION_DASHBOARD_VIEW
            ]
          )}
        />
        <Route
          path="/input-fields/date-pickers"
          element={withLayout(
            MainLayout,
            DatePickers,
            !userPermissionObject?.[
            PermissionKeys.AUDIT_INSPECTION_DASHBOARD_VIEW
            ]
          )}
        />
        <Route
          path="/input-fields/other-inputs"
          element={withLayout(
            MainLayout,
            OtherInputs,
            !userPermissionObject?.[
            PermissionKeys.AUDIT_INSPECTION_DASHBOARD_VIEW
            ]
          )}
        />
        <Route
          path="/components/accordian-divider"
          element={withLayout(
            MainLayout,
            AccordianAndDividers,
            !userPermissionObject?.[
            PermissionKeys.AUDIT_INSPECTION_DASHBOARD_VIEW
            ]
          )}
        />
        <Route
          path="/audit-inspection/calendar"
          element={withLayout(
            MainLayout,
            AuditCalendar */}
            // !userPermissionObject?.[
      //   PermissionKeys.AUDIT_INSPECTION_CALENDAR_VIEW
      // ]
      {/* )}
        /> */}
      {/* <Route
          path="/audit-inspection/internal-audit/form-builder"
          element={withLayout(
            MainLayout,
            AuditBuilderTable,
            !userPermissionObject?.[
            PermissionKeys.AUDIT_INSPECTION_INTERNAL_AUDIT_FORM_BUILDER_VIEW
            ]
          )}
        />
        <Route
          path="/audit-inspection/internal-audit/scheduled-audits"
          element={withLayout(
            MainLayout,
            InternalAuditTable,
            !userPermissionObject?.[
            PermissionKeys.AUDIT_INSPECTION_INTERNAL_AUDIT_REGISTER_VIEW
            ]
          )}
        />
        <Route
          path="/audit-inspection/external-audit"
          element={withLayout(
            MainLayout,
            () => (
              <UnderDevelopment pageName="Audit & Inspection > External Audit" />
            ) */}
            // !userPermissionObject?.[
      //   PermissionKeys.AUDIT_INSPECTION_EXTERNAL_AUDIT_QUEUE_VIEW
      // ]
      {/* )}
        /> */}

      {/* sustainability apps */}


      {/* document */}
      <Route
        path="/document"
        element={withLayout(
          MainLayout,
          DocumentRegister,
          !userPermissionObject?.[PermissionKeys.DOCUMENT_REGISTER_VIEW]
        )}
      />
      <Route
        path="/sales/inquiriesandreports/customer-transaction-inquiry/update-customer-invoice"
        element={withLayout(MainLayout, UpdateCustomerInvoice)}
      />
      <Route
        path="/occupational-health/clinical-suite/consultation"
        element={withLayout(
          MainLayout,
          () => (
            <UnderDevelopment pageName="Clinical Suite > Consultation" />
          )
          // !userPermissionObject?.[
          //   PermissionKeys
          //     .OCCUPATIONAL_HEALTH_CLINICAL_SUITE_CONSULTATION_VIEW
          // ]
        )}
      />

      <Route
        path="/occupational-health/clinical-suite/pharmacy-queue"
        element={withLayout(
          MainLayout,
          () => (
            <UnderDevelopment pageName="Clinical Suite > Pharmacy Queue" />
          )
          // !userPermissionObject?.[
          //   PermissionKeys
          //     .OCCUPATIONAL_HEALTH_CLINICAL_SUITE_PHARMACY_QUEUE_VIEW
          // ]
        )}
      />

      <Route path="/setup" element={<ProtectedRoute required={getModulePermissionIds("Setup")} />}>
        <Route
          path="companysetup"
          element={withLayout(MainLayout, CompanySetup)}
        />
        <Route
          path="companysetup/company-setup"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Company parameters']}>
              {withLayout(MainLayout, CompanySetupForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/update-company-setup/:id"
          element={withLayout(MainLayout, UpdateCompanySetupForm)}
        />
        {/* <Route
          path="companysetup/user-account-setup"
          element={withLayout(MainLayout, UserManagementTable)}
        /> */}

        {/* users setup page - require Users setup permission */}
        <Route
          path="companysetup/user-account-setup"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Users setup']}>
              {withLayout(MainLayout, UserManagementTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/add-user"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Users setup']}>
              {withLayout(MainLayout, AddUserForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/update-user/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Users setup']}>
              {withLayout(MainLayout, UpdateUserForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/access-setup"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Access levels edition']}>
              {withLayout(MainLayout, AddUserAccessForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/department-setup"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Department setup page']}>
              {withLayout(MainLayout, DepartmentSetupForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/edit-access-setup"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Access levels edition']}>
              {withLayout(MainLayout, UpdateUserAccessForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/fiscal-years"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fiscal years maintenance']}>
              {withLayout(MainLayout, FiscalYearTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/add-fiscal-year"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fiscal years maintenance']}>
              {withLayout(MainLayout, AddFiscalYear)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/update-fiscal-year/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fiscal years maintenance']}>
              {withLayout(MainLayout, UpdateFiscalYear)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/tax-groups"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Tax groups']}>
              {withLayout(MainLayout, TaxGroupsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/add-tax-groups"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Tax groups']}>
              {withLayout(MainLayout, AddTaxGroupsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/update-tax-groups/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Tax groups']}>
              {withLayout(MainLayout, UpdateTaxGroupsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/taxes"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Tax rates']}>
              {withLayout(MainLayout, TaxTypesTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/add-tax-types"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Tax rates']}>
              {withLayout(MainLayout, AddTaxTypes)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/update-tax-types/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Tax rates']}>
              {withLayout(MainLayout, UpdateTaxTypes)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/item-tax-types"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Item tax type definitions']}>
              {withLayout(MainLayout, ItemTaxTypesTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/add-item-tax-types"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Item tax type definitions']}>
              {withLayout(MainLayout, AddItemTaxTypes)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/update-item-tax-types/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Item tax type definitions']}>
              {withLayout(MainLayout, UpdateItemTaxTypes)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/system-and-general-gl-setup"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Company GL setup']}>
              {withLayout(MainLayout, SystemGLSetupForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/email-setup"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Email setup page']}>
              {withLayout(MainLayout, EmailSetupForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/login-ip-restriction"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Login IP restriction page']}>
              {withLayout(MainLayout, LoginIpSetupForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/transaction-references"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Stock transactions view']}>
              {withLayout(MainLayout, TransactionReferencesTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/add-transaction-references"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Stock transactions view']}>
              {withLayout(MainLayout, AddTransactionReferencesForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="companysetup/update-transaction-references/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Stock transactions view']}>
              {withLayout(MainLayout, UpdateTransactionReferencesForm)}
            </ProtectedRoute>
          }
        />

        <Route path="miscellaneous" element={withLayout(MainLayout, Miscellaneous)} />

        <Route
          path="miscellaneous/payment-terms"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Payment terms']}>
              {withLayout(MainLayout, PaymentTermsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="miscellaneous/add-payment-term"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Payment terms']}>
              {withLayout(MainLayout, AddPaymentTermsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="miscellaneous/update-payment-term/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Payment terms']}>
              {withLayout(MainLayout, UpdatePaymentTermsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="miscellaneous/shipping-company"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Shipping ways']}>
              {withLayout(MainLayout, ShippingCompanyTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="miscellaneous/add-shipping-company"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Shipping ways']}>
              {withLayout(MainLayout, AddShippingCompanyForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="miscellaneous/contact-categories"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Contact categories']}>
              {withLayout(MainLayout, ContactCategoryTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="miscellaneous/add-contact-category"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Contact categories']}>
              {withLayout(MainLayout, AddContactCategory)}
            </ProtectedRoute>
          }
        />
        <Route
          path="miscellaneous/update-contact-category/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Contact categories']}>
              {withLayout(MainLayout, UpdateContactCategory)}
            </ProtectedRoute>
          }
        />
        <Route
          path="miscellaneous/update-shipping-company/:shipper_id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Shipping ways']}>
              {withLayout(MainLayout, UpdateShippingCompanyForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="miscellaneous/printers"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Printers configuration']}>
              {withLayout(MainLayout, PrintersTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="miscellaneous/add-printer"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Printers configuration']}>
              {withLayout(MainLayout, AddPrintersForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="miscellaneous/update-printer"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Printers configuration']}>
              {withLayout(MainLayout, UpdatePrintersForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="miscellaneous/point-of-sale"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Point of Sale definitions']}>
              {withLayout(MainLayout, PosTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="miscellaneous/add-point-of-sale"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Point of Sale definitions']}>
              {withLayout(MainLayout, AddPosForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="miscellaneous/update-point-of-sale/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Point of Sale definitions']}>
              {withLayout(MainLayout, UpdatePosForm)}
            </ProtectedRoute>
          }
        />

        <Route path="maintenance" element={withLayout(MainLayout, SetupMaintenance)}/>
          <Route
            path="maintenance/install-chart-of-accounts"
            element={withLayout(MainLayout, InstallChartOfAccounts)}
          />
          <Route
            path="maintenance/void-a-transaction"
            element={
              <ProtectedRoute required={PERMISSION_ID_MAP['Voiding transactions']}>
                {withLayout(MainLayout, VoidTransactionTable)}
              </ProtectedRoute>
            }
          />
          <Route
            path="maintenance/add-void-a-transaction"
            element={
              <ProtectedRoute required={PERMISSION_ID_MAP['Voiding transactions']}>
                {withLayout(MainLayout, VoidTransaction)}
              </ProtectedRoute>
            }
          />
          <Route
            path="maintenance/view-or-print-transaction"
            element={
              <ProtectedRoute required={PERMISSION_ID_MAP['Common view/print transactions interface']}>
                {withLayout(MainLayout, ViewPrintTransactions)}
              </ProtectedRoute>
            }
          />
          <Route
            path="maintenance/attach-documents"
            element={
              <ProtectedRoute required={PERMISSION_ID_MAP['Attaching documents']}>
                {withLayout(MainLayout, DocumentsTable)}
              </ProtectedRoute>
            }
          />
          <Route
            path="maintenance/add-document"
            element={
              <ProtectedRoute required={PERMISSION_ID_MAP['Attaching documents']}>
                {withLayout(MainLayout, AddDocumentsForm)}
              </ProtectedRoute>
            }
          />
          <Route
            path="maintenance/update-document"
            element={
              <ProtectedRoute required={PERMISSION_ID_MAP['Attaching documents']}>
                {withLayout(MainLayout, UpdateDocumentsForm)}
              </ProtectedRoute>
            }
          />
          <Route
            path="maintenance/backup-and-restore"
            element={
              <ProtectedRoute required={PERMISSION_ID_MAP['Database backup/restore']}>
                {withLayout(MainLayout, BackupRestore)}
              </ProtectedRoute>
            }
          />
          <Route
            path="create-update-companies"
            element={withLayout(MainLayout, CompanyTable)}
          />
          <Route
            path="add-company"
            element={withLayout(MainLayout, AddCompanyForm)}
          />
          <Route
            path="update-company"
            element={withLayout(MainLayout, UpdateCompanyForm)}
          />
          <Route
            path="install-languages"
            element={withLayout(MainLayout, LanguagesTable)}
          />
          <Route
            path="add-language"
            element={withLayout(MainLayout, AddLanguagesForm)}
          />
          <Route
            path="update-language"
            element={withLayout(MainLayout, UpdateLanguagesForm)}
          />
          <Route
            path="install-extensions"
            element={withLayout(MainLayout, InstallExtensions)}
          />
          <Route
            path="install-themes"
            element={withLayout(MainLayout, InstallThemes)}
          />
          <Route
            path="software-upgrade"
            element={withLayout(MainLayout, SoftwareUpdateTable)}
          />
          <Route
            path="maintenance/system-diagnostics"
            element={
              <ProtectedRoute required={PERMISSION_ID_MAP['System diagnostics page']}>
                {withLayout(MainLayout, SystemDiagnostics)}
              </ProtectedRoute>
            }
          />
          <Route
            path="maintenance/user-login-logs"
            element={
              <ProtectedRoute required={PERMISSION_ID_MAP['User login activity page']}>
                {withLayout(MainLayout, UserLoginLogs)}
              </ProtectedRoute>
            }
          />
          <Route
            path="companysetup/user-login-activity"
            element={
              <ProtectedRoute required={PERMISSION_ID_MAP['User login activity page']}>
                {withLayout(MainLayout, UserLoginLogs)}
              </ProtectedRoute>
            }
          />
        </Route>
        

      <Route element={<ProtectedRoute />}>
        <Route
          path="/reports"
          element={withLayout(MainLayout, Reports)}
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/maintenance" element={<ProtectedRoute required={PERMISSION_ID_MAP['Special Maintenance']} />} />
        <Route
          path="/sales/transactions"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Sales", "Transactions")}>
              {withLayout(MainLayout, SalesTransactions)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/sales-quotation-entry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales quotations']}>
              {withLayout(MainLayout, SalesQuotationEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/update-sales-quotation-entry/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales quotations']}>
              {withLayout(MainLayout, UpdateSalesQuotationEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/sales-quotation-entry/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales quotations']}>
              {withLayout(MainLayout, SalesQuotationEntrySuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/updated-sales-quotation-entry/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales quotations']}>
              {withLayout(MainLayout, UpdatedSalesQuotationEntrySuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/sales-quotation-entry/view-sales-quotation"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales quotations']}>
              {withLayout(MainLayout, ViewSalesQuotationEntry)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/sales/transactions/sales-order-entry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales orders edition']}>
              {withLayout(MainLayout, SalesOrderEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/sales-order-entry/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales orders edition']}>
              {withLayout(MainLayout, SalesOrderEntrySuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/sales-order-entry/view-sales-order"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales orders edition']}>
              {withLayout(MainLayout, ViewSalesOrderEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/update-sales-order-entry/"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales orders edition']}>
              {withLayout(MainLayout, UpdateSalesOrderEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/update-sales-order-entry/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales orders edition']}>
              {withLayout(MainLayout, UpdateSalesOrderEntrySuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/quotation-sales-order-entry/"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales orders edition']}>
              {withLayout(MainLayout, SalesOrderEntryQuotation)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/customer-delivery"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales orders edition']}>
              {withLayout(MainLayout, CustomerDelivery)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/customer-delivery/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales orders edition']}>
              {withLayout(MainLayout, CustomerDeliverySuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/customer-delivery/view"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales orders edition']}>
              {withLayout(MainLayout, ViewCustomerDelivery)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/direct-delivery"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct sales delivery entry']}>
              {withLayout(MainLayout, DirectDelivery)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/direct-delivery/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct sales delivery entry']}>
              {withLayout(MainLayout, DirectDeliverySuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/direct-delivery/view-direct-delivery"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct sales delivery entry']}>
              {withLayout(MainLayout, ViewDirectDelivery)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/direct-delivery/customer-invoice"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct sales delivery entry']}>
              {withLayout(MainLayout, DeliveyNoteInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/direct-delivery/delivery-note-invoice"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct sales delivery entry']}>
              {withLayout(MainLayout, DeliveyNoteInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/direct-delivery/customer-invoice/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct sales delivery entry']}>
              {withLayout(MainLayout, CustomerInvoiceSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/direct-invoice"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct sales invoice entry']}>
              {withLayout(MainLayout, DirectInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/direct-invoice/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct sales invoice entry']}>
              {withLayout(MainLayout, DirectInvoiceSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/direct-invoice/view-direct-invoice"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct sales invoice entry']}>
              {withLayout(MainLayout, ViewDirectInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/gl-journal-entries"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct sales invoice entry']}>
              {withLayout(MainLayout, ViewSalesGLJournalEntries)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/credit-invoice/"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct sales invoice entry']}>
              {withLayout(MainLayout, CreditInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/credit-invoice/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct sales invoice entry']}>
              {withLayout(MainLayout, CreditInvoiceSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/credit-invoice/view-credit-invoice"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct sales invoice entry']}>
              {withLayout(MainLayout, ViewCreditInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/template-delivery"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales templates']}>
              {withLayout(MainLayout, TemplateDelivery)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/template-invoice"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales template invoice']}>
              {withLayout(MainLayout, TemplateInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/create-print-recurrent-invoices"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Recurrent invoices definitions']}>
              {withLayout(MainLayout, CreateAndPrintRecurrentInvoices)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/customer-payments"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer payments entry']}>
              {withLayout(MainLayout, CustomerPayments)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/update-customer-payments"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer payments entry']}>
              {withLayout(MainLayout, UpdateCustomerPayments)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/customer-payments/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer payments entry']}>
              {withLayout(MainLayout, CustomerPaymentsSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/customer-payments/view-customer-payment"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer payments entry']}>
              {withLayout(MainLayout, ViewCustomerPayments)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/customer-credit-notes"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales credit notes against invoice']}>
              {withLayout(MainLayout, CustomerCreditNotes)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/customer-credit-notes/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales credit notes against invoice']}>
              {withLayout(MainLayout, CustomerCreditNotesSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/update-customer-credit-notes/"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales credit notes against invoice']}>
              {withLayout(MainLayout, UpdateCustomerCreditNotes)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/customer-credit-notes/view-customer-credit-note"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales credit notes against invoice']}>
              {withLayout(MainLayout, ViewCustomerCreditNotes)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/customer-credit-notes/view-updated-customer-credit-note"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales credit notes against invoice']}>
              {withLayout(MainLayout, ViewUpdatedCustomerCreditNotes)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/customer-credit-notes/success-updated"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales credit notes against invoice']}>
              {withLayout(MainLayout, UpdatedCustomerCreditNotesSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/delivery-against-sales-orders"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales deliveries edition']}>
              {withLayout(MainLayout, DeliveryAgainstSalesOrders)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/invoice-against-sales-delivery"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales invoices edition']}>
              {withLayout(MainLayout, InvoiceAgainstSalesDelivery)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/update-customer-delivery/"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales invoices edition']}>
              {withLayout(MainLayout, UpdateCustomerDeliveryInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/update-delivery/"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales invoices edition']}>
              {withLayout(MainLayout, UpdateCustomerDelivery)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/update-customer-delivery/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales invoices edition']}>
              {withLayout(MainLayout, UpdateCustomerDeliverySuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/invoice-prepaid-orders"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Invoice prepaid orders']}>
              {withLayout(MainLayout, InvoicePrepaidOrders)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/invoice-prepaid-orders/final-invoice-entry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Invoice prepaid orders']}>
              {withLayout(MainLayout, FinalInvoiceEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/invoice-prepaid-orders/final-invoice-entry/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Invoice prepaid orders']}>
              {withLayout(MainLayout, FinalInvoiceSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/invoice-prepaid-orders/view-final-invoice"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Invoice prepaid orders']}>
              {withLayout(MainLayout, ViewFinalInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/allocate-customer-payments-credit-notes"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer payments allocation']}>
              {withLayout(MainLayout, CustomerAllocations)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/transactions/allocate-customer-payments-credit-notes/view-allocations"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer payments allocation']}>
              {withLayout(MainLayout, ViewCustomerAllocations)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/inquiriesandreports"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Sales", "Inquiries and Reports")}>
              {withLayout(MainLayout, InquiriesAndReports)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/inquiriesandreports/sales-quotation-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales Related Reports']}>
              {withLayout(MainLayout, SalesQuotationInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/inquiriesandreports/sales-order-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales order inquiry']}>
              {withLayout(MainLayout, SalesOrderInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/inquiriesandreports/customer-allocation-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer allocation inquiry']}>
              {withLayout(MainLayout, CustomerAllocationInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/inquiriesandreports/customer-transaction-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer transaction inquiry']}>
              {withLayout(MainLayout, CustomerTransactionInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/inquiriesandreports/customer-transaction-inquiry/update-customer-invoice/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer transaction inquiry']}>
              {withLayout(MainLayout, UpdateCustomerInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/inquiriesandreports/customer-transaction-inquiry/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer transaction inquiry']}>
              {withLayout(MainLayout, UpdateCustomerInvoiceSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/inquiriesandreports/customer-and-sales-reports"
          element={<Navigate to="/reports" state={{ selectedClass: "Customer" }} replace />}
        />
        <Route
          path="/sales/maintenance"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Sales", "Maintenance")}>
              {withLayout(MainLayout, Maintenance)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/add-and-manage-customers"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales customer and branches changes']}>
              {withLayout(MainLayout, AddManageCutomers)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/add-and-manage-customers/general-settings"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales customer and branches changes']}>
              {withLayout(MainLayout, GeneralSettingsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/add-and-manage-customers/update-customer/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales customer and branches changes']}>
              {withLayout(MainLayout, UpdateGeneralSettingsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/add-and-manage-customers/contacts"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales customer and branches changes']}>
              {withLayout(MainLayout, CustomersContactsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/add-and-manage-customers/add-customers-contacts"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales customer and branches changes']}>
              {withLayout(MainLayout, AddCustomersContactsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/add-and-manage-customers/update-customers-contacts/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales customer and branches changes']}>
              {withLayout(MainLayout, UpdateCustomersContactsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/add-and-manage-customers/transactions"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales customer and branches changes']}>
              {withLayout(MainLayout, TransactionsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/add-and-manage-customers/sales-orders"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales customer and branches changes']}>
              {withLayout(MainLayout, SalesOrdersTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/add-and-manage-customers/attachments"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales customer and branches changes']}>
              {withLayout(MainLayout, AttachmentsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/add-and-manage-customers/add-attachments"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales customer and branches changes']}>
              {withLayout(MainLayout, AddAttachmentsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/add-and-manage-customers/update-attachments"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales customer and branches changes']}>
              {withLayout(MainLayout, UpdateAttachmentsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/customer-branches"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer branches maintenance']}>
              {withLayout(MainLayout, CustomersBranches)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/customer-branches/general-settings"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer branches maintenance']}>
              {withLayout(MainLayout, CustomerBranchesTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/customer-branches/add-general-settings/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer branches maintenance']}>
              {withLayout(MainLayout, AddCustomerBranchesGeneralSettingForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/customer-branches/update-general-settings/:branchCode"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer branches maintenance']}>
              {withLayout(MainLayout, UpdateCustomerBranchesGeneralSettingForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/customer-branches/edit/:branchCode"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer branches maintenance']}>
              {withLayout(MainLayout, CustomersBranches)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/customer-branches/branches-contacts"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer branches maintenance']}>
              {withLayout(MainLayout, ContactsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/customer-branches/add-customer-branches-contacts/"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer branches maintenance']}>
              {withLayout(MainLayout, AddContactsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/customer-branches/update-customer-branches-contacts/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Customer branches maintenance']}>
              {withLayout(MainLayout, UpdateContactsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/sales-groups"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales groups changes']}>
              {withLayout(MainLayout, SalesGroupsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/sales-groups/add-sales-groups"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales groups changes']}>
              {withLayout(MainLayout, AddSalesGroupsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/sales-groups/update-sales-groups/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales groups changes']}>
              {withLayout(MainLayout, UpdateSalesGroupsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/sales-persons"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales staff maintenance']}>
              {withLayout(MainLayout, SalesPersonTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/sales-persons/add-sales-person"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales staff maintenance']}>
              {withLayout(MainLayout, AddSalesPerson)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/sales-persons/update-sales-person/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales staff maintenance']}>
              {withLayout(MainLayout, UpdateSalesPerson)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/sales-areas"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales areas maintenance']}>
              {withLayout(MainLayout, SalesAreaTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/sales-areas/add-sales-area"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales areas maintenance']}>
              {withLayout(MainLayout, AddSalesAreaForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/sales-areas/update-sales-area/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales areas maintenance']}>
              {withLayout(MainLayout, UpdateSalesAreaForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/sales-types/"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales types']}>
              {withLayout(MainLayout, SalesTypesTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/sales-areas/add-sales-types"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales types']}>
              {withLayout(MainLayout, AddSalesTypesForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/sales-areas/update-sales-types/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales types']}>
              {withLayout(MainLayout, UpdateSalesTypesForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/credit-status-setup"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Credit status definitions changes']}>
              {withLayout(MainLayout, CreditStatusTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/credit-status-setup/add-credit-status"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Credit status definitions changes']}>
              {withLayout(MainLayout, AddCreditStatusForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/credit-status-setup/update-credit-status/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Credit status definitions changes']}>
              {withLayout(MainLayout, UpdateCreditStatusForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/update-recurrent-invoice/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Recurrent invoices maintenance']}>
              {withLayout(MainLayout, UpdateRecurrentInvoices)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/add-recurrent-invoice/"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Recurrent invoices maintenance']}>
              {withLayout(MainLayout, AddRecurrentInvoices)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/recurrent-invoices/"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Recurrent invoices maintenance']}>
              {withLayout(MainLayout, ViewRecurrentInvoices)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/maintenance/create-recurrent-invoices/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Recurrent invoices maintenance']}>
              {withLayout(MainLayout, CreateInvoice)}
            </ProtectedRoute>
          }
        />
        {/* Legacy purchase URLs (purchases vs purchase, supplier-payment-entry alias) */}
        <Route path="/purchases" element={<Navigate to="/purchase/transactions" replace />} />
        <Route path="/purchases/transactions" element={<Navigate to="/purchase/transactions" replace />} />
        <Route
          path="/purchases/transactions/supplier-payment-entry"
          element={<Navigate to="/purchase/transactions/payment-to-suppliers" replace />}
        />
        <Route
          path="/purchase/transactions/supplier-payment-entry"
          element={<Navigate to="/purchase/transactions/payment-to-suppliers" replace />}
        />
        <Route
          path="/purchases/transactions/payment-to-suppliers"
          element={<Navigate to="/purchase/transactions/payment-to-suppliers" replace />}
        />
        <Route
          path="/purchases/transactions/payment-to-suppliers/success"
          element={<Navigate to="/purchase/transactions/payment-to-suppliers/success" replace />}
        />
        <Route
          path="/purchases/transactions/payment-to-suppliers/view-supplier-payment"
          element={<Navigate to="/purchase/transactions/payment-to-suppliers/view-supplier-payment" replace />}
        />
        <Route
          path="/purchase"
          element={<Navigate to="/purchase/transactions" replace />}
        />
        <Route
          path="/purchase/transactions"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Purchase", "Transactions")}>
              {withLayout(MainLayout, PurchaseTransactions)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/purchase-order-entry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase order entry']}>
              {withLayout(MainLayout, PurchaseOrderEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/update-purchase-order-entry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase order entry']}>
              {withLayout(MainLayout, UpdatePurchaseOrderEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/purchase-order-entry/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase order entry']}>
              {withLayout(MainLayout, PurchaseOrderEntrySuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/purchase-order-entry/view-purchase-order"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase order entry']}>
              {withLayout(MainLayout, ViewPurchaseOrderEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/receive-purchase-order-items"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase receive']}>
              {withLayout(MainLayout, ReceivePurchaseOrderItems)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/receive-purchase-order-items/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase receive']}>
              {withLayout(MainLayout, ReceivePurchaseOrderItemsSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/receive-purchase-order-items/view"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase receive']}>
              {withLayout(MainLayout, ViewReceivePurchaseOrderItems)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/outstanding-purchase-orders-maintenance"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Outstanding purchase orders maintenance']}>
              {withLayout(MainLayout, OutstandingPurchaseOrdersMaintenance)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/direct-grn"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct GRN entry']}>
              {withLayout(MainLayout, DirectGRN)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/direct-grn/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct GRN entry']}>
              {withLayout(MainLayout, DirectGRNSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/direct-grn/view-direct-grn"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct GRN entry']}>
              {withLayout(MainLayout, ViewDirectGRN)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/gl-journal-entries"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase Transactions']}>
              {withLayout(MainLayout, ViewPurchasesGLJournalEntries)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/direct-supplier-invoice"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct supplier invoice entry']}>
              {withLayout(MainLayout, DirectSupplierInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/direct-supplier-invoice/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct supplier invoice entry']}>
              {withLayout(MainLayout, DirectSupplierInvoiceSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/direct-supplier-invoice/view-direct-supplier-invoice"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Direct supplier invoice entry']}>
              {withLayout(MainLayout, ViewDirectSupplierInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/payment-to-suppliers"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Supplier payments']}>
              {withLayout(MainLayout, SupplierPaymentEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/payment-to-suppliers/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Supplier payments']}>
              {withLayout(MainLayout, SupplierPaymentEntrySuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/payment-to-suppliers/view-supplier-payment"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Supplier payments']}>
              {withLayout(MainLayout, ViewSupplierPaymentEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/allocate-supplier-payments-credit-notes"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Supplier payments allocations']}>
              {withLayout(MainLayout, SupplierAllocations)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/allocate-supplier-payments-credit-notes/view-supplier-allocations"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Supplier payments allocations']}>
              {withLayout(MainLayout, ViewSupplierAllocations)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/supplier-invoice"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Supplier invoices']}>
              {withLayout(MainLayout, SupplierInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/supplier-invoice/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Supplier invoices']}>
              {withLayout(MainLayout, SupplierInvoiceSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/supplier-invoice/view-supplier-invoice"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Supplier invoices']}>
              {withLayout(MainLayout, ViewSupplierInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/supplier-credit-notes"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Supplier credit notes']}>
              {withLayout(MainLayout, SupplierCreditNote)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/supplier-credit-notes/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Supplier credit notes']}>
              {withLayout(MainLayout, SupplierCreditNoteSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/transactions/supplier-credit-notes/view-supplier-credit-note"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Supplier credit notes']}>
              {withLayout(MainLayout, ViewSupplierCreditNote)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/inquiriesandreports"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Purchase", "Inquiries and Reports")}>
              {withLayout(MainLayout, PurchaseInquiriesAndReports)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/inquiriesandreports/purchase-orders-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase Analytics']}>
              {withLayout(MainLayout, PurchaseOrdersInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/inquiriesandreports/supplier-transaction-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Supplier analytical reports']}>
              {withLayout(MainLayout, SupplierTransactionInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/inquiriesandreports/supplier-allocation-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Supplier allocation inquiry']}>
              {withLayout(MainLayout, SupplierAllocationInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/maintenance"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Purchase", "Maintenance")}>
              {withLayout(MainLayout, PurchaseMaintenance)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/maintenance/suppliers"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Suppliers changes']}>
              {withLayout(MainLayout, Suppliers)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/maintenance/suppliers/general-settings"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Suppliers changes']}>
              {withLayout(MainLayout, SupplierGeneralSettingsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/maintenance/suppliers/update/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Suppliers changes']}>
              {withLayout(MainLayout, UpdateSupplierGeneralSettingsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/maintenance/suppliers/contacts"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Suppliers changes']}>
              {withLayout(MainLayout, SuppliersContactsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/maintenance/suppliers/add-supplier-contact/"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Suppliers changes']}>
              {withLayout(MainLayout, AddSuppliersContactsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/maintenance/suppliers/update-supplier-contact/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Suppliers changes']}>
              {withLayout(MainLayout, UpdateSuppliersContactsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/maintenance/suppliers/attachments"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Suppliers changes']}>
              {withLayout(MainLayout, SuppliersAttachmentsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/maintenance/suppliers/add-attachments"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Suppliers changes']}>
              {withLayout(MainLayout, AddSuppliersAttachmentsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/maintenance/suppliers/update-attachments"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Suppliers changes']}>
              {withLayout(MainLayout, UpdateSuppliersAttachmentsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/maintenance/suppliers/transactions"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Suppliers changes']}>
              {withLayout(MainLayout, SuppliersTransactionsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase/maintenance/suppliers/purchases-orders"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Suppliers changes']}>
              {withLayout(MainLayout, SupplierPurchaseOrdersTable)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/itemsandinventory/transactions"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Item and inventory", "Transactions")}>
              {withLayout(MainLayout, ItemsTransactions)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/transactions/inventory-adjustments"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Inventory adjustments']}>
              {withLayout(MainLayout, AddInventoryAdjustments)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/transactions/inventory-adjustments/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Inventory adjustments']}>
              {withLayout(MainLayout, AddInventoryAdjustmentsSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/transactions/inventory-adjustments/view"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Inventory adjustments']}>
              {withLayout(MainLayout, ViewInventoryAdjustment)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/transactions/inventory-location-transfer"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Inventory location transfers']}>
              {withLayout(MainLayout, AddInventoryLocationTransfers)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/transactions/inventory-location-transfer/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Inventory location transfers']}>
              {withLayout(MainLayout, AddInventoryLocationTransfersSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/transactions/inventory-location-transfer/view"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Inventory location transfers']}>
              {withLayout(MainLayout, ViewInventoryLocationTransfer)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/transactions/gl-journal-entries"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Inventory Operations']}>
              {withLayout(MainLayout, ViewInventoryGLJournalEntries)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/itemsandinventory/inquiriesandreports"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Item and inventory", "Inquiries and Reports")}>
              {withLayout(MainLayout, ItemsInquiriesAndReports)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/inquiriesandreports/inventory-item-status"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Inventory item status inquiry']}>
              {withLayout(MainLayout, InventoryItemStatus)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/inquiriesandreports/inventory-item-movements"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Items analytical reports and inquiries']}>
              {withLayout(MainLayout, InventoryItemMovements)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Item and inventory", "Maintenance")}>
              {withLayout(MainLayout, ItemsMaintenance)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/units-of-measure"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Units of measure']}>
              {withLayout(MainLayout, UnitsOfMeasureTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/units-of-measure/add-units-of-measure"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Units of measure']}>
              {withLayout(MainLayout, AddUnitsOfMeasureForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/units-of-measure/update-units-of-measure/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Units of measure']}>
              {withLayout(MainLayout, UpdateUnitsOfMeasureForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/items"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Stock items add/edit']}>
              {withLayout(MainLayout, Items)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/items/general-settings"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Stock items add/edit']}>
              {withLayout(MainLayout, ItemsGeneralSettingsForm)}
            </ProtectedRoute>
          }
        />
        {/* <Route
          path="/itemsandinventory/maintenance/items/sales-pricing"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales prices edition']}>
              {withLayout(MainLayout, SalesPricingTable)}
            </ProtectedRoute>
          }
        /> */}
        <Route
          path="/itemsandinventory/maintenance/items/add-sales-pricing/:itemId"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales prices edition']}>
              {withLayout(MainLayout, AddSalesPricingForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/items/update-sales-pricing/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales prices edition']}>
              {withLayout(MainLayout, UpdateSalesPricingForm)}
            </ProtectedRoute>
          }
        />
        {/* <Route
          path="/itemsandinventory/maintenance/items/purchasing-pricing"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase price changes']}>
              {withLayout(MainLayout, PurchasingPricingTable)}
            </ProtectedRoute>
          }
        /> */}
        <Route
          path="/itemsandinventory/maintenance/items/add-purchasing-pricing/:itemId"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase price changes']}>
              {withLayout(MainLayout, AddPurchasingPricingForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/items/update-purchasing-pricing/:supplierId/:stockId"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase price changes']}>
              {withLayout(MainLayout, UpdatePurchasePricingForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/items/standard-costs"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Item standard costs']}>
              {withLayout(MainLayout, AddStandardCostForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/items/reorder-levels"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Reorder levels']}>
              {withLayout(MainLayout, ReOrderLevelsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/items/transactions"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Stock transactions view']}>
              {withLayout(MainLayout, ItemTransactionsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/items/transactions/view-transfer"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Stock transactions view']}>
              {withLayout(MainLayout, ItemTransactionsDetails)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/items/transactions/view-adjustment"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Inventory Operations']}>
              {withLayout(MainLayout, ItemAdjustmentDetails)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/items/status"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Stock status view']}>
              {withLayout(MainLayout, StatusTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/items/attachments"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Stock items add/edit']}>
              {withLayout(MainLayout, ItemAttachmentsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/items/add-attachments"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Stock items add/edit']}>
              {withLayout(MainLayout, AddItemAttachmentsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/items/update-attachments"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Stock items add/edit']}>
              {withLayout(MainLayout, UpdateItemAttachmentsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/update-units-of-measure"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Units of measure']}>
              {withLayout(MainLayout, UpdateUnitsOfMeasureForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/foreign-item-codes"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Foreign item codes entry']}>
              {withLayout(MainLayout, ForeignItemCodesTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/add-foreign-item-codes"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Foreign item codes entry']}>
              {withLayout(MainLayout, AddForeignItemCodesForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/update-foreign-item-codes"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Foreign item codes entry']}>
              {withLayout(MainLayout, UpdateForeignItemCodesForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/sales-kits"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales kits']}>
              {withLayout(MainLayout, AddSalesKitsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/add-saleskit-component"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales kits']}>
              {withLayout(MainLayout, AddSalesKitComponentPage)}
            </ProtectedRoute>
          }
        />


        <Route
          path="/itemsandinventory/maintenance/inventory-locations"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Inventory locations changes']}>
              {withLayout(MainLayout, InventoryLocationTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/add-inventory-location"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Inventory locations changes']}>
              {withLayout(MainLayout, AddInventoryLocationForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/update-inventory-location/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Inventory locations changes']}>
              {withLayout(MainLayout, UpdateInventoryLocationForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/item-categories"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Item categories']}>
              {withLayout(MainLayout, ItemCategoriesTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/add-item-categories"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Item categories']}>
              {withLayout(MainLayout, AddItemCategoriesForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/update-item-categories/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Item categories']}>
              {withLayout(MainLayout, UpdateItemCategoriesForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/maintenance/reorder-levels"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Reorder levels']}>
              {withLayout(MainLayout, ReOrderLevelsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/pricingandcosts/sales-pricing"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales prices edition']}>
              {withLayout(MainLayout, ViewSalesPricing)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/pricingandcosts/add-sales-pricing/:itemId"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales prices edition']}>
              {withLayout(MainLayout, AddSalesPricingForm2)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/pricingandcosts/update-sales-pricing/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Sales prices edition']}>
              {withLayout(MainLayout, UpdateSalesPricingForm2)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/pricingandcosts/purchasing-pricing"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase price changes']}>
              {withLayout(MainLayout, ViewPurchasingPricing)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/pricingandcosts/add-purchasing-pricing/:itemId"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase price changes']}>
              {withLayout(MainLayout, AddPurchasingPricingForm2)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/pricingandcosts/update-purchasing-pricing/:supplierId/:stockId"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Purchase price changes']}>
              {withLayout(MainLayout, UpdatePurchasingPricingForm2)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/itemsandinventory/pricingandcosts/standard-costs"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Item standard costs']}>
              {withLayout(MainLayout, ViewAddStandardCostForm)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/itemsandinventory/pricingandcosts"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Item and inventory", "Pricing and Costs")}>
              {withLayout(MainLayout, ItemsPricingAndCosts)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/manufacturing/transactions"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Manufacturing", "Transactions")}>
              {withLayout(MainLayout, ManufacturingTransactions)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/transactions/work-order-entry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Work order entry']}>
              {withLayout(MainLayout, WorkOrderEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/transactions/work-order-entry/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Work order entry']}>
              {withLayout(MainLayout, WorkOrderEntrySuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/transactions/work-order-entry/view"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Work order entry']}>
              {withLayout(MainLayout, ViewWorkOrderEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/transactions/work-order-entry/view-gl-journal-entries"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Work order entry']}>
              {withLayout(MainLayout, ViewGLJournalEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/transactions/work-order-entry/update"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Work order entry']}>
              {withLayout(MainLayout, UpdateWorkOrderEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/transactions/outstanding-work-orders"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Work order releases']}>
              {withLayout(MainLayout, OutstandingWorkOrders)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/transactions/outstanding-work-orders/release"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Work order releases']}>
              {withLayout(MainLayout, ReleaseWorkOrder)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/transactions/outstanding-work-orders/issue"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Work order releases']}>
              {withLayout(MainLayout, IssueWorkOrder)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/transactions/outstanding-work-orders/costs"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Work order releases']}>
              {withLayout(MainLayout, CostWorkOrder)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/transactions/outstanding-work-orders/produce"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Work order releases']}>
              {withLayout(MainLayout, ProduceWorkOrder)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/manufacturing/inquiriesandreports"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Manufacturing", "Inquiries and Reports")}>
              {withLayout(MainLayout, ManufacturingInquiriesAndReports)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/inquiriesandreports/costed-bill-of-material-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Manufacturing cost inquiry']}>
              {withLayout(MainLayout, CostedBillOfMaterialInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/inquiriesandreports/inventory-item-where-used-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Inventory item where used inquiry']}>
              {withLayout(MainLayout, InventoryItemWhereUsedInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/inquiriesandreports/work-order-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Work order analytical reports and inquiries']}>
              {withLayout(MainLayout, WorkOrderInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/inquiriesandreports/manufacturing-reports"
          element={<Navigate to="/reports" state={{ selectedClass: "Manufacturing" }} replace />}
        />

        <Route
          path="/manufacturing/maintenance"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Manufacturing", "Maintenance")}>
              {withLayout(MainLayout, ManufacturingMaintenance)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/maintenance/work-centres"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Manufacture work centres']}>
              {withLayout(MainLayout, WorkCentresTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/maintenance/add-work-centres"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Manufacture work centres']}>
              {withLayout(MainLayout, AddWorkCentresForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/maintenance/update-work-centres/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Manufacture work centres']}>
              {withLayout(MainLayout, UpdateWorkCentresForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/maintenance/bills-of-material"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bill of Materials']}>
              {withLayout(MainLayout, BillsOfMaterialTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/maintenance/add-bills-of-material"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bill of Materials']}>
              {withLayout(MainLayout, AddBillsOfMaterialForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/manufacturing/maintenance/update-bills-of-material/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bill of Materials']}>
              {withLayout(MainLayout, UpdateBillsOfMaterialForm)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/fixedassets/transactions"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Fixed Assets", "Transactions")}>
              {withLayout(MainLayout, FixedAssestsTransactions)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/transactions/fixed-assets-purchase"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Assets Operations']}>
              {withLayout(MainLayout, FixedAssetsPurchase)}
            </ProtectedRoute>
          }
        />
         <Route
          path="/fixedassets/transactions/fixed-assets-purchase/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Assets Operations']}>
              {withLayout(MainLayout, FixedAssetsPurchaseSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/transactions/fixed-assets-purchase/view-fixed-assets-purchase"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Assets Operations']}>
              {withLayout(MainLayout, ViewFixedAssetsPurchase)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/transactions/fixed-assets-location-transfer"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset location transfers']}>
              {withLayout(MainLayout, FixedAssetsLocationTransfers)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/transactions/fixed-assets-location-transfer/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset location transfers']}>
              {withLayout(MainLayout, FixedAssetsLocationTransfersSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/transactions/fixed-assets-location-transfer/view"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset location transfers']}>
              {withLayout(MainLayout, ViewFixedAssetsLocationTransfers)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/transactions/fixed-assets-disposal"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset disposals']}>
              {withLayout(MainLayout, FixedAssetsDisposal)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/transactions/fixed-assets-disposal/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset disposals']}>
              {withLayout(MainLayout, FixedAssetsDisposalSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/transactions/fixed-assets-disposal/view-fixed-assets-disposal"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset disposals']}>
              {withLayout(MainLayout, ViewFixedAssetsDisposal)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/transactions/fixed-assets-sale"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed assets sale']}>
              {withLayout(MainLayout, FixedAssetsSale)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/transactions/fixed-assets-sale/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed assets sale']}>
              {withLayout(MainLayout, FixedAssetsSaleSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/transactions/fixed-assets-sale/view-fixed-assets-sale"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed assets sale']}>
              {withLayout(MainLayout, ViewFixedAssetsSale)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/transactions/process-depreciation"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Depreciation']}>
              {withLayout(MainLayout, ProcessDepreciation)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/transactions/process-depreciation/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Depreciation']}>
              {withLayout(MainLayout, ProcessDepreciationSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/transactions/gl-journal-entries"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Assets Operations']}>
              {withLayout(MainLayout, ViewFixedAssetsGLJournalEntries)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/inquiriesandreports"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Fixed Assets", "Inquiries and Reports")}>
              {withLayout(MainLayout, FixedAssestsInquiriesAndReports)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/inquiriesandreports/fixed-assets-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset analytical reports and inquiries']}>
              {withLayout(MainLayout, FixedAssetsInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/inquiriesandreports/fixed-asset-movements"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Assets Analytics']}>
              {withLayout(MainLayout, FixedAssetsMovements)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/maintenance"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Fixed Assets", "Maintenance")}>
              {withLayout(MainLayout, FixedAssestsMaintenance)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/maintenance/fixed-assets"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset items add/edit']}>
              {withLayout(MainLayout, FixedAssets)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/maintenance/update-fixed-assets"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset items add/edit']}>
              {withLayout(MainLayout, UpdateFixedAssetsGeneralSettingsForm)}
            </ProtectedRoute>
          }
        />
       <Route
          path="/fixedassets/maintenance/transaction"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset items add/edit']}>
              {withLayout(MainLayout,  FixedAssetsTransactionsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/maintenance/fixed-asset-locations"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed assets locations maintenance']}>
              {withLayout(MainLayout, FixedAssetsLocationsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/maintenance/add-fixed-asset-location"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed assets locations maintenance']}>
              {withLayout(MainLayout, AddFixedAssetsLocations)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/maintenance/update-fixed-asset-location/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed assets locations maintenance']}>
              {withLayout(MainLayout, UpdateFixedAssetsLocations)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/maintenance/fixed-asset-categories"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset categories']}>
              {withLayout(MainLayout, FixedAssetsCategoriesTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/maintenance/add-fixed-asset-categories"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset categories']}>
              {withLayout(MainLayout, AddFixedAssetsCategories)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/maintenance/update-fixed-asset-categories/:category_id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset categories']}>
              {withLayout(MainLayout, UpdateFixedAssetsCategories)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/maintenance/fixed-asset-classes"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset classes']}>
              {withLayout(MainLayout, FixedAssetClassesTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/maintenance/add-fixed-asset-classes"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset classes']}>
              {withLayout(MainLayout, AddFixedAssetClasses)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/fixedassets/maintenance/update-fixed-asset-classes/:fa_class_id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Fixed Asset classes']}>
              {withLayout(MainLayout, UpdateFixedAssetClasses)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/costCenter/transactions"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("CostCenter", "Transactions")}>
              {withLayout(MainLayout, CostCenterTransactions)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/costCenter/transactions/costCenter-entry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['CostCenter entry']}>
              {withLayout(MainLayout, CostCenterEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/costCenter/transactions/edit-costCenter-entry/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['CostCenter entry']}>
              {withLayout(MainLayout, EditCostCenterEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/costCenter/transactions/costCenter-entry/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['CostCenter entry']}>
              {withLayout(MainLayout, CostCenterEntrySuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/costCenter/transactions/outstanding-costCenters"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['CostCenter view']}>
              {withLayout(MainLayout, OutstandingCostCenters)}
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/costCenter/inquiriesandreports"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("CostCenter", "Inquiries and Reports")}>
              {withLayout(MainLayout, CostCenterInquiriesAndReports)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/costCenter/inquiriesandreports/costCenter-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['CostCenter view']}>
              {withLayout(MainLayout, CostCenterInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/costCenter/inquiriesandreports/view-costCenter/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['CostCenter view']}>
              {withLayout(MainLayout, ViewCostCenter)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/costCenter/maintenance"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("CostCenter", "Maintenance")}>
              {withLayout(MainLayout, CostCenterMaintenance)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/costCenter/maintenance/costCenter-tags"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['CostCenter tags']}>
              {withLayout(MainLayout, CostCenterTagsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/costCenter/maintenance/add-costCenter-tags"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['CostCenter tags']}>
              {withLayout(MainLayout, AddCostCenterTagsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/costCenter/maintenance/update-costCenter-tags/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['CostCenter tags']}>
              {withLayout(MainLayout, UpdateCostCenterTagsForm)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/bankingandgeneralledger/transactions"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Banking And General ledger", "Transactions")}>
              {withLayout(MainLayout, BankingTransactions)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/payments"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank payments']}>
              {withLayout(MainLayout, Payments)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/payments/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank payments']}>
              {withLayout(MainLayout, PaymentsSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/bankingandgeneralledger-quotation-entry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank payments']}>
              {withLayout(MainLayout, Payments)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/bankingandgeneralledger-quotation-entry/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank payments']}>
              {withLayout(MainLayout, PaymentsSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/gl-postings"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Banking & GL Transactions']}>
              {withLayout(MainLayout, GLPostings)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/deposits"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank deposits']}>
              {withLayout(MainLayout, Deposits)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/deposits/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank deposits']}>
              {withLayout(MainLayout, DepositSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/bankingandgeneralledger-order-entry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank deposits']}>
              {withLayout(MainLayout, Deposits)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/bankingandgeneralledger-order-entry/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank deposits']}>
              {withLayout(MainLayout, DepositSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/revenue-cost-accruals"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Revenue / Cost Accruals']}>
              {withLayout(MainLayout, RevenueCostAccruals)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/bank-account-transfers"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank account transfers']}>
              {withLayout(MainLayout, BankAccountTransfers)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/bank-account-transfers/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank account transfers']}>
              {withLayout(MainLayout, BankAccountTransferSuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/journal-entry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Journal entries to bank related accounts']}>
              {withLayout(MainLayout, JournalEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/journal-entry/success"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Journal entries to bank related accounts']}>
              {withLayout(MainLayout, JournalEntrySuccess)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/journal-entry/view"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Journal entries to bank related accounts']}>
              {withLayout(MainLayout, ViewJournalEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/budget-entry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Budget edition']}>
              {withLayout(MainLayout, BudgetEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/transactions/reconcile-bank-account"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank reconciliation']}>
              {withLayout(MainLayout, ReconcileBankAccount)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/bankingandgeneralledger/inquiriesandreports"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Banking And General ledger", "Inquiries and Reports")}>
              {withLayout(MainLayout, BankingInquiriesAndReports)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/inquiriesandreports/journal-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL analytical reports and inquiries']}>
              {withLayout(MainLayout, JournalInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/inquiriesandreports/journal-inquiry/modify-sales-invoice"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL analytical reports and inquiries']}>
              {withLayout(MainLayout, ModifySalesInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/inquiriesandreports/journal-inquiry/Customer-payment-entry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL analytical reports and inquiries']}>
              {withLayout(MainLayout, CustomerPaymentEntry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/inquiriesandreports/journal-inquiry/modify-purchase-invoice"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL analytical reports and inquiries']}>
              {withLayout(MainLayout, ModifyPurchaseInvoice)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/inquiriesandreports/gl-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL inquiry']}>
              {withLayout(MainLayout, GLInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/inquiriesandreports/bank-account-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank reports and inquiries']}>
              {withLayout(MainLayout, BankAccountInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/inquiriesandreports/tax-inquiry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Tax reports and inquiries']}>
              {withLayout(MainLayout, TaxInquiry)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/inquiriesandreports/trial-balance"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Trial balance inquiry']}>
              {withLayout(MainLayout, TrialBalance)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/inquiriesandreports/balance-sheet-drilldown"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Balance sheet drilldown']}>
              {withLayout(MainLayout, BalanceSheetDrilldown)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/inquiriesandreports/profit-and-loss-drilldown"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Profit and loss drilldown']}>
              {withLayout(MainLayout, ProfitAndLossDrilldown)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/bankingandgeneralledger/maintenance"
          element={
            <ProtectedRoute required={getSubmenuPermissionIds("Banking And General ledger", "Maintenance")}>
              {withLayout(MainLayout, BankingMaintenance)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/bank-accounts"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank accounts']}>
              {withLayout(MainLayout, BankAccountsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/add-bank-accounts"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank accounts']}>
              {withLayout(MainLayout, AddBankAccountsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/update-bank-accounts/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Bank accounts']}>
              {withLayout(MainLayout, UpdateBankAccountsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/account-tags"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL Account tags']}>
              {withLayout(MainLayout, AccountTagsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/add-account-tags"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL Account tags']}>
              {withLayout(MainLayout, AddAccountTagsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/exchange-rates"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Exchange rate table changes']}>
              {withLayout(MainLayout, ExchangeRateTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/add-exchange-rate"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Exchange rate table changes']}>
              {withLayout(MainLayout, AddExchangeRateForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/update-exchange-rate/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Exchange rate table changes']}>
              {withLayout(MainLayout, UpdateExchangeRateForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/gl-accounts"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL accounts edition']}>
              {withLayout(MainLayout, AddGlAccount)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/update-gl-account/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL accounts edition']}>
              {withLayout(MainLayout, UpdateGlAccount)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/update-account-tags/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL Account tags']}>
              {withLayout(MainLayout, UpdateAccountTagsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/currencies"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Currencies']}>
              {withLayout(MainLayout, CurrenciesTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/add-currency"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Currencies']}>
              {withLayout(MainLayout, AddCurrencies)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/update-currency/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Currencies']}>
              {withLayout(MainLayout, UpdateCurrencies)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/quick-entries"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Quick GL entry definitions']}>
              {withLayout(MainLayout, QuickEntriesTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/add-quick-entry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Quick GL entry definitions']}>
              {withLayout(MainLayout, AddQuickEntriesForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/update-quick-entry"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Quick GL entry definitions']}>
              {withLayout(MainLayout, UpdateQuickEntriesForm)}
            </ProtectedRoute>
          }
        />

        <Route
          path="/bankingandgeneralledger/maintenance/gl-account-groups"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL account groups']}>
              {withLayout(MainLayout, GlAccountGroupsTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/add-gl-account-groups"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL account groups']}>
              {withLayout(MainLayout, AddGlAccountGroupsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/update-gl-account-groups/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL account groups']}>
              {withLayout(MainLayout, UpdateGlAccountGroupsForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/gl-types"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Company GL setup']}>
              {withLayout(MainLayout, GlTypesTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/add-gl-type"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Company GL setup']}>
              {withLayout(MainLayout, AddGlTypeForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/update-gl-type/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Company GL setup']}>
              {withLayout(MainLayout, UpdateGlTypeForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/gl-account-classes"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL account classes']}>
              {withLayout(MainLayout, GlAccountClassesTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/add-gl-account-classes"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL account classes']}>
              {withLayout(MainLayout, AddGlAccountClassesForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/update-gl-account-classes/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['GL account classes']}>
              {withLayout(MainLayout, UpdateGlAccountClassesForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/class-types"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Class Types (GL)']}>
              {withLayout(MainLayout, ClassTypesTable)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/add-class-type"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Class Types (GL)']}>
              {withLayout(MainLayout, AddClassTypeForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/update-class-type/:id"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Class Types (GL)']}>
              {withLayout(MainLayout, UpdateClassTypeForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/revaluation-of-currency-accounts"
          element={
            <ProtectedRoute required={PERMISSION_ID_MAP['Revaluation of currency accounts']}>
              {withLayout(MainLayout, RevaluateCurrenciesForm)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/bankingandgeneralledger/maintenance/closing-gl-transactions"
          element={withLayout(MainLayout, ClosingGlTransactions)}
        />

        <Route
          path="/dashboard"
          element={withLayout(MainLayout, Dashboard)}
        />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
