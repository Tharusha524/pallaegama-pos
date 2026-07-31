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
} from "@mui/material";
import theme from "../../../../theme";
import DatePickerComponent from "../../../../components/DatePickerComponent";
import { revaluateCurrencies } from "../../../../api/RevaluateCurency/CurrencyRevaluationApi";
import { useAuth } from "../../../../context/AuthContext";

interface RevaluateCurrenciesData {
  revaluationDate: Date | null;
  memo: string;
}

export default function RevaluateCurrenciesForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Revaluation of currency accounts');
  const [formData, setFormData] = useState<RevaluateCurrenciesData>({
    revaluationDate: null,
    memo: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof RevaluateCurrenciesData, string>>>({});
  const [loading, setLoading] = useState(false);

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const handleDateChange = (date: Date | null) => {
    setFormData({ ...formData, revaluationDate: date });
    setErrors({ ...errors, revaluationDate: "" });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof RevaluateCurrenciesData, string>> = {};
    if (!formData.revaluationDate) newErrors.revaluationDate = "Revaluation Date is required";
    if (!formData.memo.trim()) newErrors.memo = "Memo is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      // Prepare payload
      const payload = {
        date: formData.revaluationDate, // "YYYY-MM-DD"
        memo: formData.memo,
      };

      // Call backend API
      const result = await revaluateCurrencies(payload);
      console.log("Backend response:", result);
      alert("Currencies revaluated successfully!");

      // Reset form (optional)
      setFormData({ revaluationDate: null, memo: "" });

    } catch (error: any) {
      console.error("Failed to revaluate currencies:", error.response?.data || error);
      alert(error.response?.data?.message || "Failed to revaluate currencies.");
    } finally {
      setLoading(false);
    }
  };

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
          Revaluate Currencies
        </Typography>

        <Stack spacing={2}>
          <DatePickerComponent
            value={formData.revaluationDate}
            onChange={handleDateChange}
            label="Date for Revaluation"
            error={errors.revaluationDate}
            disableFuture
          />

          <TextField
            label="Memo"
            name="memo"
            size="small"
            fullWidth
            multiline
            rows={5}
            value={formData.memo}
            onChange={handleInputChange}
            error={!!errors.memo}
            helperText={errors.memo || " "}
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
          <Button onClick={() => window.history.back()}>Back</Button>

          <Button
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
            disabled={loading || !canEdit}
          >
            {loading ? "Revaluating..." : "Revaluate Currencies"}
          </Button>
        </Box>
      </Paper>
    </FormPageLayout>
  );
}
