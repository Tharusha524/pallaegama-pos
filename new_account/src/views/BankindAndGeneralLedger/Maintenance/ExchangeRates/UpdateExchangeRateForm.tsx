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
import { useParams, useNavigate } from "react-router-dom";
import theme from "../../../../theme";
import DatePickerComponent from "../../../../components/DatePickerComponent";
import { ExchangeRate, updateExchangeRate, getExchangeRates } from "../../../../api/ExchangeRate/ExchangeRateApi";
import ErrorModal from "../../../../components/ErrorModal";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal";
import { useAuth } from "../../../../context/AuthContext";

interface ExchangeRateData {
  dateToUse: Date | null;
  exchangeRate: string;
}

export default function UpdateExchangeRateForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Exchange rate table changes');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState<ExchangeRateData>({
    dateToUse: null,
    exchangeRate: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ExchangeRateData, string>>>({});
  const [loading, setLoading] = useState(false);

  // Fetch existing exchange rate
  useEffect(() => {
    const fetchExchangeRate = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await getExchangeRates();
        const er = data.find((e) => e.id.toString() === id);
        if (!er) {
          alert("Exchange rate not found!");
          navigate(-1);
          return;
        }
        setFormData({
          dateToUse: new Date(er.date),
          exchangeRate: String(er.rate_buy || er.rate_sell || ""),
        });
      } catch (error) {
        console.error("Failed to fetch exchange rate:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchExchangeRate();
  }, [id, navigate]);

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
    if (!validate() || !id) return;

    try {
      setLoading(true);
      await updateExchangeRate(id, {
        date: formData.dateToUse?.toISOString().split("T")[0],
        rate_buy: parseFloat(formData.exchangeRate),
        rate_sell: parseFloat(formData.exchangeRate),
      });
      setOpen(true);
    } catch (error: any) {
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to update currency Please try again."
      );
      setErrorOpen(true);
      console.error("Failed to update exchange rate:", error.response?.data || error);
      // alert(error.response?.data?.message || "Failed to update exchange rate. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <FormPageLayout>
      <Paper sx={{ p: theme.spacing(3), maxWidth: "600px", width: "100%", boxShadow: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Update Exchange Rate
        </Typography>

        <Stack spacing={2}>
          <DatePickerComponent
            value={formData.dateToUse}
            onChange={handleDateChange}
            label="Date to Use For"
            error={errors.dateToUse}
          />

          <TextField
            label="Exchange Rate"
            name="exchangeRate"
            size="small"
            fullWidth
            value={formData.exchangeRate}
            onChange={handleInputChange}
            error={!!errors.exchangeRate}
            helperText={errors.exchangeRate || " "}
          />
        </Stack>

        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 2 : 0 }}>
          <Button onClick={() => navigate(-1)}>Back</Button>

          <Button
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
            disabled={loading || !canEdit}
          >
            {loading ? "Updating..." : "Update"}
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Exchange Rate has been updated successfully!"
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
