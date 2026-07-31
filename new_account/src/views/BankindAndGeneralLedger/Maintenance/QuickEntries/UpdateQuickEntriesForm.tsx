import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSnackbar } from "notistack";
import { getQuickEntry, updateQuickEntry } from "../../../../api/QuickEntry/QuickEntryApi";
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
} from "@mui/material";
import theme from "../../../../theme";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

interface QuickEntryFormData {
  name: string;
  description: string;
  usage: string;
  entryType: string;
  baseAmountDescription: string;
  defaultBaseAmount: string;
}

export default function UpdateQuickEntriesForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Quick GL entry definitions');
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState<QuickEntryFormData>({
    name: "",
    description: "",
    usage: "",
    entryType: "",
    baseAmountDescription: "",
    defaultBaseAmount: "",
  });

  const [errors, setErrors] = useState<Partial<QuickEntryFormData>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

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

  const validate = () => {
    const newErrors: Partial<QuickEntryFormData> = {};
    if (!formData.name) newErrors.name = "Name is required";
    if (!formData.description) newErrors.description = "Description is required";
    if (!formData.usage) newErrors.usage = "Usage is required";
    if (!formData.entryType) newErrors.entryType = "Select entry type";
    if (!formData.baseAmountDescription) newErrors.baseAmountDescription = "Base amount description required";
    if (!formData.defaultBaseAmount) newErrors.defaultBaseAmount = "Default base amount required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (!id) return;
    getQuickEntry(Number(id)).then((row) => {
      setFormData({
        name: row.name ?? "",
        description: row.description ?? "",
        usage: row.usage ?? "",
        entryType: row.entry_type ?? "",
        baseAmountDescription: row.base_amount_description ?? "",
        defaultBaseAmount: String(row.default_base_amount ?? 0),
      });
    });
  }, [id]);

  const handleSubmit = async () => {
    if (!validate() || !id) return;
    try {
      await updateQuickEntry(Number(id), {
        name: formData.name,
        description: formData.description,
        usage: formData.usage,
        entry_type: formData.entryType,
        base_amount_description: formData.baseAmountDescription,
        default_base_amount: Number(formData.defaultBaseAmount) || 0,
      });
      enqueueSnackbar("Quick entry updated.", { variant: "success" });
      navigate("/bankingandgeneralledger/maintenance/quick-entries");
    } catch {
      enqueueSnackbar("Failed to update quick entry.", { variant: "error" });
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
          Update Quick Entry
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Name"
            name="name"
            size="small"
            fullWidth
            value={formData.name}
            onChange={handleInputChange}
            error={!!errors.name}
            helperText={errors.name || " "}
          />

          <TextField
            label="Description"
            name="description"
            size="small"
            fullWidth
            value={formData.description}
            onChange={handleInputChange}
            error={!!errors.description}
            helperText={errors.description || " "}
          />

          <TextField
            label="Usage"
            name="usage"
            size="small"
            fullWidth
            value={formData.usage}
            onChange={handleInputChange}
            error={!!errors.usage}
            helperText={errors.usage || " "}
          />

          <FormControl size="small" fullWidth error={!!errors.entryType}>
            <InputLabel>Entry Type</InputLabel>
            <Select
              name="entryType"
              value={formData.entryType}
              onChange={handleSelectChange}
              label="Entry Type"
            >
              <MenuItem value="BankDeposit">Bank Deposit</MenuItem>
              <MenuItem value="Credit">Credit</MenuItem>
            </Select>
            <FormHelperText>{errors.entryType || " "}</FormHelperText>
          </FormControl>

          <TextField
            label="Base Amount Description"
            name="baseAmountDescription"
            size="small"
            fullWidth
            value={formData.baseAmountDescription}
            onChange={handleInputChange}
            error={!!errors.baseAmountDescription}
            helperText={errors.baseAmountDescription || " "}
          />

          <FormattedNumberField
            label="Default Base Amount"
            name="defaultBaseAmount"
            size="small"
            fullWidth
            value={formData.defaultBaseAmount}
            onChange={handleInputChange}
            error={!!errors.defaultBaseAmount}
            helperText={errors.defaultBaseAmount || " "}
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
            Update
          </Button>
        </Box>
      </Paper>
    </FormPageLayout>
  );
}
