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
  FormHelperText,
  Button,
  Paper,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import theme from "../../../../theme";
import { getClassTypes } from "../../../../api/GLAccounts/ClassTypeApi";
import { getChartClass, updateChartClass } from "../../../../api/GLAccounts/ChartClassApi";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import ErrorModal from "../../../../components/ErrorModal";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal";
import { useAuth } from "../../../../context/AuthContext";

interface GlAccountClassData {
  cid: string;
  class_name: string;
  ctype: string;
  inactive: boolean;
}

export default function UpdateGlAccountClassesForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('GL account classes');
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<GlAccountClassData>({
    cid: "",
    class_name: "",
    ctype: "",
    inactive: false,
  });
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<Partial<GlAccountClassData>>({});
  const [classTypes, setClassTypes] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    getClassTypes().then((res) => setClassTypes(res));
    if (id) {
      getChartClass(id).then((res) => setFormData(res));
    }
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleSelectChange = (e: any) => {
    const { value } = e.target;
    setFormData({ ...formData, ctype: value });
    setErrors({ ...errors, ctype: "" });
  };

  const validate = () => {
    const newErrors: Partial<GlAccountClassData> = {};
    if (!formData.cid) newErrors.cid = "Class ID is required";
    if (!formData.class_name) newErrors.class_name = "Class name is required";
    if (formData.ctype === "") newErrors.ctype = "Select class type";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await updateChartClass(formData.cid, formData);
      await queryClient.refetchQueries({ queryKey: ["glAccountClasses"] });
      setOpen(true);
      // alert("GL Account Class updated successfully!");
      // navigate('/bankingandgeneralledger/maintenance/gl-account-classes');
    } catch (error) {
      setErrorMessage(
          error?.response?.data?.message ||
          "Failed to update GL Account Class Please try again."
        );
        setErrorOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormPageLayout>
      <Paper sx={{ p: theme.spacing(3), maxWidth: "600px", width: "100%", boxShadow: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Update GL Account Classes
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="ID"
            name="cid"
            size="small"
            fullWidth
            value={formData.cid}
            onChange={handleInputChange}
            error={!!errors.cid}
            helperText={errors.cid || " "}
          />

          <TextField
            label="Class Name"
            name="class_name"
            size="small"
            fullWidth
            value={formData.class_name}
            onChange={handleInputChange}
            error={!!errors.class_name}
            helperText={errors.class_name || " "}
          />

          <FormControl size="small" fullWidth error={!!errors.ctype}>
            <InputLabel>Class Type</InputLabel>
            <Select name="ctype" value={formData.ctype} onChange={handleSelectChange} label="Class Type">
              {classTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  {type.type_name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.ctype || " "}</FormHelperText>
          </FormControl>
        </Stack>

        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 2 : 0 }}>
          <Button onClick={() => window.history.back()}>Back</Button>
          <Button
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
            disabled={isSubmitting || !canEdit} // Disable while submitting
          >
            {isSubmitting ? "Updating..." : "Update"}
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="GL Account class has been updated successfully!"
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