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
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import theme from "../../../../theme";
import DatePickerComponent from "../../../../components/DatePickerComponent";
import { createExchangeRate } from "../../../../api/ExchangeRate/ExchangeRateApi";
import ErrorModal from "../../../../components/ErrorModal";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import { useAuth } from "../../../../context/AuthContext";

interface ExchangeRateData {
  dateToUse: Date | null;
  exchangeRate: string;
}

export default function AddExchangeRateForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Exchange rate table changes');
  const navigate = useNavigate();
  const location = useLocation();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Safely get currency from location.state
  const currency_abbreviation = (location.state as { currency_abbreviation?: string })?.currency_abbreviation;

  // If currency is missing, redirect back
  useEffect(() => {
    if (!currency_abbreviation) {
      alert("No currency selected. Redirecting back.");
      navigate(-1);
    }
  }, [currency_abbreviation, navigate]);

  const [formData, setFormData] = useState<ExchangeRateData>({
    dateToUse: null,
    exchangeRate: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ExchangeRateData, string>>>({});

  const handleDateChange = (date: Date | null) => {
    setFormData({ ...formData, dateToUse: date });
    setErrors({ ...errors, dateToUse: "" });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof ExchangeRateData, string>> = {};
    if (!formData.dateToUse) newErrors.dateToUse = "Date is required";
    if (!formData.exchangeRate.trim()) newErrors.exchangeRate = "Exchange Rate is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !currency_abbreviation) return;

    const payload = {
      curr_code: currency_abbreviation,
      date: formData.dateToUse?.toISOString().split("T")[0],
      rate_buy: parseFloat(formData.exchangeRate),
      rate_sell: parseFloat(formData.exchangeRate),
    };

    try {
      setLoading(true);
      await createExchangeRate(payload);
      setOpen(true);
    } catch (error: any) {
      console.error("Failed to create exchange rate:", error.response?.data || error);
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to add exchange rate Please try again."
      );
      setErrorOpen(true);
    } finally {
      setLoading(false);
    }
  };

  if (!currency_abbreviation) return null; // Prevent render if currency is missing

  return (
    <FormPageLayout>
      <Paper
        sx={{
          p: theme.spacing(3),
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
          Add Exchange Rate
        </Typography>

        <Stack spacing={2}>
          {/* Currency (disabled) */}
          <TextField
            label="Currency"
            value={currency_abbreviation}
            size="small"
            fullWidth
            disabled
          />

          {/* Date to use for */}
          <DatePickerComponent
            value={formData.dateToUse}
            onChange={handleDateChange}
            label="Date to Use For"
            error={errors.dateToUse}
          />

          {/* Exchange Rate */}
          <TextField
            label="Exchange Rate"
            name="exchangeRate"
            size="small"
            fullWidth
            value={formData.exchangeRate}
            onChange={handleInputChange}
            error={!!errors.exchangeRate}
            helperText={
              errors.exchangeRate ||
              "Used for sales and purchases (LKR per 1 unit of foreign currency)."
            }
          />
        </Stack>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            mt: 3,
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 2 : 0,
          }}
        >
          <Button onClick={() => navigate(-1)}>Back</Button>

          <Button
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
            disabled={loading || !canEdit}
          >
            {loading ? "Saving..." : "Save Exchange Rate"}
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Exchange Rate has been added successfully!"
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
