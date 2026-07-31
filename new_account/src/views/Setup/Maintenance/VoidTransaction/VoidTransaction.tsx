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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import DatePickerComponent from "../../../../components/DatePickerComponent";
import {
  getVoidTransactionOptions,
  voidTransaction,
} from "../../../../api/VoidTransaction/VoidTransactionApi";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";

interface VoidTransactionData {
  transactionKey: string;
  voidingDate: Date | null;
  memo: string;
}

export default function VoidTransaction() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Voiding transactions');
  const location = useLocation();
  const preselected = (location.state as { transactionKey?: string } | null)?.transactionKey ?? "";

  const [formData, setFormData] = useState<VoidTransactionData>({
    transactionKey: preselected,
    voidingDate: new Date(),
    memo: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof VoidTransactionData, string>>
  >({});
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["void-transaction-options"],
    queryFn: getVoidTransactionOptions,
  });

  useEffect(() => {
    if (preselected) {
      setFormData((prev) => ({ ...prev, transactionKey: preselected }));
    }
  }, [preselected]);

  const voidMutation = useMutation({
    mutationFn: voidTransaction,
    onSuccess: (data) => {
      enqueueSnackbar(data?.message ?? "Transaction voided.", { variant: "success" });
      void queryClient.invalidateQueries({ queryKey: ["void-transaction-options"] });
      setFormData({ transactionKey: "", voidingDate: new Date(), memo: "" });
    },
    onError: (err: { data?: { message?: string }; message?: string }) => {
      enqueueSnackbar(
        err?.data?.message ?? err?.message ?? "Failed to void transaction.",
        { variant: "error" }
      );
    },
  });

  const handleDateChange = (date: Date | null) => {
    setFormData({ ...formData, voidingDate: date });
    setErrors({ ...errors, voidingDate: "" });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleSelectChange = (e: { target: { name?: string; value: unknown } }) => {
    const { name, value } = e.target;
    if (name) {
      setFormData({ ...formData, [name]: value as string });
      setErrors({ ...errors, [name]: "" });
    }
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof VoidTransactionData, string>> = {};
    if (!formData.transactionKey.trim()) {
      newErrors.transactionKey = "Transaction is required";
    }
    if (!formData.voidingDate) {
      newErrors.voidingDate = "Voiding Date is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const [transType, transNo] = formData.transactionKey.split(":").map(Number);
    voidMutation.mutate({
      trans_type: transType,
      trans_no: transNo,
      voiding_date: formData.voidingDate!.toISOString().slice(0, 10),
      memo: formData.memo || undefined,
    });
  };

  return (
    <FormPageLayout>
      <Paper sx={{ p: 3, maxWidth: "600px", width: "100%", boxShadow: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Void Transaction
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Voids posted GL transactions by creating reversing journal entries (FrontAccounting style).
        </Typography>

        <Stack spacing={2}>
          <FormControl size="small" fullWidth error={!!errors.transactionKey}>
            <InputLabel>Transaction</InputLabel>
            <Select
              name="transactionKey"
              value={formData.transactionKey}
              onChange={handleSelectChange}
              label="Transaction"
              disabled={isLoading}
            >
              <MenuItem value="">-- Select Transaction --</MenuItem>
              {options.map((opt) => (
                <MenuItem
                  key={`${opt.trans_type}:${opt.trans_no}`}
                  value={`${opt.trans_type}:${opt.trans_no}`}
                >
                  {opt.label} — {opt.reference}
                </MenuItem>
              ))}
            </Select>
            {errors.transactionKey && (
              <FormHelperText>{errors.transactionKey}</FormHelperText>
            )}
          </FormControl>

          <DatePickerComponent
            value={formData.voidingDate}
            onChange={handleDateChange}
            label="Voiding Date"
            error={errors.voidingDate}
            disableFuture
          />

          <TextField
            label="Memo"
            name="memo"
            size="small"
            fullWidth
            multiline
            rows={3}
            value={formData.memo}
            onChange={handleInputChange}
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
            disabled={voidMutation.isPending || !canEdit}
          >
            {voidMutation.isPending ? "Voiding…" : "Void Transaction"}
          </Button>
        </Box>
      </Paper>
    </FormPageLayout>
  );
}
