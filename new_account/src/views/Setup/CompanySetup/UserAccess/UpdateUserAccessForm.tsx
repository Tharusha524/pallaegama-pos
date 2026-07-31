import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Paper,
  Checkbox,
  FormGroup,
  FormControlLabel,
  FormHelperText,
} from "@mui/material";
import theme from "../../../../theme";
import { useAuth } from "../../../../context/AuthContext";

const permissionList = [
  "System Administration",
  "Company Setup",
  "Special Maintenance",
  "Sales Configuration",
  "Sales Transactions",
  "Sales Related Reports",
  "Purchase Configuration",
  "Purchase Transactions",
  "Purchase Analytics",
  "Inventory Configuration",
  "Inventory Operations",
  "Inventory Analytics",
  "Fixed Assets Configuration",
  "Fixed Assets Operations",
  "Fixed Assets Analytics",
  "Manufacturing Configuration",
  "Manufacturing Transactions",
  "Manufacturing Analytics",
  "CostCenters Configuration",
  "CostCenters",
  "Banking & GL Configuration",
  "Banking & GL Transactions",
  "Banking & GL Analytics",
];

const systemAdminNested = [
  "Install/Update Companies",
  "Install/Update Languages",
  "Install/Update Modules",
  "Software Upgrades",
];

interface UserAccessFormData {
  selectedRole: string;
  roleName: string;
  roleDescription: string;
  status: string;
  permissions: string[];
}

export default function UpdateUserAccessForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Access levels edition');
  const [formData, setFormData] = useState<UserAccessFormData>({
    selectedRole: "",
    roleName: "",
    roleDescription: "",
    status: "",
    permissions: [],
  });

  const [errors, setErrors] = useState<Partial<UserAccessFormData>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePermissionChange = (permission: string) => {
    setFormData((prev) => {
      const newPermissions = prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission];

      let filteredPermissions = newPermissions;
      if (
        permission === "System Administration" &&
        !newPermissions.includes("System Administration")
      ) {
        filteredPermissions = newPermissions.filter(
          (p) => !systemAdminNested.includes(p)
        );
      }

      return { ...prev, permissions: filteredPermissions };
    });
  };

  const handleNestedPermissionChange = (nestedPermission: string) => {
    setFormData((prev) => {
      const newPermissions = prev.permissions.includes(nestedPermission)
        ? prev.permissions.filter((p) => p !== nestedPermission)
        : [...prev.permissions, nestedPermission];
      return { ...prev, permissions: newPermissions };
    });
  };

  const validate = (): boolean => {
    const newErrors: Partial<UserAccessFormData> = {};

    if (!formData.roleName) newErrors.roleName = "Role Name is required";
    if (!formData.roleDescription)
      newErrors.roleDescription = "Role Description is required";
    if (!formData.status) newErrors.status = "Status is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      console.log("Submitted Data:", formData);
      alert("Form submitted successfully!");
    }
  };

  return (
    <FormPageLayout>
      {/* Dropdown to select existing roles */}
      <Box sx={{ width: "100%", maxWidth: "600px", mb: 3 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Select Role</InputLabel>
          <Select
            name="selectedRole"
            value={formData.selectedRole}
            onChange={handleChange}
            label="Select Role"
          >
            <MenuItem value="">-- Select Role --</MenuItem>
            <MenuItem value="Admin">AP Officer</MenuItem>
            <MenuItem value="Manager">AR Officer</MenuItem>
            <MenuItem value="Employee">Inquiries</MenuItem>
            <MenuItem value="Admin">Accountant</MenuItem>
            <MenuItem value="Manager">Production Manager</MenuItem>
            <MenuItem value="Employee">Purchase Officer</MenuItem>
            <MenuItem value="Admin">Salesman</MenuItem>
            <MenuItem value="Manager">Stock Manager</MenuItem>
            <MenuItem value="Employee">Sub Admin</MenuItem>
            <MenuItem value="Employee">System Adminitrator</MenuItem>
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
          Role Setup
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Role Name"
            name="roleName"
            size="small"
            fullWidth
            value={formData.roleName}
            onChange={handleChange}
            error={!!errors.roleName}
            helperText={errors.roleName}
          />

          <TextField
            label="Role Description"
            name="roleDescription"
            size="small"
            fullWidth
            value={formData.roleDescription}
            onChange={handleChange}
            error={!!errors.roleDescription}
            helperText={errors.roleDescription}
          />

          <FormControl size="small" fullWidth error={!!errors.status}>
            <InputLabel>Status</InputLabel>
            <Select
              name="status"
              value={formData.status}
              onChange={handleChange}
              label="Status"
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
            {errors.status && <FormHelperText>{errors.status}</FormHelperText>}
          </FormControl>

          <Box>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, fontWeight: 600 }}
            >
              Permissions
            </Typography>
            <FormGroup>
              {permissionList.map((perm) => (
                <Box key={perm}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.permissions.includes(perm)}
                        onChange={() => handlePermissionChange(perm)}
                      />
                    }
                    label={perm}
                  />

                  {perm === "System Administration" &&
                    formData.permissions.includes("System Administration") && (
                      <Box sx={{ pl: 4 }}>
                        {systemAdminNested.map((nested) => (
                          <FormControlLabel
                            key={nested}
                            control={
                              <Checkbox
                                checked={formData.permissions.includes(nested)}
                                onChange={() => handleNestedPermissionChange(nested)}
                              />
                            }
                            label={nested}
                          />
                        ))}
                      </Box>
                    )}
                </Box>
              ))}
            </FormGroup>
            {errors.permissions && (
              <FormHelperText sx={{ color: "red" }}>
                {errors.permissions}
              </FormHelperText>
            )}
          </Box>
        </Stack>

        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3 }}>
          <Button onClick={() => window.history.back()}>Back</Button>

          <Button disabled={!canEdit}
            variant="contained"
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            Insert New Role
          </Button>
        </Box>
      </Paper>
    </FormPageLayout>
  );
}
