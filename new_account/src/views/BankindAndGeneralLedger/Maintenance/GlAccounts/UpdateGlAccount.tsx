import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
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
  useTheme,
  useMediaQuery,
  CircularProgress,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { SelectChangeEvent } from "@mui/material";
import {
  getChartMaster,
  updateChartMaster,
  deleteChartMaster,
} from "../../../../api/GLAccounts/ChartMasterApi";
import { getChartTypes } from "../../../../api/GLAccounts/ChartTypeApi";
import { getAccountTags } from "../../../../api/AccountTag/AccountTagsApi";
import theme from "../../../../theme";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal"; //  Added import

interface GlAccountFormData {
  accountCode: string;
  accountCode2: string;
  accountName: string;
  accountGroup: string;
  accountTags: string;
  accountStatus: string;
}

export default function UpdateGlAccount() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('GL accounts edition');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false); //  Added
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<GlAccountFormData>({
    accountCode: "",
    accountCode2: "",
    accountName: "",
    accountGroup: "",
    accountTags: "",
    accountStatus: "",
  });

  const [errors, setErrors] = useState<Partial<GlAccountFormData>>({});
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const navigate = useNavigate();

  // Fetch GL Account + dropdown data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [account, groupData, tagData] = await Promise.all([
          getChartMaster(id!),
          getChartTypes(),
          getAccountTags(),
        ]);

        setFormData({
          accountCode: account.account_code || "",
          accountCode2: account.account_code2 || "",
          accountName: account.account_name || "",
          accountGroup: account.account_type || "",
          accountTags: account.account_tags || "",
          accountStatus: account.inactive === 0 ? "active" : "inactive",
        });
        setGroups(groupData);
        setTags(tagData);
      } catch (error) {
        console.error("Error loading GL Account data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<GlAccountFormData> = {};
    if (!formData.accountCode) newErrors.accountCode = "Account Code is required";
    if (!formData.accountCode2) newErrors.accountCode2 = "Account Code 2 is required";
    if (!formData.accountName) newErrors.accountName = "Account Name is required";
    if (!formData.accountGroup) newErrors.accountGroup = "Account Group is required";
    if (!formData.accountTags) newErrors.accountTags = "Account Tags are required";
    if (!formData.accountStatus) newErrors.accountStatus = "Account Status is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const payload = {
        account_code: formData.accountCode,
        account_code2: formData.accountCode2,
        account_name: formData.accountName,
        account_type: formData.accountGroup,
        account_tags: formData.accountTags,
        inactive: formData.accountStatus === "inactive" ? 1 : 0,
      };

      const response = await updateChartMaster(id, payload);
      console.log(" Backend response:", response);
      setOpen(true);
    } catch (error: any) {
      console.error(" Update failed:", error);
      if (error.response?.status === 422) {
        const validationErrors = error.response.data.errors;
        setErrors((prev) => ({ ...prev, ...validationErrors }));
      } else {
        setErrorMessage("Failed to update GL Account. Please try again.");
        setErrorOpen(true);
      }
    }
  };

  //  Updated delete logic (no window.confirm)
  const handleDelete = async () => {
    try {
      await deleteChartMaster(id);
      navigate("/bankingandgeneralledger/maintenance/");
    } catch (error: any) {
      console.error(" Delete failed:", error);
      setErrorMessage("Failed to delete GL Account. Please try again.");
      setErrorOpen(true);
    } finally {
      setOpenDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ mt: 10 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading GL Account data...</Typography>
      </Stack>
    );
  }

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
          Update GL Account
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Account Code"
            name="accountCode"
            size="small"
            fullWidth
            value={formData.accountCode}
            onChange={handleInputChange}
            error={!!errors.accountCode}
            helperText={errors.accountCode}
            disabled
          />

          <TextField
            label="Account Code 2"
            name="accountCode2"
            size="small"
            fullWidth
            value={formData.accountCode2}
            onChange={handleInputChange}
            error={!!errors.accountCode2}
            helperText={errors.accountCode2}
          />

          <TextField
            label="Account Name"
            name="accountName"
            size="small"
            fullWidth
            value={formData.accountName}
            onChange={handleInputChange}
            error={!!errors.accountName}
            helperText={errors.accountName}
          />

          <FormControl size="small" fullWidth error={!!errors.accountGroup}>
            <InputLabel>Account Group</InputLabel>
            <Select
              name="accountGroup"
              value={formData.accountGroup}
              onChange={handleSelectChange}
              label="Account Group"
            >
              {groups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.accountGroup}</FormHelperText>
          </FormControl>

          <FormControl size="small" fullWidth error={!!errors.accountTags}>
            <InputLabel>Account Tags</InputLabel>
            <Select
              name="accountTags"
              value={formData.accountTags}
              onChange={handleSelectChange}
              label="Account Tags"
            >
              {tags.map((tag) => (
                <MenuItem key={tag.id} value={tag.id}>
                  {tag.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.accountTags}</FormHelperText>
          </FormControl>

          <FormControl size="small" fullWidth error={!!errors.accountStatus}>
            <InputLabel>Account Status</InputLabel>
            <Select
              name="accountStatus"
              value={formData.accountStatus}
              onChange={handleSelectChange}
              label="Account Status"
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
            <FormHelperText>{errors.accountStatus}</FormHelperText>
          </FormControl>
        </Stack>

        <Box
          sx={{
            display: "flex",
            justifyContent: isMobile ? "center" : "space-between",
            mt: 3,
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 2 : 1,
          }}
        >
          {/* Left-side buttons */}
          <Stack direction={isMobile ? "column" : "row"} spacing={1} sx={{ flexGrow: 1 }}>
            <Button
              variant="outlined"
              size="medium"
              onClick={() => navigate("/bankingandgeneralledger/maintenance/")}
            >
              Back
            </Button>

            <Button
              variant="outlined"
              color="error"
              size="medium"
              onClick={() => setOpenDeleteModal(true)} //  open modal
            >
              Delete
            </Button>
          </Stack>

          {/* Right-side update button */}
          <Button disabled={!canEdit}
            variant="contained"
            size="large"
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            Update GL Account
          </Button>
        </Box>
      </Paper>
      {/*  Success modal */}
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="GL Account has been updated successfully!"
        handleClose={() => setOpen(false)}
        onSuccess={() => window.history.back()}
      />
      {/*  Error modal */}
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
      {/* Delete confirmation modal */}
      <DeleteConfirmationModal
        open={openDeleteModal}
        title="Delete GL Account"
        content="Are you sure you want to delete this GL Account? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setOpenDeleteModal(false)}
        deleteFunc={handleDelete}
        onSuccess={() => console.log("GL Account deleted successfully!")}
      />
    </FormPageLayout>
  );
}
