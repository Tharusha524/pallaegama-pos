import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState } from "react";
import { useAuth } from "../../../../context/AuthContext";
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

interface UpdateDocumentsData {
  transaction: string;
  title: string;
  file: File | null;
}

export default function UpdateDocumentsForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Attaching documents');
  const [formData, setFormData] = useState<UpdateDocumentsData>({
    transaction: "",
    title: "",
    file: null,
  });

  const [errors, setErrors] = useState<
    Partial<Record<keyof UpdateDocumentsData, string>>
  >({});

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFormData({ ...formData, file: e.target.files[0] });
      setErrors({ ...errors, file: "" });
    }
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof UpdateDocumentsData, string>> = {};
    if (!formData.transaction.trim())
      newErrors.transaction = "Transaction # is required";
    if (!formData.title.trim()) newErrors.title = "Document title is required";
    if (!formData.file) newErrors.file = "Attached file is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      console.log("Document updated:", formData);
      alert("Document updated successfully!");

      // Example API call with FormData
      // const data = new FormData();
      // data.append("transaction", formData.transaction);
      // data.append("title", formData.title);
      // if (formData.file) data.append("file", formData.file);
      // axios.post("/api/documents", data);
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
          Update Document
        </Typography>

        <Stack spacing={2}>
          {/* Transaction Dropdown */}
          <FormControl size="small" fullWidth error={!!errors.transaction}>
            <InputLabel>Transaction #</InputLabel>
            <Select
              name="transaction"
              value={formData.transaction}
              onChange={handleSelectChange}
              label="Transaction #"
            >
              <MenuItem value="">-- Select Transaction --</MenuItem>
              <MenuItem value="invoice001">Invoice #001</MenuItem>
              <MenuItem value="invoice002">Invoice #002</MenuItem>
              <MenuItem value="payment101">Payment #101</MenuItem>
            </Select>
            {errors.transaction && (
              <FormHelperText>{errors.transaction}</FormHelperText>
            )}
          </FormControl>

          {/* Document Title */}
          <TextField
            label="Document Title"
            name="title"
            size="small"
            fullWidth
            value={formData.title}
            onChange={handleInputChange}
            error={!!errors.title}
            helperText={errors.title}
          />

          {/* File Upload */}
          <Button variant="outlined" component="label">
            Choose File
            <input
              type="file"
              hidden
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.png"
            />
          </Button>
          {formData.file && (
            <Typography variant="body2" color="text.secondary">
              Selected: {formData.file.name}
            </Typography>
          )}
          {errors.file && (
            <Typography variant="body2" color="error">
              {errors.file}
            </Typography>
          )}
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
