import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Button,
  Paper,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import theme from "../../../../theme";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrency, updateCurrency } from "../../../../api/Currency/currencyApi";
import { useParams, useNavigate } from "react-router-dom";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

interface CurrenciesFormData {
  currencyAbbreviation: string;
  currencySymbol: string;
  currencyName: string;
  hundredthsName: string;
  country: string;
  autoExchangeRateUpdate: boolean;
}

export default function UpdateCurrencies() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Currencies');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<CurrenciesFormData>({
    currencyAbbreviation: "",
    currencySymbol: "",
    currencyName: "",
    hundredthsName: "",
    country: "",
    autoExchangeRateUpdate: false,
  });

  const [errors, setErrors] = useState<Partial<CurrenciesFormData>>({});

  useEffect(() => {
    if (id) {
      getCurrency(Number(id)).then((data) =>
        setFormData({
          currencyAbbreviation: data.currency_abbreviation,
          currencySymbol: data.currency_symbol,
          currencyName: data.currency_name,
          hundredthsName: data.hundredths_name || "",
          country: data.country,
          autoExchangeRateUpdate: data.auto_exchange_rate_update,
        })
      );
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const validate = (): boolean => {
    const newErrors: Partial<CurrenciesFormData> = {};

    if (!formData.currencyAbbreviation)
      newErrors.currencyAbbreviation = "Currency Abbreviation is required";

    if (!formData.currencySymbol)
      newErrors.currencySymbol = "Currency Symbol is required";

    if (!formData.currencyName)
      newErrors.currencyName = "Currency Name is required";

    if (!formData.hundredthsName)
      newErrors.hundredthsName = "Hundredths Name is required";

    if (!formData.country) newErrors.country = "Country is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !id) return;

    try {
      const payload = {
        currency_abbreviation: formData.currencyAbbreviation,
        currency_symbol: formData.currencySymbol,
        currency_name: formData.currencyName,
        hundredths_name: formData.hundredthsName,
        country: formData.country,
        auto_exchange_rate_update: formData.autoExchangeRateUpdate,
      };

      const updatedCurrency = await updateCurrency(Number(id), payload);

      queryClient.invalidateQueries({ queryKey: ["currencies"] });
      setOpen(true);
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message ||
        "Failed to update currency Please try again."
      );
      setErrorOpen(true);
      console.error("Error updating currency:", err);
    }
  };


  return (
    <FormPageLayout>
      <Paper
        sx={{
          p: theme.spacing(3),
          width: "100%",
          maxWidth: isMobile ? "100%" : "600px",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}
        >
          Currencies
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Currency Abbreviation"
            name="currencyAbbreviation"
            size="small"
            fullWidth
            value={formData.currencyAbbreviation}
            onChange={handleChange}
            error={!!errors.currencyAbbreviation}
            helperText={errors.currencyAbbreviation}
          />

          <TextField
            label="Currency Symbol"
            name="currencySymbol"
            size="small"
            fullWidth
            value={formData.currencySymbol}
            onChange={handleChange}
            error={!!errors.currencySymbol}
            helperText={errors.currencySymbol}
          />

          <TextField
            label="Currency Name"
            name="currencyName"
            size="small"
            fullWidth
            value={formData.currencyName}
            onChange={handleChange}
            error={!!errors.currencyName}
            helperText={errors.currencyName}
          />

          <TextField
            label="Hundredths Name"
            name="hundredthsName"
            size="small"
            fullWidth
            value={formData.hundredthsName}
            onChange={handleChange}
            error={!!errors.hundredthsName}
            helperText={errors.hundredthsName}
          />

          <TextField
            label="Country"
            name="country"
            size="small"
            fullWidth
            value={formData.country}
            onChange={handleChange}
            error={!!errors.country}
            helperText={errors.country}
          />

          <FormControlLabel
            control={
              <Checkbox
                name="autoExchangeRateUpdate"
                checked={formData.autoExchangeRateUpdate}
                onChange={handleChange}
              />
            }
            label="Automatic Exchange Rate Update"
          />
        </Stack>

        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            gap: 2,
            mt: 3,
          }}
        >
          <Button
            fullWidth={isMobile}
            onClick={() => window.history.back()}
            variant="outlined"
          >
            Back
          </Button>

          <Button disabled={!canEdit}
            fullWidth={isMobile}
            variant="contained"
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
        content="Currency has been updated successfully!"
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
