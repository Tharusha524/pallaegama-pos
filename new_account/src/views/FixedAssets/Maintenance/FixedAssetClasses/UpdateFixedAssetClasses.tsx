import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Paper,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import theme from "../../../../theme";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getStockFaClass, updateStockFaClass } from "../../../../api/StockFaClass/StockFaClassesApi";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

interface FixedAssetClassForm {
  parentClass: string;
  assetClass: string;
  description: string;
  longDescription: string;
  depreciationRate: string;
}

export default function UpdateFixedAssetClasses() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Fixed Asset classes');
  const navigate = useNavigate();
  const { fa_class_id: faClassId } = useParams();
  const queryClient = useQueryClient();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState<FixedAssetClassForm>({
    parentClass: "",
    assetClass: "",
    description: "",
    longDescription: "",
    depreciationRate: "",
  });

  const [errors, setErrors] = useState<Partial<FixedAssetClassForm>>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!faClassId) return;
      try {
        const response = await getStockFaClass(faClassId);
        const data = Array.isArray(response) ? response.find(d => d.fa_class_id === faClassId) || response[0] : response;
        setFormData({
          parentClass: data.parent_id || "",
          assetClass: data.fa_class_id,
          description: data.description,
          longDescription: data.long_description || "",
          depreciationRate: data.depreciation_rate?.toString() || "",
        });
      } catch (err) {
        console.error("Failed to load asset class", err);
      }
    };

    fetchData();
  }, [faClassId]);

  const handleInputChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<FixedAssetClassForm> = {};

    if (!formData.assetClass.trim()) newErrors.assetClass = "Fixed asset class is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";
    if (!formData.depreciationRate.trim()) newErrors.depreciationRate = "Enter a depreciation rate";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !faClassId) return;

    const payload = {
      fa_class_id: formData.assetClass,
      parent_id: formData.parentClass || null,
      description: formData.description,
      long_description: formData.longDescription,
      depreciation_rate: Number(formData.depreciationRate),
      inactive: false, // Assuming not updating inactive here
    };

    try {
      await updateStockFaClass(faClassId, payload);
      // alert("Fixed Asset Class updated successfully!");

      queryClient.invalidateQueries({ queryKey: ["stockFaClasses"], exact: false });
      setOpen(true);
      // navigate("/fixedassets/maintenance/fixed-asset-classes");
    } catch (err) {
      console.error("Update failed", err);
      //  alert("Failed to update Fixed Asset Class.");
      setErrorOpen(true);
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
          Update Fixed Asset Class
        </Typography>

        <Stack spacing={2}>
          {/* Parent Class */}
          <TextField
            label="Parent Class"
            name="parentClass"
            value={formData.parentClass}
            onChange={handleInputChange}
            error={!!errors.parentClass}
            helperText={errors.parentClass}
            size="small"
            fullWidth
            InputProps={{
              readOnly: true,
            }}
          />

          {/* Fixed Asset Class */}
          <TextField
            label="Fixed Asset Class"
            name="assetClass"
            size="small"
            fullWidth
            value={formData.assetClass}
            onChange={handleInputChange}
            error={!!errors.assetClass}
            helperText={errors.assetClass || " "}
            InputProps={{
              readOnly: true,
            }}
          />

          {/* Description */}
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

          {/* Long Description */}
          <TextField
            label="Long Description"
            name="longDescription"
            size="small"
            fullWidth
            multiline
            minRows={3}
            value={formData.longDescription}
            onChange={handleInputChange}
          />

          {/* Depreciation Rate */}
          <FormattedNumberField
            label="Basic Depreciation Rate (%)"
            name="depreciationRate"
            size="small"
            fullWidth
            value={formData.depreciationRate}
            onChange={handleInputChange}
            error={!!errors.depreciationRate}
            helperText={errors.depreciationRate || " "}
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
            Update Fixed Asset Class
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Fixed Asset Class has been updated successfully!"
        handleClose={() => setOpen(false)}
        onSuccess={() => {
          // Form was already cleared on successful update
          window.history.back();
        }}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}
