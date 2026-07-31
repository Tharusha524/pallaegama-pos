import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
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
  FormHelperText,
  SelectChangeEvent,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import theme from "../../../../theme";
import { getUser, updateUser } from "../../../../api/UserManagement/userManagement";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import UserPasswordFields from "../../../../components/UserPasswordFields";
import PermissionsChecklist from "../../../../components/PermissionsChecklist";
import { validatePassword } from "../../../../utils/passwordPolicy";
import { useAuth } from "../../../../context/AuthContext";

interface UserFormData {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  epf: string;
  telephone: string;
  address: string;
  email: string;
  password: string;
  confirmPassword: string;
  status: string;
}


export default function UpdateUserForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Users setup');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState<UserFormData>({
    id: "",
    firstName: "",
    lastName: "",
    department: "",
    epf: "",
    telephone: "",
    address: "",
    email: "",
    password: "",
    confirmPassword: "",
    status: "",
  });

  const [errors, setErrors] = useState<Partial<UserFormData>>({});
  const [permissionIds, setPermissionIds] = useState<number[]>([]);
  const [editPermissionIds, setEditPermissionIds] = useState<number[]>([]);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const queryClient = useQueryClient();
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  useEffect(() => {
    if (id) {
      getUser(id).then(user => {
        setFormData({
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          department: user.department || "",
          epf: user.epf,
          telephone: user.telephone || "",
          address: user.address || "",
          email: user.email,
          password: "",
          confirmPassword: "",
          // status: prefer status string, fallback to inactive boolean
          status:
            user.status ??
            (typeof user.inactive === "boolean"
              ? user.inactive
                ? "inactive"
                : "active"
              : ""),
        });

        const parseIds = (value: unknown) =>
          (value ? String(value).split(";") : [])
            .map((s: string) => Number(s))
            .filter((n: number) => !Number.isNaN(n));

        // sections = pages the user can View; areas = the subset of those
        // pages the user can also Edit (add/modify/delete).
        setPermissionIds(parseIds(user.sections));
        setEditPermissionIds(parseIds(user.areas));
      });
    }
  }, [id]);

  const handlePermissionToggle = (permId: number) => {
    setPermissionIds((prev) => {
      const next = prev.includes(permId)
        ? prev.filter((p) => p !== permId)
        : [...prev, permId];

      // Revoking View also revokes Edit for that page.
      if (!next.includes(permId)) {
        setEditPermissionIds((editPrev) => editPrev.filter((p) => p !== permId));
      }
      return next;
    });
  };

  const handleEditPermissionToggle = (permId: number) => {
    if (!permissionIds.includes(permId)) return; // Edit requires View
    setEditPermissionIds((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };


  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const validate = () => {
    const newErrors: Partial<UserFormData> = {};

    if (!formData.id) newErrors.id = "ID is required";
    if (!formData.firstName) newErrors.firstName = "First name is required";
    if (!formData.lastName) newErrors.lastName = "Last name is required";
    if (!formData.department) newErrors.department = "Department is required";
    if (!formData.epf) newErrors.epf = "Employee Number is required";
    if (!formData.telephone) newErrors.telephone = "Telephone is required";
    if (!formData.address) newErrors.address = "Address is required";
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    if (formData.password || formData.confirmPassword) {
      const passwordError = validatePassword(formData.password, { required: true });
      if (passwordError) newErrors.password = passwordError;

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = "Please confirm the new password";
      } else if (formData.confirmPassword !== formData.password) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }
    if (!formData.status) newErrors.status = "Status is required";

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate()) {
      try {
        const payload: Record<string, string> = {
          first_name: formData.firstName,
          last_name: formData.lastName,
          department: formData.department,
          epf: formData.epf,
          telephone: formData.telephone,
          address: formData.address,
          email: formData.email,
          status: formData.status,
        };

        payload.sections = permissionIds.join(";");
        payload.areas = editPermissionIds.join(";");

        if (formData.password) {
          payload.password = formData.password;
        }

        if (!formData.id) {
          // alert("User ID is required to update.");
          return;
        }

        const updatedUser = await updateUser(formData.id, payload);
        console.log("User updated:", updatedUser);
        setOpen(true);
        queryClient.invalidateQueries({ queryKey: ["users"] });
        queryClient.refetchQueries({ queryKey: ["users"] });
      } catch (err: any) {
        console.error("Error updating user:", err);
        setErrorMessage(
          err?.response?.data?.message ||
          "Failed to update user Please try again."
        );
        setErrorOpen(true);
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
          User Setup
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="ID"
            name="id"
            size="small"
            fullWidth
            value={formData.id}
            onChange={handleInputChange}
            error={!!errors.id}
            helperText={errors.id}
          />

          <TextField
            label="First Name"
            name="firstName"
            size="small"
            fullWidth
            value={formData.firstName}
            onChange={handleInputChange}
            error={!!errors.firstName}
            helperText={errors.firstName}
          />

          <TextField
            label="Last Name"
            name="lastName"
            size="small"
            fullWidth
            value={formData.lastName}
            onChange={handleInputChange}
            error={!!errors.lastName}
            helperText={errors.lastName}
          />

          <TextField
            label="Department"
            name="department"
            size="small"
            fullWidth
            value={formData.department}
            onChange={handleInputChange}
            error={!!errors.department}
            helperText={errors.department}
          />

          <TextField
            label="Employee Number"
            name="epf"
            size="small"
            fullWidth
            value={formData.epf}
            onChange={handleInputChange}
            error={!!errors.epf}
            helperText={errors.epf}
          />

          <TextField
            label="Telephone Number"
            name="telephone"
            size="small"
            fullWidth
            value={formData.telephone}
            onChange={handleInputChange}
            error={!!errors.telephone}
            helperText={errors.telephone}
          />

          <TextField
            label="Address"
            name="address"
            size="small"
            fullWidth
            value={formData.address}
            onChange={handleInputChange}
            error={!!errors.address}
            helperText={errors.address}
          />

          <TextField
            label="Email"
            name="email"
            size="small"
            fullWidth
            value={formData.email}
            onChange={handleInputChange}
            error={!!errors.email}
            helperText={errors.email}
          />

          <UserPasswordFields
            password={formData.password}
            confirmPassword={formData.confirmPassword}
            onPasswordChange={(value) =>
              setFormData((prev) => ({ ...prev, password: value }))
            }
            onConfirmPasswordChange={(value) =>
              setFormData((prev) => ({ ...prev, confirmPassword: value }))
            }
            passwordError={errors.password}
            confirmPasswordError={errors.confirmPassword}
            required={false}
            hasExistingPassword
            optionalHint="Leave new password blank to keep the current one. Enter a new password only if you want to change it."
          />

          <FormControl size="small" fullWidth error={!!errors.status}>
            <InputLabel>Status</InputLabel>
            <Select
              name="status"
              value={formData.status}
              onChange={handleSelectChange}
              label="Status"
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
            <FormHelperText>{errors.status}</FormHelperText>
          </FormControl>

          <PermissionsChecklist
            selectedIds={permissionIds}
            onToggle={handlePermissionToggle}
            editIds={editPermissionIds}
            onToggleEdit={handleEditPermissionToggle}
            title="Individual Access (overrides Role permissions when set)"
          />
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
        content={
          formData.password
            ? "Password updated successfully. The user must sign in again with the new password."
            : "User has been updated successfully!"
        }
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