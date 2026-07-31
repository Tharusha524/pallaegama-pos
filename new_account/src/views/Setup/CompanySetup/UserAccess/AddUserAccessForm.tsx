import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import { useEffect, useState } from "react";
import {
  Box,
  Stack,
  Typography,
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
import {
  getUsers,
  getUser,
  updateUser,
} from "../../../../api/UserManagement/userManagement";
import PermissionsChecklist from "../../../../components/PermissionsChecklist";
import { useAuth } from "../../../../context/AuthContext";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";

export default function AddUserAccessForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Access levels edition');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [permissionIds, setPermissionIds] = useState<number[]>([]);
  const [editPermissionIds, setEditPermissionIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getUsers();
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load users", err);
      }
    };

    load();
  }, []);

  const handleUserChange = async (e: SelectChangeEvent<string>) => {
    const id = e.target.value;
    setSelectedUserId(id);
    setError("");

    if (!id) {
      setPermissionIds([]);
      setEditPermissionIds([]);
      return;
    }

    setLoading(true);
    try {
      const user = await getUser(id);
      const parseIds = (value: unknown) =>
        (value ? String(value).split(";") : [])
          .map((s: string) => Number(s))
          .filter((n: number) => !Number.isNaN(n));

      // sections = pages the user can View; areas = the subset of those
      // pages the user can also Edit (add/modify/delete).
      setPermissionIds(parseIds(user.sections));
      setEditPermissionIds(parseIds(user.areas));
    } catch (err) {
      console.error("Failed to load user permissions", err);
      setError("Failed to load permissions for this user");
    } finally {
      setLoading(false);
    }
  };

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

  const handleSubmit = async () => {
    if (!selectedUserId) {
      setError("Please select a user");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateUser(selectedUserId, {
        sections: permissionIds.join(";"),
        areas: editPermissionIds.join(";"),
      });

      setOpen(true);
    } catch (err) {
      console.error("Failed to update user access", err);
      setErrorMessage("Failed to update user access. Please try again.");
      setErrorOpen(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormPageLayout>
      <Box sx={{ width: "100%", maxWidth: "600px", mb: 3 }}>
        <FormControl fullWidth size="small" error={!!error && !selectedUserId}>
          <InputLabel>Select User</InputLabel>
          <Select
            value={selectedUserId}
            onChange={handleUserChange}
            label="Select User"
          >
            {users.map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                {`${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email}
                {u.email ? ` (${u.email})` : ""}
              </MenuItem>
            ))}
          </Select>
          {!selectedUserId && error && <FormHelperText>{error}</FormHelperText>}
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
          User Access
        </Typography>

        <Stack spacing={2}>
          <PermissionsChecklist
            selectedIds={permissionIds}
            onToggle={handlePermissionToggle}
            editIds={editPermissionIds}
            onToggleEdit={handleEditPermissionToggle}
            error={selectedUserId ? error : undefined}
          />
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
          <Button fullWidth={isMobile} onClick={() => window.history.back()} disabled={saving}>
            Back
          </Button>

          <Button
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
            disabled={saving || loading || !selectedUserId || !canEdit}
          >
            Save
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="User access has been updated successfully!"
        handleClose={() => setOpen(false)}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}
