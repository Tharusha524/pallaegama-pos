import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  Paper,
  Divider,
  FormControl,
  InputLabel,
  Grid,
  FormHelperText,
} from "@mui/material";
import theme from "../../../../theme";
import { useForm } from "react-hook-form";
import { createCompany, getCompanies } from "../../../../api/CompanySetup/CompanySetupApi";
import { getCurrencies } from "../../../../api/Currency/currencyApi";
import { getFiscalYears } from "../../../../api/FiscalYear/FiscalYearApi";
import { getSalesTypes } from "../../../../api/SalesMaintenance/salesService";
import { useNavigate } from "react-router";
import ErrorModal from "../../../../components/ErrorModal";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import { useAuth } from "../../../../context/AuthContext";
import {
  appendCompanySetupFormData,
  handleCompanySetupInputChange,
} from "../../../../utils/companySetupFormUtils";

interface CompanyFormData {
  name: string;
  address: string;
  domicile: string;
  phone_number: string;
  fax_number: string;
  email_address: string;
  bcc_address: string;
  official_company_number: string;
  GSTNo: string;
  home_currency_id: string;
  new_company_logo: File | null;
  delete_company_logo: boolean;
  timezone_on_reports: boolean;
  company_logo_on_reports: boolean;
  use_barcodes_on_stocks: boolean;
  auto_increase_of_document_references: boolean;
  use_cost_centers_on_recurrent_invoices: boolean;
  use_long_descriptions_on_invoices: boolean;
  company_logo_on_views: boolean;

  databaseSchemeVersion: string;

  fiscal_year_id: string;
  tax_periods: string;
  tax_last_period: string;
  put_alternative_tax_include_on_docs: boolean;
  suppress_tax_rates_on_docs: boolean;
  automatic_revaluation_currency_accounts: boolean;
  base_auto_price_calculation: string;
  add_price_from_std_cost: string;
  round_calculated_prices_to_nearest_cents: string;
  manufacturing_enabled: boolean;
  fixed_assets_enabled: boolean;
  use_cost_centers: boolean;
  short_name_and_name_in_list: boolean;
  open_print_dialog_direct_on_reports: boolean;
  search_item_list: boolean;
  search_customer_list: boolean;
  search_supplier_list: boolean;
  login_timeout_seconds: string;
  max_day_range_in_documents_days: string;
}

export default function CompanySetupForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Company parameters');
  const [formData, setFormData] = useState<CompanyFormData>({
    name: "",
    address: "",
    domicile: "",
    phone_number: "",
    fax_number: "",
    email_address: "",
    bcc_address: "",
    official_company_number: "",
    GSTNo: "",
    home_currency_id: "",
    new_company_logo: null,
    delete_company_logo: false,
    timezone_on_reports: false,
    company_logo_on_reports: false,
    use_barcodes_on_stocks: false,
    auto_increase_of_document_references: false,
    use_cost_centers_on_recurrent_invoices: false,
    use_long_descriptions_on_invoices: false,
    company_logo_on_views: false,
    databaseSchemeVersion: "2.4.1",
    fiscal_year_id: "",
    tax_periods: "",
    tax_last_period: "",
    put_alternative_tax_include_on_docs: false,
    suppress_tax_rates_on_docs: false,
    automatic_revaluation_currency_accounts: false,
    base_auto_price_calculation: "",
    add_price_from_std_cost: "",
    round_calculated_prices_to_nearest_cents: "",
    manufacturing_enabled: false,
    fixed_assets_enabled: false,
    use_cost_centers: false,
    short_name_and_name_in_list: false,
    open_print_dialog_direct_on_reports: false,
    search_item_list: false,
    search_customer_list: false,
    search_supplier_list: false,
    login_timeout_seconds: "",
    max_day_range_in_documents_days: "",
  });

  const [errors, setErrors] = useState<Partial<CompanyFormData>>({});
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [salesTypes, setSalesTypes] = useState<any[]>([]);
  const navigate = useNavigate();
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const checkExistingData = async () => {
      try {
        const data = await getCompanies();
        if (data && data.length > 0) {
          navigate(`/setup/companysetup/update-company-setup/${data[0].id}`);
          return;
        }
      } catch (error) {
        console.error("Failed to check existing company data:", error);
      }
    };

    const loadCurrencies = async () => {
      try {
        const data = await getCurrencies();
        setCurrencies(data);
      } catch (error) {
        console.error("Failed to fetch currencies:", error);
      }
    };

    const loadFiscalYears = async () => {
      try {
        const data = await getFiscalYears();
        setFiscalYears(data);
      } catch (error) {
        console.error("Failed to fetch fiscal years:", error);
      }
    };

    const loadSalesTypes = async () => {
      try {
        const data = await getSalesTypes();
        setSalesTypes(data);
      } catch (error) {
        console.error("Failed to fetch sales types:", error);
      }
    };

    checkExistingData();
    loadCurrencies();
    loadFiscalYears();
    loadSalesTypes();
  }, []);

  const validate = (): boolean => {
    const newErrors: Partial<CompanyFormData> = {};

    if (!formData.name) newErrors.name = "Company name is required";
    if (!formData.address) newErrors.address = "Address is required";
    if (!formData.domicile) newErrors.domicile = "Domicile is required";
    if (!formData.phone_number) newErrors.phone_number = "Phone number is required";
    else if (!/^[0-9]+$/.test(formData.phone_number)) newErrors.phone_number = "Invalid phone number";
    if (!formData.email_address) newErrors.email_address = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email_address)) newErrors.email_address = "Invalid email";
    if (formData.bcc_address && !/\S+@\S+\.\S+/.test(formData.bcc_address)) newErrors.bcc_address = "Invalid email";
    if (!formData.official_company_number) newErrors.official_company_number = "Company number is required";
    if (!formData.home_currency_id) newErrors.home_currency_id = "Currency is required";
    if (!formData.fiscal_year_id) newErrors.fiscal_year_id = "Fiscal year is required";
    if (!formData.tax_periods) newErrors.tax_periods = "Tax periods required";
    else if (!/^[0-9]+$/.test(formData.tax_periods)) newErrors.tax_periods = "Invalid number";
    if (formData.tax_last_period && !/^[0-9]+$/.test(formData.tax_last_period))
      newErrors.tax_last_period = "Invalid number";
    if (!formData.base_auto_price_calculation)
      newErrors.base_auto_price_calculation = "Select a base for pricing";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => handleCompanySetupInputChange(prev, event));
  };

  const handleSubmit = async () => {
    const isValid = validate();

    if (isValid) {
      try {
        const formDataToSend = new FormData();
        appendCompanySetupFormData(formDataToSend, formData);

        const response = await createCompany(formDataToSend);
        if (response && response.id) {
          navigate(`/setup/companysetup/update-company-setup/${response.id}`);
        } else {
          window.history.back();
        }
        setOpen(true);
      } catch (error: any) {
        console.error(error);
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to save company setup Please try again."
        );
        setErrorOpen(true);
      }
    }
  };

  return (
    <FormPageLayout>
      <Paper
        sx={{
          p: theme.spacing(3),
          width: "100%",
          maxWidth: "1200px",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" sx={{ mb: 2, textAlign: "center" }}>
          Company Setup
        </Typography>

        <Grid container spacing={4}>
          {/* Left Section - General Settings */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">General Settings</Typography>
              <Divider />

              <TextField
                label="Name (to appear on reports)"
                name="name"
                size="small"
                fullWidth
                value={formData.name}
                onChange={handleChange}
                error={!!errors.name}
                helperText={errors.name}
              />

              <TextField
                label="Address"
                name="address"
                size="small"
                fullWidth
                multiline
                rows={3}
                value={formData.address}
                onChange={handleChange}
                error={!!errors.address}
                helperText={errors.address}
              />

              <TextField
                label="Domicile"
                name="domicile"
                size="small"
                fullWidth
                value={formData.domicile}
                onChange={handleChange}
                error={!!errors.domicile}
                helperText={errors.domicile}
              />

              <TextField
                label="Phone Number"
                name="phone_number"
                size="small"
                fullWidth
                value={formData.phone_number}
                onChange={handleChange}
                error={!!errors.phone_number}
                helperText={errors.phone_number}
              />

              <TextField
                label="Fax Number"
                name="fax_number"
                size="small"
                fullWidth
                value={formData.fax_number}
                onChange={handleChange}
              />

              <TextField
                label="Email Address"
                name="email_address"
                size="small"
                fullWidth
                value={formData.email_address}
                onChange={handleChange}
                error={!!errors.email_address}
                helperText={errors.email_address}
              />

              <TextField
                label="BCC Address for all outgoing mails"
                name="bcc_address"
                size="small"
                fullWidth
                value={formData.bcc_address}
                onChange={handleChange}
                error={!!errors.bcc_address}
                helperText={errors.bcc_address}
              />

              <TextField
                label="Official Company Number"
                name="official_company_number"
                size="small"
                fullWidth
                value={formData.official_company_number}
                onChange={handleChange}
                error={!!errors.official_company_number}
                helperText={errors.official_company_number}
              />

              <TextField
                label="GST Number"
                name="GSTNo"
                size="small"
                fullWidth
                value={formData.GSTNo}
                onChange={handleChange}
              />

              <FormControl size="small" fullWidth error={!!errors.home_currency_id}>
                <InputLabel>Home Currency</InputLabel>
                <Select
                  name="home_currency_id"
                  value={formData.home_currency_id}
                  onChange={handleChange}
                  label="Home Currency"
                >
                  {currencies.map((currency) => (
                    <MenuItem key={currency.id} value={currency.id}>
                      {currency.currency_name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{errors.home_currency_id}</FormHelperText>
              </FormControl>

              <Box sx={{ mt: 2 }}>
                <Typography variant="body1">New Company Logo (.jpg)</Typography>
                <input type="file" name="new_company_logo" onChange={handleChange} />
              </Box>

              <FormControlLabel
                label="Delete Company Logo"
                control={
                  <Checkbox
                    name="delete_company_logo"
                    checked={formData.delete_company_logo}
                    onChange={handleChange}
                  />
                }
              />

              <FormControlLabel
                label="Time Zone on Reports"
                control={
                  <Checkbox
                    name="timezone_on_reports"
                    checked={formData.timezone_on_reports}
                    onChange={handleChange}
                  />
                }
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.company_logo_on_reports}
                    onChange={handleChange}
                    name="company_logo_on_reports"
                  />
                }
                label="Company Logo on Reports"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.use_barcodes_on_stocks}
                    onChange={handleChange}
                    name="use_barcodes_on_stocks"
                  />
                }
                label="Use Barcodes on Stocks"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.auto_increase_of_document_references}
                    onChange={handleChange}
                    name="auto_increase_of_document_references"
                  />
                }
                label="Auto Increase of Document References"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.use_cost_centers_on_recurrent_invoices}
                    onChange={handleChange}
                    name="use_cost_centers_on_recurrent_invoices"
                  />
                }
                label="Use CostCenters on Recurrent Invoices"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.use_long_descriptions_on_invoices}
                    onChange={handleChange}
                    name="use_long_descriptions_on_invoices"
                  />
                }
                label="Use Long Descriptions on Invoices"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.company_logo_on_views}
                    onChange={handleChange}
                    name="company_logo_on_views"
                  />
                }
                label="Company Logo on Views"
              />

              <TextField
                label="Database Scheme Version"
                name="databaseSchemeVersion"
                size="small"
                fullWidth
                value={formData.databaseSchemeVersion}
                InputProps={{ readOnly: true }}
              />
            </Stack>
          </Grid>

          {/* Right Section - Ledger & Options */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">General Ledger Settings</Typography>
              <Divider />

              <Typography variant="subtitle1">Fiscal Year</Typography>

              <FormControl size="small" fullWidth error={!!errors.fiscal_year_id}>
                <InputLabel>Fiscal Year</InputLabel>
                <Select
                  name="fiscal_year_id"
                  value={formData.fiscal_year_id}
                  onChange={handleChange}
                  label="Fiscal Year"
                >
                  {fiscalYears.map((fy) => (
                    <MenuItem key={fy.id} value={fy.id}>
                      {fy.fiscal_year_from} - {fy.fiscal_year_to} - {fy.closed ? 'Closed' : 'Active'}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{errors.fiscal_year_id}</FormHelperText>
              </FormControl>

              <TextField
                label="Tax Periods (months)"
                name="tax_periods"
                size="small"
                fullWidth
                value={formData.tax_periods}
                onChange={handleChange}
                error={!!errors.tax_periods}
                helperText={errors.tax_periods}
              />

              <TextField
                label="Last Tax Period (months back)"
                name="tax_last_period"
                size="small"
                fullWidth
                value={formData.tax_last_period}
                onChange={handleChange}
                error={!!errors.tax_last_period}
                helperText={errors.tax_last_period}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.put_alternative_tax_include_on_docs}
                    onChange={handleChange}
                    name="put_alternative_tax_include_on_docs"
                  />
                }
                label="Put Alternative Tax Include on Docs"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.suppress_tax_rates_on_docs}
                    onChange={handleChange}
                    name="suppress_tax_rates_on_docs"
                  />
                }
                label="Suppress Tax Rate on Docs"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.automatic_revaluation_currency_accounts}
                    onChange={handleChange}
                    name="automatic_revaluation_currency_accounts"
                  />
                }
                label="Automatic Revaluation Currency Accounts"
              />

              <Typography variant="subtitle1" sx={{ mt: 2 }}>
                Sales Pricing
              </Typography>

              <FormControl size="small" fullWidth error={!!errors.base_auto_price_calculation}>
                <InputLabel>Base For Auto Price Calculation</InputLabel>
                <Select
                  name="base_auto_price_calculation"
                  value={formData.base_auto_price_calculation}
                  onChange={handleChange}
                  label="Base For Auto Price Calculation"
                >
                  {salesTypes.map((st) => (
                    <MenuItem key={st.id} value={st.id}>
                      {st.typeName}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{errors.base_auto_price_calculation}</FormHelperText>
              </FormControl>

              <TextField
                label="Add Price from Std Cost"
                name="add_price_from_std_cost"
                size="small"
                fullWidth
                value={formData.add_price_from_std_cost}
                onChange={handleChange}
              />

              <TextField
                label="Round Calculated Prices to Nearest"
                name="round_calculated_prices_to_nearest_cents"
                size="small"
                fullWidth
                value={formData.round_calculated_prices_to_nearest_cents}
                onChange={handleChange}
              />

              <Typography variant="subtitle1" sx={{ mt: 2 }}>
                Optional Modules
              </Typography>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.manufacturing_enabled}
                    onChange={handleChange}
                    name="manufacturing_enabled"
                  />
                }
                label="Manufacturing"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.fixed_assets_enabled}
                    onChange={handleChange}
                    name="fixed_assets_enabled"
                  />
                }
                label="Fixed Assets"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.use_cost_centers}
                    onChange={handleChange}
                    name="use_cost_centers"
                  />
                }
                label="Cost Center"
              />

              <Typography variant="subtitle1" sx={{ mt: 2 }}>
                User Interface Options
              </Typography>
              <Divider />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.short_name_and_name_in_list}
                    onChange={handleChange}
                    name="short_name_and_name_in_list"
                  />
                }
                label="Short Name and Name in List"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.open_print_dialog_direct_on_reports}
                    onChange={handleChange}
                    name="open_print_dialog_direct_on_reports"
                  />
                }
                label="Open Print Dialog Direct on Reports"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.search_item_list}
                    onChange={handleChange}
                    name="search_item_list"
                  />
                }
                label="Search Item List"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.search_customer_list}
                    onChange={handleChange}
                    name="search_customer_list"
                  />
                }
                label="Search Customer List"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.search_supplier_list}
                    onChange={handleChange}
                    name="search_supplier_list"
                  />
                }
                label="Search Supplier List"
              />

              <TextField
                label="Login Timeout (seconds)"
                name="login_timeout_seconds"
                size="small"
                fullWidth
                value={formData.login_timeout_seconds}
                onChange={handleChange}
              />

              <TextField
                label="Max Day Range in Documents (days)"
                name="max_day_range_in_documents_days"
                size="small"
                fullWidth
                value={formData.max_day_range_in_documents_days}
                onChange={handleChange}
              />
            </Stack>
          </Grid>
        </Grid>

        {/* Buttons */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            mt: 3,
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
          }}
        >
          <Button onClick={() => navigate('/setup/companysetup')} fullWidth={true} sx={{ sm: { width: "auto" } }}>
            Back
          </Button>

          <Button disabled={!canEdit}
            variant="contained"
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
            fullWidth={true}
          >
            Create
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Company setup has been added successfully!"
        addFunc={async () => { }}
        handleClose={() => setOpen(false)}
        onSuccess={() => window.history.back()}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}