import { FormPageLayout } from "../../../../../components/Layout/FormPageLayout";
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
import DatePickerComponent from "../../../../../components/DatePickerComponent";
import { createEntityAttachment } from "../../../../../api/Attachments/AttachmentsApi";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import ErrorModal from "../../../../../components/ErrorModal";
import SuccessModal from "../../../../../components/SuccessModal";
import { useAuth } from "../../../../../context/AuthContext";

interface AddAttachmentsData {
  customerId: string;
  docDate: Date | null;
  docTitle: string;
  file: File | null;
}

export default function AddAttachmentsForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales customer and branches changes');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<AddAttachmentsData>({
    customerId: "",
    docDate: null,
    docTitle: "",
    file: null,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof AddAttachmentsData, string>>>({});

  const handleDateChange = (date: Date | null) => {
    setFormData({ ...formData, docDate: date });
    setErrors({ ...errors, docDate: "" });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, file: e.target.files[0] });
      setErrors({ ...errors, file: "" });
    }
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof AddAttachmentsData, string>> = {};
    if (!formData.customerId.trim()) newErrors.customerId = "Customer ID is required";
    if (!formData.docDate) newErrors.docDate = "Document Date is required";
    if (!formData.docTitle.trim()) newErrors.docTitle = "Document Title is required";
    if (!formData.file) newErrors.file = "File is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate()) {
      setIsLoading(true);
      try {
        const formDataObj = new FormData();
        formDataObj.append("entity_type", "customer");
        formDataObj.append("entity_id", formData.customerId);
        formDataObj.append("doc_title", formData.docTitle);
        formDataObj.append("doc_date", formData.docDate?.toISOString().split("T")[0] || "");
        if (formData.file) {
          formDataObj.append("file", formData.file);
        }

        await createEntityAttachment(formDataObj);
        queryClient.invalidateQueries({ queryKey: ["attachments", formData.customerId] });
        setOpen(true);
      } catch (error: any) {
        setErrorMessage(
          error?.message ||
          error?.response?.data?.message ||
          "Failed to add attachment. Please try again."
        );
        setErrorOpen(true);
        console.error("Error adding attachment:", error);
      } finally {
        setIsLoading(false);
      }
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
          Add Attachment
        </Typography>

        <Stack spacing={2}>
          {/* Customer ID */}
          <TextField
            label="Customer ID"
            name="customerId"
            size="small"
            fullWidth
            value={formData.customerId}
            onChange={handleInputChange}
            error={!!errors.customerId}
            helperText={errors.customerId || " "}
          />

          {/* Document Date */}
          <DatePickerComponent
            value={formData.docDate}
            onChange={handleDateChange}
            label="Document Date"
            error={errors.docDate}
            disableFuture
          />

          {/* Document Title */}
          <TextField
            label="Document Title"
            name="docTitle"
            size="small"
            fullWidth
            value={formData.docTitle}
            onChange={handleInputChange}
            error={!!errors.docTitle}
            helperText={errors.docTitle || " "}
          />

          {/* File Upload */}
          <Button
            variant="outlined"
            component="label"
          >
            Choose File
            <input
              type="file"
              hidden
              onChange={handleFileChange}
            />
          </Button>
          {errors.file && (
            <Typography variant="caption" color="error">
              {errors.file}
            </Typography>
          )}
          {formData.file && (
            <Typography variant="body2">
              Selected File: {formData.file.name}
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

          <Button
            variant="contained"
            fullWidth={isMobile}
            disabled={isLoading || !canEdit}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            {isLoading ? "Adding..." : "Add New"}
          </Button>
        </Box>
      </Paper>
      {/* Success Modal */}
      <SuccessModal
        open={open}
        onClose={() => {
          setOpen(false);
          navigate(-1);
        }}
        message="Attachment added successfully!"
      />
      {/* Error Modal */}
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}
