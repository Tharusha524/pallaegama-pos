import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState } from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  useTheme,
  useMediaQuery,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import { getTags } from "../../../../api/CostCenterTag/CostCenterTagApi";
import { createCostCenter, getCostCenters } from "../../../../api/CostCenter/CostCenterApi";
import { useAuth } from "../../../../context/AuthContext";

interface CostCenterFormData {
  costCenterReference: string;
  name: string;
  type: string;
  startDate: string;
  dateRequiredBy: string;
  tags: string;
  memo: string;
}

function CostCenterEntry() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('CostCenter entry');
  const navigate = useNavigate();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const [formData, setFormData] = useState<CostCenterFormData>({
    costCenterReference: "",
    name: "",
    type: "1",
    startDate: new Date().toISOString().split("T")[0],
    dateRequiredBy: "",
    tags: "",
    memo: "",
  });
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: tags = [] } = useQuery({ queryKey: ["costCenterTags"], queryFn: getTags });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSelectChange = (e: { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async () => {
    if (!formData.costCenterReference.trim() || !formData.name.trim()) {
      setSaveError("Reference and name are required.");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    try {
      const existing = await getCostCenters();
      const duplicate = existing.some(
        (d) => String(d.reference).toLowerCase() === formData.costCenterReference.trim().toLowerCase()
      );
      if (duplicate) {
        setSaveError("A costCenter with this reference already exists.");
        return;
      }

      await createCostCenter({
        reference: formData.costCenterReference.trim(),
        name: formData.name.trim(),
        type: Number(formData.type) || 1,
        start_date: formData.startDate || undefined,
        date_required_by: formData.dateRequiredBy || undefined,
        tag_id: formData.tags ? Number(formData.tags) : null,
        memo: formData.memo || undefined,
        closed: false,
      });

      navigate("/costCenter/transactions/costCenter-entry/success", {
        state: { reference: formData.costCenterReference },
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      setSaveError(err?.message || "Failed to save costCenter.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormPageLayout>
      <Box
        sx={{
          padding: theme.spacing(2),
          boxShadow: 2,
          marginY: 2,
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <PageTitle title="CostCenter Entry" />
          <Breadcrumb
            breadcrumbs={[
              { title: "Home", href: "/dashboard" },
              { title: "CostCenters", href: "/costCenter/transactions" },
              { title: "CostCenter Entry" },
            ]}
          />
        </Box>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Box>
      <Stack alignItems="center" sx={{ mt: 4, px: isMobile ? 2 : 0 }}>
        <Paper sx={{ p: theme.spacing(3), maxWidth: "600px", width: "100%", boxShadow: 2, borderRadius: 2 }}>
          {saveError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {saveError}
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField
              label="CostCenter Reference"
              name="costCenterReference"
              size="small"
              fullWidth
              required
              value={formData.costCenterReference}
              onChange={handleInputChange}
            />
            <TextField
              label="Name"
              name="name"
              size="small"
              fullWidth
              required
              value={formData.name}
              onChange={handleInputChange}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Type</InputLabel>
              <Select name="type" value={formData.type} onChange={handleSelectChange} label="Type">
                <MenuItem value="1">CostCenter 1</MenuItem>
                <MenuItem value="2">CostCenter 2</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Start Date"
              name="startDate"
              type="date"
              size="small"
              fullWidth
              value={formData.startDate}
              onChange={handleInputChange}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Date required by"
              name="dateRequiredBy"
              type="date"
              size="small"
              fullWidth
              value={formData.dateRequiredBy}
              onChange={handleInputChange}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Tag</InputLabel>
              <Select name="tags" value={formData.tags} onChange={handleSelectChange} label="Tag">
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {tags.map((tag: { id: number; tagName: string }) => (
                  <MenuItem key={tag.id} value={String(tag.id)}>
                    {tag.tagName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
            <Button
              variant="contained"
              disabled={isSaving || !canEdit}
              sx={{ backgroundColor: "var(--pallet-blue)" }}
              onClick={handleSubmit}
            >
              {isSaving ? "Saving…" : "Add New"}
            </Button>
          </Box>
        </Paper>
      </Stack>
    </FormPageLayout>
  );
}

export default CostCenterEntry;
