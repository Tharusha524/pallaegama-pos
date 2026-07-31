import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  SelectChangeEvent,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import theme from "../../../../theme";
import { getCreditStatusSetup, updateCreditStatusSetup } from "../../../../api/CreditStatusSetup/CreditStatusSetupApi";
import { useParams, useNavigate } from "react-router-dom";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal"
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";
interface CreditStatusFormData {
  description: string;
  disallowInvoicing: string; // "yes" or "no"
}

interface UpdateCreditStatusProps {
  id: string | number;
}

export default function UpdateCreditStatusForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Credit status definitions changes');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<CreditStatusFormData>({
    description: "",
    disallowInvoicing: "",
  });

  const [errors, setErrors] = useState<Partial<CreditStatusFormData>>({});
  const [loading, setLoading] = useState(false);
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const data = await getCreditStatusSetup(Number(id));
        setFormData({
          description: data.reason_description,
          disallowInvoicing: data.disallow_invoices ? "yes" : "no",
        });
      } catch (error) {
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to update Credit Status Please try again."
        );
        setErrorOpen(true);
      }
    };
    fetchData();
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const validate = () => {
    const newErrors: Partial<CreditStatusFormData> = {};

    if (!formData.description) newErrors.description = "Description is required";
    if (!formData.disallowInvoicing) newErrors.disallowInvoicing = "Please select an option";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate()) {
      const payload = {
        reason_description: formData.description,
        disallow_invoices: formData.disallowInvoicing === "yes" ? true : false,
      };

      try {
        setLoading(true);
        await updateCreditStatusSetup(Number(id), payload);
        setOpen(true);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
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
          Credit Status Setup
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Description"
            name="description"
            size="small"
            fullWidth
            value={formData.description}
            onChange={handleInputChange}
            error={!!errors.description}
            helperText={errors.description}
          />

          <FormControl size="small" fullWidth error={!!errors.disallowInvoicing}>
            <InputLabel>Disallow Invoicing?</InputLabel>
            <Select
              name="disallowInvoicing"
              value={formData.disallowInvoicing}
              onChange={handleSelectChange}
              label="Disallow Invoicing?"
            >
              <MenuItem value="yes">Yes</MenuItem>
              <MenuItem value="no">No</MenuItem>
            </Select>
            <FormHelperText>{errors.disallowInvoicing}</FormHelperText>
          </FormControl>
        </Stack>

        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 2 : 0, }}>
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
        content="Credit Status has been updated successfully!"
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
