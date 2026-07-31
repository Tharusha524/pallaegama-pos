import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
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
import { getLocation, updateLocation } from "../../../../api/FixedAssetsLocation/FixedAssetsLocationApi";
import { useParams, useNavigate } from "react-router-dom";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal"
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

interface FixedAssetsLocationData {
  locationCode: string;
  locationName: string;
  contact: string;
  address: string;
  phone: string;
  secondaryPhone: string;
  fax: string;
  email: string;
}

export default function UpdateFixedAssetsLocations() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Fixed assets locations maintenance');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState<FixedAssetsLocationData>({
    locationCode: "",
    locationName: "",
    contact: "",
    address: "",
    phone: "",
    secondaryPhone: "",
    fax: "",
    email: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FixedAssetsLocationData, string>>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      loadLocation(id);
    }
  }, [id]);

  const loadLocation = async (id: string) => {
    try {
      const data = await getLocation(id);
      setFormData(data);
    } catch (error) {
      console.error("Failed to fetch location", error);
    }
  };

  const handleChange = (field: keyof FixedAssetsLocationData, value: string) => {
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: "" });
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof FixedAssetsLocationData, string>> = {};
    const phoneRegex = /^[0-9]{10}$/;
    const faxRegex = /^[0-9]{6,15}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.locationCode.trim()) newErrors.locationCode = "Location Code is required";
    if (!formData.locationName.trim()) newErrors.locationName = "Location Name is required";
    if (!formData.contact.trim()) newErrors.contact = "Contact for Deliveries is required";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (!formData.phone.trim()) newErrors.phone = "Telephone Number is required";
    else if (!phoneRegex.test(formData.phone)) newErrors.phone = "Enter a valid 10-digit number";
    if (formData.secondaryPhone && !phoneRegex.test(formData.secondaryPhone))
      newErrors.secondaryPhone = "Enter a valid 10-digit secondary number";
    if (formData.fax && !faxRegex.test(formData.fax)) newErrors.fax = "Enter a valid fax number (6-15 digits)";
    if (!formData.email.trim()) newErrors.email = "E-mail is required";
    else if (!emailRegex.test(formData.email)) newErrors.email = "Enter a valid email address";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate() && id) {
      try {
        await updateLocation(id, formData);
        setOpen(true);
      } catch (error) {
        console.error("Update failed", error);
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to update location Please try again."
        );
        setErrorOpen(true);
      }
    }
  };

  return (
    <FormPageLayout>
      <Paper sx={{ p: 3, maxWidth: "600px", width: "100%", boxShadow: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Update Fixed Assets Location
        </Typography>

        <Stack spacing={2}>
          {([
            { label: "Location Code", field: "locationCode" },
            { label: "Location Name", field: "locationName" },
            { label: "Contact for Deliveries", field: "contact" },
            { label: "Address", field: "address" },
            { label: "Telephone Number", field: "phone" },
            { label: "Secondary Telephone Number", field: "secondaryPhone" },
            { label: "Facsimile No.", field: "fax" },
            { label: "E-mail", field: "email" },
          ] as const).map(({ label, field }) => (
            <TextField
              key={field}
              label={label}
              size="small"
              fullWidth
              value={formData[field]}
              onChange={(e) => handleChange(field, e.target.value)}
              error={!!errors[field]}
              helperText={errors[field] || " "}
            />
          ))}
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
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Fixed Asset Location has been updated successfully!"
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
