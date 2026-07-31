import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Button,
  Paper,
  useTheme,
  useMediaQuery,
  CircularProgress,
  ListSubheader,
} from "@mui/material";
import theme from "../../../../theme";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBankAccount, updateBankAccount } from "../../../../api/BankAccount/BankAccountApi";
import { getAccountTypes } from "../../../../api/BankAccount/AccountTypesApi";
import { getCurrencies } from "../../../../api/Currency/currencyApi";
import { getChartMasters } from "../../../../api/GLAccounts/ChartMasterApi";
import ErrorModal from "../../../../components/ErrorModal";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal";
import { useAuth } from "../../../../context/AuthContext";

interface BankAccountsFormData {
  bank_account_name: string;
  account_type: string;
  bank_curr_code: string;
  default_curr_act: boolean;
  account_gl_code: string;
  bank_charges_act: string;
  bank_name: string;
  bank_account_number: string;
  bank_address: string;
}

interface ChartMaster {
  account_code: string;
  account_name: string;
  account_type: string;
}

export default function UpdateBankAccountsForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Bank accounts');
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const [formData, setFormData] = useState<BankAccountsFormData>({
    bank_account_name: "",
    account_type: "",
    bank_curr_code: "",
    default_curr_act: false,
    account_gl_code: "",
    bank_charges_act: "",
    bank_name: "",
    bank_account_number: "",
    bank_address: "",
  });

  const [open, setOpen] = useState(false);
    const [errorOpen, setErrorOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<Partial<BankAccountsFormData>>({});

  // Fetch supporting data
  const { data: accountTypes = [] } = useQuery({
    queryKey: ["accountTypes"],
    queryFn: () => getAccountTypes(),
  });

  const { data: currencies = [] } = useQuery({
    queryKey: ["currencies"],
    queryFn: () => getCurrencies(),
  });

  const { data: chartMaster = [] } = useQuery<ChartMaster[]>({
    queryKey: ["chartMaster"],
    queryFn: () => getChartMasters(),
  });

  // Fetch existing bank account by ID
  const { data: existingBankAccount, isLoading } = useQuery({
    queryKey: ["bankAccount", id],
    queryFn: () => getBankAccount(id!),
    enabled: !!id,
  });

  // Fill form with existing data
  useEffect(() => {
    if (existingBankAccount) {
      setFormData({
        bank_account_name: existingBankAccount.bank_account_name || "",
        account_type: existingBankAccount.account_type?.toString() || "",
        bank_curr_code: existingBankAccount.bank_curr_code || "",
        default_curr_act: existingBankAccount.default_curr_act || false,
        account_gl_code: existingBankAccount.account_gl_code || "",
        bank_charges_act: existingBankAccount.bank_charges_act || "",
        bank_name: existingBankAccount.bank_name || "",
        bank_account_number: existingBankAccount.bank_account_number || "",
        bank_address: existingBankAccount.bank_address || "",
      });
    }
  }, [existingBankAccount]);

  // Mutation for update
  const mutation = useMutation({
    mutationFn: (updatedData: BankAccountsFormData) => updateBankAccount(id!, updatedData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
      setOpen(true);
      // window.history.back();
    },
    onError: (err: any) => {
      setErrorMessage(
          err?.response?.data?.message ||
          "Failed to update bank account Please try again."
        );
        setErrorOpen(true);
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    let val: any = value;
    if (name === "default_curr_act") val = value === "true";
    setFormData({ ...formData, [name]: val });
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<BankAccountsFormData> = {};
    if (!formData.bank_account_name) newErrors.bank_account_name = "Bank account name is required";
    if (!formData.account_type) newErrors.account_type = "Select account type";
    if (!formData.bank_curr_code) newErrors.bank_curr_code = "Select account currency";
    if (!formData.account_gl_code) newErrors.account_gl_code = "Select bank account GL code";
    if (!formData.bank_charges_act) newErrors.bank_charges_act = "Select bank charges account";
    if (!formData.bank_name) newErrors.bank_name = "Bank name is required";
    if (!formData.bank_account_number) newErrors.bank_account_number = "Bank account number is required";
    if (!formData.bank_address) newErrors.bank_address = "Bank address is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      mutation.mutate(formData);
    }
  };

  if (isLoading || !accountTypes.length || !currencies.length || !chartMaster.length) {
    return (
      <Stack alignItems="center" sx={{ mt: 4 }}>
        <CircularProgress />
      </Stack>
    );
  }

  // Mapping numbers to descriptive text
  const accountTypeMap: Record<string, string> = {
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

  // Group chart accounts by descriptive account type
  const groupedAccounts = chartMaster.reduce((acc: Record<string, ChartMaster[]>, account: ChartMaster) => {
    const typeText = accountTypeMap[account.account_type] || "Unknown";
    if (!acc[typeText]) acc[typeText] = [];
    acc[typeText].push(account);
    return acc;
  }, {});

  // Flatten the grouped accounts for direct children in Select
  const groupedMenuItems = Object.entries(groupedAccounts).flatMap(([typeText, accounts]) => [
    <ListSubheader key={`header-${typeText}`}>{typeText}</ListSubheader>,
    ...accounts.map((acc) => (
      <MenuItem key={acc.account_code} value={acc.account_code}>
        {acc.account_code} - {acc.account_name}
      </MenuItem>
    )),
  ]);

  return (
    <FormPageLayout>
      <Paper sx={{ p: theme.spacing(3), maxWidth: "600px", width: "100%", boxShadow: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Update Bank Account
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Bank Account Name"
            name="bank_account_name"
            size="small"
            fullWidth
            value={formData.bank_account_name}
            onChange={handleInputChange}
            error={!!errors.bank_account_name}
            helperText={errors.bank_account_name || " "}
          />

          <FormControl size="small" fullWidth error={!!errors.account_type}>
            <InputLabel>Account Type</InputLabel>
            <Select name="account_type" value={formData.account_type} onChange={handleSelectChange} label="Account Type">
              {accountTypes.map((t: any) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.type_name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.account_type || " "}</FormHelperText>
          </FormControl>

          <FormControl size="small" fullWidth error={!!errors.bank_curr_code}>
            <InputLabel>Bank Account Currency</InputLabel>
            <Select name="bank_curr_code" value={formData.bank_curr_code} onChange={handleSelectChange} label="Currency">
              {currencies.map((c: any) => (
                <MenuItem key={c.currency_abbreviation} value={c.currency_abbreviation}>
                  {c.currency_abbreviation}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.bank_curr_code || " "}</FormHelperText>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>Default Currency Account</InputLabel>
            <Select
              name="default_curr_act"
              value={formData.default_curr_act.toString()}
              onChange={handleSelectChange}
              label="Default Currency Account"
            >
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth error={!!errors.account_gl_code}>
            <InputLabel>Bank Account GL Code</InputLabel>
            <Select name="account_gl_code" value={formData.account_gl_code} onChange={handleSelectChange} label="GL Code">
              {groupedMenuItems}
            </Select>
            <FormHelperText>{errors.account_gl_code || " "}</FormHelperText>
          </FormControl>

          <FormControl size="small" fullWidth error={!!errors.bank_charges_act}>
            <InputLabel>Bank Charges Account</InputLabel>
            <Select name="bank_charges_act" value={formData.bank_charges_act} onChange={handleSelectChange} label="Bank Charges Account">
              {groupedMenuItems}
            </Select>
            <FormHelperText>{errors.bank_charges_act || " "}</FormHelperText>
          </FormControl>

          <TextField
            label="Bank Name"
            name="bank_name"
            size="small"
            fullWidth
            value={formData.bank_name}
            onChange={handleInputChange}
            error={!!errors.bank_name}
            helperText={errors.bank_name || " "}
          />

          <TextField
            label="Bank Account Number"
            name="bank_account_number"
            size="small"
            fullWidth
            value={formData.bank_account_number}
            onChange={handleInputChange}
            error={!!errors.bank_account_number}
            helperText={errors.bank_account_number || " "}
          />

          <TextField
            label="Bank Address"
            name="bank_address"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={formData.bank_address}
            onChange={handleInputChange}
            error={!!errors.bank_address}
            helperText={errors.bank_address || " "}
          />
        </Stack>

        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 2 : 0 }}>
          <Button onClick={() => window.history.back()}>Back</Button>
          <Button disabled={!canEdit}
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            Update
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Bank Account has been updated successfully!"
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