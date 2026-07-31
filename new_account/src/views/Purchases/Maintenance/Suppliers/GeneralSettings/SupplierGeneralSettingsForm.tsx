import { FormPageLayout } from "../../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Divider,
  Checkbox,
  FormControlLabel,
  Grid,
  ListSubheader,
  FormHelperText,
} from "@mui/material";
import theme from "../../../../../theme";
import { createSupplier, getSuppliers } from "../../../../../api/Supplier/SupplierApi";
import { useNavigate } from "react-router";
import { getCurrencies, Currency } from "../../../../../api/Currency/currencyApi";
import { getTaxGroups, TaxGroup } from "../../../../../api/Tax/taxServices";
import { getChartMasters } from "../../../../../api/GLAccounts/ChartMasterApi";
import { createSupplierContact } from "../../../../../api/Supplier/SupplierContactApi";
import ErrorModal from "../../../../../components/ErrorModal";
import AddedConfirmationModal from "../../../../../components/AddedConfirmationModal";
import { getPaymentTerms } from "../../../../../api/PaymentTerm/PaymentTermApi";
import { createCrmContact } from "../../../../../api/CrmContact/CrmContact";
import { getContactCategories } from "../../../../../api/ContactCategory/ContactCategoryApi";
import CostCenterSelect from "../../../../../components/CostCenterSelect";
import { getFriendlyApiErrorMessage } from "../../../../../utils/apiErrorMessage";
import FormattedNumberField from "../../../../../components/FormattedNumberField";
import { useAuth } from "../../../../../context/AuthContext";

interface SupplierGeneralSettingProps {
  supplierId?: string | number;
  onSupplierAdded?: (supplier: {supplier_id: number | string, supp_name: string}) => void;
}

export default function SupplierGeneralSettingsForm({ supplierId, onSupplierAdded }: SupplierGeneralSettingProps) {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Suppliers changes');
  const [formData, setFormData] = useState({
    supplierName: "",
    supplierShortName: "",
    gstNumber: "",
    website: "",
    supplierCurrency: "",
    taxGroup: "",
    ourCustomerNo: "",
    bankAccount: "",
    creditLimit: "",
    paymentTerms: "",
    pricesIncludeTax: false,
    accountsPayable: "",
    purchaseAccount: "",
    purchaseDiscountAccount: "",
    contactPerson: "",
    phone: "",
    secondaryPhone: "",
    fax: "",
    email: "",
    costCenter: "",
    documentLanguage: "",
    mailingAddress: "",
    physicalAddress: "",
    generalNotes: "",
  });

  const accountTypeMap: { [key: number]: string } = {
    "1": "Current Assets",
    "2": "Inventory Assets",
    "3": "Capital Assets",
    "4": "Current Liabilities",
    "5": "Long Term Liabilities",
    "6": "Share Capital",
    "7": "Retained Earnings",
    "8": "Sales Revenue",
    "9": "Other Revenue",
    "10": "Cost of Good Sold",
    "11": "Payroll Expenses",
    "12": "General and Adminitrative Expenses",
  };

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const navigate = useNavigate();
  const [chartMasters, setChartMasters] = useState<any[]>([]);
  useEffect(() => {
    const fetchChartMasters = async () => {
      try {
        const res = await getChartMasters();
        setChartMasters(res || []);
      } catch (err) {
        console.error("Failed to fetch chart masters", err);
      }
    };
    fetchChartMasters();
  }, []);
  const [customers, setCustomers] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  useEffect(() => {
    getCurrencies().then(setCurrencies);
  }, []);

  const [paymentTerms, setPaymentTerms] = useState<{ terms_indicator: number, description: string }[]>([]);
  useEffect(() => {
    async function fetchPaymentTerms() {
      const res = await getPaymentTerms(); // your API call
      setPaymentTerms(res);
    }
    fetchPaymentTerms();
  }, []);

  const [TaxGroups, setTaxGroups] = useState<TaxGroup[]>([]);
  useEffect(() => {
    getTaxGroups().then(setTaxGroups);
  }, [])
  // Fetch customers on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await getSuppliers(); // API should return a list of suppliers
        setCustomers(res || []);
      } catch (err) {
        console.error("Failed to fetch customers", err);
      }
    };
    fetchCustomers();
  }, []);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: "" });
  };

  const validate = () => {
    let tempErrors: { [key: string]: string } = {};

    if (!formData.supplierName.trim()) tempErrors.supplierName = "Supplier Name is required";
    if (!formData.supplierShortName.trim()) tempErrors.supplierShortName = "Supplier Short Name is required";
    if (formData.website.trim() && !/^https?:\/\/[^\s]+$/.test(formData.website))
      tempErrors.website = "Enter a valid website URL";
    if (!formData.supplierCurrency) tempErrors.supplierCurrency = "Supplier Currency is required";

    if (formData.creditLimit.trim() && isNaN(Number(formData.creditLimit)))
      tempErrors.creditLimit = "Credit Limit must be a number";

    if (formData.phone.trim() && !/^\d{10,15}$/.test(formData.phone))
      tempErrors.phone = "Enter a valid phone number";
    if (formData.secondaryPhone.trim() && !/^\d{10,15}$/.test(formData.secondaryPhone))
      tempErrors.secondaryPhone = "Enter a valid phone number";
    if (formData.fax.trim() && !/^\d+$/.test(formData.fax)) tempErrors.fax = "Enter a valid fax number";
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      tempErrors.email = "Enter a valid email";

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      setErrorMessage(
        "Please fix validation errors before submitting"
      );
      setErrorOpen(true);
      // alert("Please fix validation errors before submitting");
      return;
    }

    try {
      const supplierPayload = {
        supp_name: formData.supplierName,
        supp_short_name: formData.supplierShortName,
        gst_no: formData.gstNumber || "",
        website: formData.website || "",
        curr_code: formData.supplierCurrency,
        tax_group: formData.taxGroup || null,
        supp_account_no: formData.ourCustomerNo || "",
        bank_account: formData.bankAccount || "",
        credit_limit: formData.creditLimit ? Number(formData.creditLimit) : 0,
        payment_terms: formData.paymentTerms || null,
        tax_included: formData.pricesIncludeTax,
        payable_account: formData.accountsPayable || null,
        purchase_account: formData.purchaseAccount || null,
        payment_discount_account: formData.purchaseDiscountAccount || null,
        contact: formData.contactPerson || formData.supplierName,
        cost_center_id: Number(formData.costCenter) || 0,
        cost_center2_id: 0,
        mail_address: formData.mailingAddress || "",
        bill_address: formData.physicalAddress || formData.mailingAddress || "",
        notes: formData.generalNotes || "",
      };

      const supplier = await createSupplier(supplierPayload);

      try {
        const contactPayload = {
          ref: supplier.supp_short_name,
          name: formData.contactPerson || formData.supplierName,
          address: formData.mailingAddress || formData.physicalAddress || "",
          phone: formData.phone || null,
          phone2: formData.secondaryPhone || null,
          fax: formData.fax || null,
          email: formData.email || null,
          notes: formData.generalNotes || null,
          lang: formData.documentLanguage || "en",
          inactive: false,
        };

        const contact = await createSupplierContact(contactPayload);

        await createCrmContact({
          person_id: contact.id,
          entity_id: String(supplier.supplier_id),
          type: 9,
          action: "general",
        });
      } catch (contactError) {
        console.error("Supplier created but contact setup failed:", contactError);
      }

      if (onSupplierAdded) {
        onSupplierAdded({ supplier_id: supplier.supplier_id, supp_name: supplier.supp_name });
      }
      setFormData({
        supplierName: "",
        supplierShortName: "",
        gstNumber: "",
        website: "",
        supplierCurrency: "",
        taxGroup: "",
        ourCustomerNo: "",
        bankAccount: "",
        creditLimit: "",
        paymentTerms: "",
        pricesIncludeTax: false,
        accountsPayable: "",
        purchaseAccount: "",
        purchaseDiscountAccount: "",
        contactPerson: "",
        phone: "",
        secondaryPhone: "",
        fax: "",
        email: "",
        documentLanguage: "",
        costCenter: "",
        mailingAddress: "",
        physicalAddress: "",
        generalNotes: "",
      });
      setErrors({});
      setOpen(true);

    } catch (error: unknown) {
      console.error("Error creating supplier:", error);
      setErrorMessage(
        getFriendlyApiErrorMessage(error) || "Failed to add supplier. Please try again."
      );
      setErrorOpen(true);
    }
  };

  return (
    <FormPageLayout>
      <Box
        sx={{
          width: "100%",
          maxWidth: "1200px",
          p: theme.spacing(3),
          boxShadow: theme.shadows[2],
          borderRadius: theme.shape.borderRadius,
          backgroundColor: theme.palette.background.paper,
        }}
      >

        <Typography variant="h5" sx={{ mb: theme.spacing(3), textAlign: "center" }}>
          Supplier Setup
        </Typography>

        <Grid container spacing={4}>
          {/* Basic Data */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Basic Data</Typography>
              <Divider />
              <TextField
                label="Supplier Name"
                value={formData.supplierName}
                onChange={(e) => handleChange("supplierName", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.supplierName}
                helperText={errors.supplierName}
              />
              <TextField
                label="Supplier Short Name"
                value={formData.supplierShortName}
                onChange={(e) => handleChange("supplierShortName", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.supplierShortName}
                helperText={errors.supplierShortName}
              />
              <TextField
                label="GST Number"
                value={formData.gstNumber}
                onChange={(e) => handleChange("gstNumber", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.gstNumber}
                helperText={errors.gstNumber}
              />
              <TextField
                label="Website"
                value={formData.website}
                onChange={(e) => handleChange("website", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.website}
                helperText={errors.website}
              />
              <FormControl size="small" fullWidth error={!!errors.supplierCurrency}>
                <InputLabel>Supplier Currency</InputLabel>
                <Select
                  value={formData.supplierCurrency}
                  onChange={(e) => handleChange("supplierCurrency", e.target.value)}
                >
                  {currencies.map((currency) => (
                    <MenuItem
                      key={currency.id}
                      value={currency.currency_abbreviation}
                    >
                      {currency.currency_name}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="error">{errors.supplierCurrency}</Typography>
              </FormControl>
              <FormControl size="small" fullWidth error={!!errors.taxGroup}>
                <InputLabel>Tax Group</InputLabel>
                <Select
                  value={formData.taxGroup}
                  onChange={(e) => handleChange("taxGroup", e.target.value)}
                >
                  {TaxGroups.map((TaxGroup) => (
                    <MenuItem
                      key={TaxGroup.id}
                      value={TaxGroup.id}
                    >
                      {TaxGroup.description}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="error">{errors.taxGroup}</Typography>
              </FormControl>
              <TextField
                label="Our Customer No."
                value={formData.ourCustomerNo}
                onChange={(e) => handleChange("ourCustomerNo", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.ourCustomerNo}
                helperText={errors.ourCustomerNo}
              />
            </Stack>
          </Grid>

          {/* Purchasing */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Purchasing</Typography>
              <Divider />

              <TextField
                label="Bank Name/ Account"
                value={formData.bankAccount}
                onChange={(e) => handleChange("bankAccount", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.bankAccount}
                helperText={errors.bankAccount}
              />
              <FormattedNumberField
                label="Credit Limit"
                value={formData.creditLimit}
                onChange={(e) => handleChange("creditLimit", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.creditLimit}
                helperText={errors.creditLimit}
              />
              <FormControl size="small" fullWidth error={!!errors.paymentTerms}>
                <InputLabel>Payment Terms</InputLabel>
                <Select
                  value={formData.paymentTerms}
                  onChange={(e) => handleChange("paymentTerms", e.target.value)}
                >
                  {paymentTerms.map(term => (
                    <MenuItem key={term.terms_indicator} value={term.terms_indicator}>
                      {term.description}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="error">{errors.paymentTerms}</Typography>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.pricesIncludeTax}
                    onChange={(e) => handleChange("pricesIncludeTax", e.target.checked)}
                  />
                }
                label="Prices Contain Tax Include"
              />
            </Stack>
          </Grid>

          {/* Accounts */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Accounts</Typography>
              <Divider />
              <FormControl size="small" fullWidth error={!!errors.accountsPayable}>
                <InputLabel>Accounts Payable Account</InputLabel>
                <Select
                  value={formData.accountsPayable}
                  onChange={(e) => handleChange("accountsPayable", e.target.value)}
                  label="Accounts Payable Account"
                >
                  {(() => {
                    // Group chart masters by account_type
                    const groupedAccounts: { [key: string]: any[] } = {};
                    chartMasters.forEach((acc) => {
                      const type = acc.account_type || "Unknown";
                      if (!groupedAccounts[type]) groupedAccounts[type] = [];
                      groupedAccounts[type].push(acc);
                    });

                    // Create grouped menu items with headers
                    return Object.entries(groupedAccounts).flatMap(([typeKey, accounts]) => {
                      const typeText = accountTypeMap[Number(typeKey)] || "Unknown";
                      return [
                        <ListSubheader key={`header-${typeKey}`}>{typeText}</ListSubheader>,
                        ...accounts.map((acc) => (
                          <MenuItem key={acc.account_code} value={acc.account_code}>
                            <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}>
                              {acc.account_code}- {acc.account_name}
                            </Stack>
                          </MenuItem>
                        )),
                      ];
                    });
                  })()}
                </Select>
                <Typography variant="caption" color="error">
                  {errors.accountsPayable}
                </Typography>
              </FormControl>

              <FormControl size="small" fullWidth error={!!errors.purchaseAccount}>
                <InputLabel>Purchase Account</InputLabel>
                <Select
                  value={formData.purchaseAccount}
                  onChange={(e) => handleChange("purchaseAccount", e.target.value)}
                >
                  {(() => {
                    // Group chart masters by account_type
                    const groupedAccounts: { [key: string]: any[] } = {};
                    chartMasters.forEach((acc) => {
                      const type = acc.account_type || "Unknown";
                      if (!groupedAccounts[type]) groupedAccounts[type] = [];
                      groupedAccounts[type].push(acc);
                    });

                    // Create grouped menu items with headers
                    return Object.entries(groupedAccounts).flatMap(([typeKey, accounts]) => {
                      const typeText = accountTypeMap[Number(typeKey)] || "Unknown";
                      return [
                        <ListSubheader key={`header-${typeKey}`}>{typeText}</ListSubheader>,
                        ...accounts.map((acc) => (
                          <MenuItem key={acc.account_code} value={acc.account_code}>
                            <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}>
                              {acc.account_code}- {acc.account_name}
                            </Stack>
                          </MenuItem>
                        )),
                      ];
                    });
                  })()}
                </Select>
                <Typography variant="caption" color="error">{errors.purchaseAccount}</Typography>
              </FormControl>
              <FormControl size="small" fullWidth error={!!errors.purchaseDiscountAccount}>
                <InputLabel>Purchase Discount Account</InputLabel>
                <Select
                  value={formData.purchaseDiscountAccount}
                  onChange={(e) => handleChange("purchaseDiscountAccount", e.target.value)}
                >
                  {(() => {
                    // Group chart masters by account_type
                    const groupedAccounts: { [key: string]: any[] } = {};
                    chartMasters.forEach((acc) => {
                      const type = acc.account_type || "Unknown";
                      if (!groupedAccounts[type]) groupedAccounts[type] = [];
                      groupedAccounts[type].push(acc);
                    });

                    // Create grouped menu items with headers
                    return Object.entries(groupedAccounts).flatMap(([typeKey, accounts]) => {
                      const typeText = accountTypeMap[Number(typeKey)] || "Unknown";
                      return [
                        <ListSubheader key={`header-${typeKey}`}>{typeText}</ListSubheader>,
                        ...accounts.map((acc) => (
                          <MenuItem key={acc.account_code} value={acc.account_code}>
                            <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}>
                              {acc.account_code}- {acc.account_name}
                            </Stack>
                          </MenuItem>
                        )),
                      ];
                    });
                  })()}
                </Select>
                <Typography variant="caption" color="error">{errors.purchaseDiscountAccount}</Typography>
              </FormControl>
            </Stack>
          </Grid>

          {/* Contact Data */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Contact Data</Typography>
              <Divider />
              <TextField
                label="Contact Person"
                value={formData.contactPerson}
                onChange={(e) => handleChange("contactPerson", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.contactPerson}
                helperText={errors.contactPerson}
              />
              <TextField
                label="Phone Number"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.phone}
                helperText={errors.phone}
              />
              <TextField
                label="Secondary Phone Number"
                value={formData.secondaryPhone}
                onChange={(e) => handleChange("secondaryPhone", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.secondaryPhone}
                helperText={errors.secondaryPhone}
              />
              <TextField
                label="Fax Number"
                value={formData.fax}
                onChange={(e) => handleChange("fax", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.fax}
                helperText={errors.fax}
              />
              <TextField
                label="Email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                size="small"
                fullWidth
                error={!!errors.email}
                helperText={errors.email}
              />
              <FormControl size="small" fullWidth error={!!errors.documentLanguage}>
                <InputLabel>Document Language</InputLabel>
                <Select
                  value={formData.documentLanguage}
                  onChange={(e) => handleChange("documentLanguage", e.target.value)}
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="si">Sinhala</MenuItem>
                  <MenuItem value="ta">Tamil</MenuItem>
                </Select>
                <Typography variant="caption" color="error">{errors.documentLanguage}</Typography>
              </FormControl>

            </Stack>
          </Grid>

          {/* Addresses */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Addresses</Typography>
              <Divider />
              <TextField
                label="Mailing Address"
                value={formData.mailingAddress}
                onChange={(e) => handleChange("mailingAddress", e.target.value)}
                size="small"
                fullWidth
                multiline
                rows={2}
                error={!!errors.mailingAddress}
                helperText={errors.mailingAddress}
              />
              <TextField
                label="Physical Address"
                value={formData.physicalAddress}
                onChange={(e) => handleChange("physicalAddress", e.target.value)}
                size="small"
                fullWidth
                multiline
                rows={2}
                error={!!errors.physicalAddress}
                helperText={errors.physicalAddress}
              />
            </Stack>
          </Grid>

          {/* General */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">General</Typography>
              <Divider />
              <TextField
                label="General Notes"
                value={formData.generalNotes}
                onChange={(e) => handleChange("generalNotes", e.target.value)}
                size="small"
                fullWidth
                multiline
                rows={3}
                error={!!errors.generalNotes}
                helperText={errors.generalNotes}
              />
            </Stack>
          </Grid>

          {/* CostCenter */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Cost Center</Typography>
              <Divider />
              <CostCenterSelect
                label="CostCenter 1"
                value={formData.costCenter}
                onChange={(v) => handleChange("costCenter", v)}
                costCenterType={1}
                error={!!errors.costCenter}
                helperText={errors.costCenter || " "}
              />
            </Stack>
          </Grid>

        </Grid>

        {/* Action Buttons */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            mt: theme.spacing(4),
            flexDirection: { xs: "column", sm: "row" },
            gap: theme.spacing(2),
          }}
        >
          <Button variant="outlined"
            onClick={() => window.history.back()}>
            Back
          </Button>
          <Button disabled={!canEdit}
            variant="contained"
            sx={{ backgroundColor: theme.palette.primary.main }}
            onClick={handleSubmit}
          >
            Add New Supplier Details
          </Button>
        </Box>
      </Box>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Supplier has been added successfully!"
        addFunc={async () => { }}
        handleClose={() => setOpen(false)}
        onSuccess={() => setOpen(false)}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}
