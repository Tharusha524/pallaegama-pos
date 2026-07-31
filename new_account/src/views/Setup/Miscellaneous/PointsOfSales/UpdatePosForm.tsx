import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
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
  CircularProgress,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import { getBankAccounts } from "../../../../api/BankAccount/BankAccountApi";
import { useAuth } from "../../../../context/AuthContext";
import {
  getSalesPos,
  updateSalesPos,
} from "../../../../api/SalePos/SalePosApi";

interface UpdatePosData {
  posName: string;
  allowCreditSale: boolean;
  allowCashSale: boolean;
  defaultCashAccount: string;
  posLocation: string;
}

export default function UpdatePosForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Point of Sale definitions');
  const [formData, setFormData] = useState<UpdatePosData>({
    posName: "",
    allowCreditSale: false,
    allowCashSale: false,
    defaultCashAccount: "",
    posLocation: "",
  });

  const [errors, setErrors] = useState<Partial<UpdatePosData>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

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
  const cashBankAccounts = allBankAccounts.filter(
    (account: any) => Number(account.account_type?.id) === 4
  );

  // For update form, include the current account even if it's not type 4
  const bankAccounts = React.useMemo(() => {
    if (!formData.defaultCashAccount) return cashBankAccounts;
    
    const currentAccount = allBankAccounts.find(
      (account: any) => account.id.toString() === formData.defaultCashAccount
    );
    
    if (currentAccount && Number(currentAccount.account_type?.id) !== 4) {
      return [currentAccount, ...cashBankAccounts];
    }
    
    return cashBankAccounts;
  }, [allBankAccounts, cashBankAccounts, formData.defaultCashAccount]);

  // Fetch existing POS data
  useEffect(() => {
    const fetchPosData = async () => {
      if (id) {
        try {
          const data = await getSalesPos(id);
          setFormData({
            posName: data.pos_name || "",
            allowCreditSale: data.credit_sale || false,
            allowCashSale: data.cash_sale || false,
            defaultCashAccount: data.pos_account?.toString() || "",
            posLocation: data.pos_location || "",
          });
        } catch (error) {
          console.error("Error fetching POS data:", error);
          alert("Failed to load POS data");
        } finally {
          setLoading(false);
        }
      }
    };
    fetchPosData();
  }, [id]);

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
    const newErrors: Partial<UpdatePosData> = {};
    if (!formData.posName.trim()) newErrors.posName = "POS Name is required";
    if (!formData.defaultCashAccount)
      newErrors.defaultCashAccount = "Default Cash Account is required";
    if (!formData.posLocation)
      newErrors.posLocation = "POS Location is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate() && id) {
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
        await updateSalesPos(id, payload);
        alert("POS updated successfully!");
        navigate("/setup/miscellaneous/point-of-sale");
      } catch (error: any) {
        console.error("Error updating POS:", error);
        const errorMessage = error?.message || error?.response?.data?.message || "Failed to update POS. Please try again.";
        alert(errorMessage);
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <FormPageLayout>
      {loading ? (
        <CircularProgress />
      ) : (
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
          Update POS
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
            {submitting ? "Updating..." : "Update"}
          </Button>
        </Box>
      </Paper>
      )}
    </FormPageLayout>
  );
}
