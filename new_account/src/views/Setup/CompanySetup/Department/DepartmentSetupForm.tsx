import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import { useEffect, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Button,
  Paper,
  FormHelperText,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import theme from "../../../../theme";
import { useAuth } from "../../../../context/AuthContext";
import {
  fetchDepartmentData,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../../../../api/departmentApi";

interface DepartmentFormData {
  selectedDepartmentId: string;
  department: string;
  description: string;
  status: string;
}

export default function DepartmentSetupForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Department setup page');
  const [formData, setFormData] = useState<DepartmentFormData>({
    selectedDepartmentId: "__new",
    department: "",
    description: "",
    status: "active",
  });

  const [errors, setErrors] = useState<Partial<DepartmentFormData>>({});
  const [availableDepartments, setAvailableDepartments] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);
  const [isNewMode, setIsNewMode] = useState(true);

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const loadDepartments = async () => {
    try {
      const data = await fetchDepartmentData();
      setAvailableDepartments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load departments", err);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleSelectDepartment = (e: SelectChangeEvent<string>) => {
    const value = e.target.value;

    if (value === "__new") {
      setIsNewMode(true);
      setFormData({
        selectedDepartmentId: "__new",
        department: "",
        description: "",
        status: "active",
      });
      return;
    }

    const selected = availableDepartments.find((d) => String(d.id) === String(value));
    if (selected) {
      setIsNewMode(false);
      setFormData({
        selectedDepartmentId: String(selected.id),
        department: selected.department || "",
        description: selected.description || "",
        status: selected.inactive ? "inactive" : "active",
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (e: SelectChangeEvent<string>) => {
    setFormData((prev) => ({ ...prev, status: e.target.value }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<DepartmentFormData> = {};
    if (!formData.department) newErrors.department = "Department name is required";
    if (!formData.status) newErrors.status = "Status is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    const payload = {
      department: formData.department,
      description: formData.description,
      inactive: formData.status !== "active",
    };

    try {
      if (isNewMode || !formData.selectedDepartmentId) {
        await createDepartment(payload);
        alert("Department created successfully");
      } else {
        await updateDepartment(formData.selectedDepartmentId, payload);
        alert("Department updated successfully");
      }
      setFormData({
        selectedDepartmentId: "__new",
        department: "",
        description: "",
        status: "active",
      });
      setIsNewMode(true);
      await loadDepartments();
    } catch (err) {
      console.error("Failed to save department", err);
      alert("Failed to save department. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!formData.selectedDepartmentId) return;
    if (!confirm("Are you sure you want to delete this department?")) return;

    setLoading(true);
    try {
      await deleteDepartment(formData.selectedDepartmentId);
      alert("Department deleted");
      setFormData({
        selectedDepartmentId: "__new",
        department: "",
        description: "",
        status: "active",
      });
      setIsNewMode(true);
      await loadDepartments();
    } catch (err) {
      console.error("Failed to delete department", err);
      alert("Failed to delete department. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormPageLayout>
      <Box sx={{ width: "100%", maxWidth: "600px", mb: 3 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Select Department</InputLabel>
          <Select
            value={formData.selectedDepartmentId}
            onChange={handleSelectDepartment}
            label="Select Department"
          >
            <MenuItem value="__new">+ Add New Department</MenuItem>
            {availableDepartments.map((d) => (
              <MenuItem key={d.id} value={String(d.id)}>
                {d.department}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Paper
        sx={{
          p: theme.spacing(3),
          maxWidth: "600px",
          width: "100%",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" sx={{ mb: 3 }}>
          Department Setup
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Department Name"
            name="department"
            size="small"
            fullWidth
            value={formData.department}
            onChange={handleChange}
            error={!!errors.department}
            helperText={errors.department}
          />

          <TextField
            label="Description"
            name="description"
            size="small"
            fullWidth
            value={formData.description}
            onChange={handleChange}
          />

          <FormControl size="small" fullWidth error={!!errors.status}>
            <InputLabel>Status</InputLabel>
            <Select
              value={formData.status}
              onChange={handleStatusChange}
              label="Status"
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
            {errors.status && <FormHelperText>{errors.status}</FormHelperText>}
          </FormControl>
        </Stack>

        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            mt: 3,
            gap: isMobile ? 2 : 0,
          }}
        >
          <Button fullWidth={isMobile} onClick={() => window.history.back()} disabled={loading}>
            Back
          </Button>

          <Box sx={{ display: "flex", gap: 1, width: isMobile ? "100%" : "auto" }}>
            {!isNewMode && formData.selectedDepartmentId && (
              <Button color="error" variant="outlined" disabled={loading} onClick={handleDelete}>
                Delete
              </Button>
            )}

            <Button
              variant="contained"
              fullWidth={isMobile}
              sx={{ backgroundColor: "var(--pallet-blue)" }}
              onClick={handleSubmit}
              disabled={loading || !canEdit}
            >
              {isNewMode ? "Insert New Department" : "Save"}
            </Button>
          </Box>
        </Box>
      </Paper>
    </FormPageLayout>
  );
}
