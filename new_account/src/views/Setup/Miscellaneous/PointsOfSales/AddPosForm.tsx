import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Paper,
  useTheme,
  useMediaQuery,
  Checkbox,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import { getBankAccounts } from "../../../../api/BankAccount/BankAccountApi";
import { createSalesPos } from "../../../../api/SalePos/SalePosApi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";

interface AddPosData {
  posName: string;
  allowCreditSale: boolean;
  allowCashSale: boolean;
  defaultCashAccount: string;
  posLocation: string;
}

export default function AddPosForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Point of Sale definitions');
  const [formData, setFormData] = useState<AddPosData>({
    posName: "",
    allowCreditSale: false,
    allowCashSale: false,
    defaultCashAccount: "",
    posLocation: "",
  });

  const [errors, setErrors] = useState<Partial<AddPosData>>({});
  const [submitting, setSubmitting] = useState(false);
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const navigate = useNavigate();

  // Fetch inventory locations
  const { data: locations = [] } = useQuery({
    queryKey: ["inventoryLocations"],
    queryFn: getInventoryLocations,
  });

  // Fetch bank accounts
  const { data: allBankAccounts = [] } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: getBankAccounts,
  });

  // Filter bank accounts with account_type.id = 4 (Cash Account)
  const bankAccounts = allBankAccounts.filter(
    (account: any) => Number(account.account_type?.id) === 4
  );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData({ ...formData, [name]: checked });
  };

  const handleSelectChange = (
    e: React.ChangeEvent<{ value: unknown; name?: string }>
  ) => {
    const { name, value } = e.target;
    if (name) {
      setFormData({ ...formData, [name]: value as string });
      setErrors({ ...errors, [name]: "" });
    }
  };

  const validate = () => {
    const newErrors: Partial<AddPosData> = {};
    if (!formData.posName.trim()) newErrors.posName = "POS Name is required";
    if (!formData.defaultCashAccount)
      newErrors.defaultCashAccount = "Default Cash Account is required";
    if (!formData.posLocation)
      newErrors.posLocation = "POS Location is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate()) {
      setSubmitting(true);
      try {
        const payload = {
          pos_name: formData.posName,
          cash_sale: formData.allowCashSale,
          credit_sale: formData.allowCreditSale,
          pos_location: formData.posLocation,
          pos_account: Number(formData.defaultCashAccount),
          inactive: false,
        };
        await createSalesPos(payload);
        alert("POS added successfully!");
        navigate("/setup/miscellaneous/point-of-sale");
      } catch (error: any) {
        console.error("Error adding POS:", error);
        alert(
          error?.response?.data?.message || "Failed to add POS. Please try again."
        );
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <FormPageLayout>
      <Paper
        sx={{
          p: 3,
          maxWidth: "600px",
          width: "100%",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}
        >
          Add POS
        </Typography>

        <Stack spacing={2}>
          {/* POS Name */}
          <TextField
            label="Point of Sale Name"
            name="posName"
            size="small"
            fullWidth
            value={formData.posName}
            onChange={handleInputChange}
            error={!!errors.posName}
            helperText={errors.posName}
          />

          {/* Allowed Credit Sale */}
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.allowCreditSale}
                onChange={handleCheckboxChange}
                name="allowCreditSale"
              />
            }
            label="Allowed Credit Sale Terms"
          />

          {/* Allowed Cash Sale */}
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.allowCashSale}
                onChange={handleCheckboxChange}
                name="allowCashSale"
              />
            }
            label="Allowed Cash Sale Terms"
          />

          {/* Default Cash Account */}
          <FormControl fullWidth size="small" error={!!errors.defaultCashAccount}>
            <InputLabel>Default Cash Account</InputLabel>
            <Select
              name="defaultCashAccount"
              value={formData.defaultCashAccount}
              onChange={(e) => {
                setFormData({ ...formData, defaultCashAccount: e.target.value as string });
                setErrors({ ...errors, defaultCashAccount: "" });
              }}
              label="Default Cash Account"
            >
              {bankAccounts.map((account: any) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.bank_account_name}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="error">
              {errors.defaultCashAccount}
            </Typography>
          </FormControl>

          {/* POS Location */}
          <FormControl fullWidth size="small" error={!!errors.posLocation}>
            <InputLabel>POS Location</InputLabel>
            <Select
              name="posLocation"
              value={formData.posLocation}
              onChange={(e) => {
                setFormData({ ...formData, posLocation: e.target.value as string });
                setErrors({ ...errors, posLocation: "" });
              }}
              label="POS Location"
            >
              {locations.map((location: any) => (
                <MenuItem key={location.loc_code} value={location.loc_code}>
                  {location.location_name}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="error">
              {errors.posLocation}
            </Typography>
          </FormControl>
        </Stack>

        {/* Actions */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            mt: 3,
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 2 : 0,
          }}
        >
          <Button onClick={() => window.history.back()}>Back</Button>

          <Button
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
            disabled={submitting || !canEdit}
          >
            {submitting ? "Adding..." : "Add POS"}
          </Button>
        </Box>
      </Paper>
    </FormPageLayout>
  );
}
