import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
  Checkbox,
  FormControlLabel,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import theme from "../../../../theme";
import { getTransTypes } from "../../../../api/Reflines/TransTypesApi";
import { createRefline } from "../../../../api/Reflines/ReflinesApi";
import { useAuth } from "../../../../context/AuthContext";

interface TransactionReferenceFormData {
  transactionType: string;
  prefix: string;
  pattern: string;
  setAsDefault: boolean;
  memo: string;
}

export default function AddTransactionReferencesForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Stock transactions view');
  const [formData, setFormData] = useState<TransactionReferenceFormData>({
    transactionType: "",
    prefix: "",
    pattern: "",
    setAsDefault: false,
    memo: "",
  });

  const [errors, setErrors] = useState<Partial<TransactionReferenceFormData>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: transTypes = [] } = useQuery({
    queryKey: ["transTypes"],
    queryFn: getTransTypes,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => createRefline(data),
    onSuccess: () => {
      alert("Transaction Reference added successfully!");
      queryClient.invalidateQueries({ queryKey: ["reflines"] });
      navigate("/setup/companysetup/transaction-references");
    },
    onError: (err: any) => {
      console.error(err);
      alert("Failed to add Transaction Reference");
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData({ ...formData, [name]: checked });
  };

  const validate = () => {
    const newErrors: Partial<TransactionReferenceFormData> = {};
    if (!formData.transactionType) newErrors.transactionType = "Transaction type is required";
    if (!formData.prefix) newErrors.prefix = "Prefix is required";
    if (!formData.pattern) newErrors.pattern = "Pattern is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      const payload = {
        trans_type: formData.transactionType,
        prefix: formData.prefix,
        pattern: formData.pattern,
        memo: formData.memo,
        default: !!formData.setAsDefault,
      };
      createMutation.mutate(payload);
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
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Add Transaction Reference
        </Typography>

        <Stack spacing={2}>
          <FormControl size="small" fullWidth error={!!errors.transactionType}>
            <InputLabel>Transaction Type</InputLabel>
            <Select
              name="transactionType"
              value={formData.transactionType}
              onChange={handleSelectChange}
              label="Transaction Type"
            >
              {(transTypes as any[]).length > 0 ? (
                (transTypes as any[]).map((t: any) => (
                  <MenuItem key={String(t.trans_type ?? t.id ?? t.code)} value={String(t.trans_type ?? t.id ?? t.code)}>
                    {t.description ?? t.name ?? t.label ?? String(t.trans_type ?? t.id ?? t.code)}
                  </MenuItem>
                ))
              ) : (
                <MenuItem value="">No transaction types</MenuItem>
              )}
            </Select>
            <FormHelperText>{errors.transactionType || " "}</FormHelperText>
          </FormControl>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Prefix"
              name="prefix"
              size="small"
              fullWidth
              value={formData.prefix}
              onChange={handleInputChange}
              error={!!errors.prefix}
              helperText={errors.prefix || " "}
            />

            <TextField
              label="Pattern"
              name="pattern"
              size="small"
              fullWidth
              value={formData.pattern}
              onChange={handleInputChange}
              error={!!errors.pattern}
              helperText={errors.pattern || " "}
            />
          </Stack>

          <FormControlLabel
            control={
              <Checkbox
                checked={formData.setAsDefault}
                onChange={handleCheckboxChange}
                name="setAsDefault"
              />
            }
            label="Set as Default for This Type"
          />

          <TextField
            label="Memo"
            name="memo"
            size="small"
            fullWidth
            multiline
            rows={2}
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

          <Button disabled={!canEdit}
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            Add New
          </Button>
        </Box>
      </Paper>
    </FormPageLayout>
  );
}
