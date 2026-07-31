import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Paper,
  useTheme,
  useMediaQuery,
  CircularProgress,
} from "@mui/material";
import theme from "../../../../theme";
import { useParams, useNavigate } from "react-router-dom";
import { getInventoryLocation, updateInventoryLocation } from "../../../../api/InventoryLocation/InventoryLocationApi";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal"
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

interface InventoryLocationFormData {
  locationCode: string;
  locationName: string;
  contact: string;
  address: string;
  telephone: string;
  secondaryTelephone: string;
  facsimile: string;
  email: string;
}

export default function UpdateInventoryLocationForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Inventory locations changes');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<InventoryLocationFormData>({
    locationCode: "",
    locationName: "",
    contact: "",
    address: "",
    telephone: "",
    secondaryTelephone: "",
    facsimile: "",
    email: "",
  });

  const [errors, setErrors] = useState<Partial<InventoryLocationFormData>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const [loading, setLoading] = useState(true);

  // Fetch previous data
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const data = await getInventoryLocation(Number(id));
        console.log("Fetched data:", data); // check API response

        setFormData({
          locationCode: data.loc_code || "",
          locationName: data.location_name || "",
          contact: data.contact || "",
          address: data.delivery_address || "",
          telephone: data.phone || "",
          secondaryTelephone: data.phone2 || "",
          facsimile: data.fax || "",
          email: data.email || "",
        });
      } catch (error) {
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to update Inventory location Please try again."
        );
        setErrorOpen(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" }); // clear error on change
  };

  const validate = () => {
    const newErrors: Partial<InventoryLocationFormData> = {};

    if (!formData.locationCode) newErrors.locationCode = "Location Code is required";
    if (!formData.locationName) newErrors.locationName = "Location Name is required";
    if (!formData.contact) newErrors.contact = "Contact is required";
    if (!formData.address) newErrors.address = "Address is required";
    if (!formData.telephone) newErrors.telephone = "Telephone number is required";
    else if (!/^\d{10,15}$/.test(formData.telephone))
      newErrors.telephone = "Enter a valid telephone number";
    if (formData.secondaryTelephone && !/^\d{10,15}$/.test(formData.secondaryTelephone))
      newErrors.secondaryTelephone = "Enter a valid secondary telephone number";
    if (formData.facsimile && !/^\d+$/.test(formData.facsimile))
      newErrors.facsimile = "Enter a valid facsimile number";
    if (!formData.email) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Enter a valid email";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      await updateInventoryLocation(Number(id), {
        loc_code: formData.locationCode,
        location_name: formData.locationName,
        delivery_address: formData.address,
        contact: formData.contact,
        phone: formData.telephone,
        phone2: formData.secondaryTelephone,
        fax: formData.facsimile,
        email: formData.email,
      });
      setOpen(true);
    } catch (error) {
      console.error("Update failed:", error);
      setErrorMessage(
          error?.response?.data?.message ||
          "Failed to update Inventory location Please try again."
        );
        setErrorOpen(true);
    }
  };

  if (loading)
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
        <CircularProgress />
      </Box>
    );

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
          Update Inventory Location
        </Typography>

        <Stack spacing={0.5}>
          <TextField
            label="Location Code"
            name="locationCode"
            size="small"
            fullWidth
            value={formData.locationCode}
            onChange={handleChange}
            error={!!errors.locationCode}
            helperText={errors.locationCode || " "}
          />

          <TextField
            label="Location Name"
            name="locationName"
            size="small"
            fullWidth
            value={formData.locationName}
            onChange={handleChange}
            error={!!errors.locationName}
            helperText={errors.locationName || " "}
          />

          <TextField
            label="Contact of Deliveries"
            name="contact"
            size="small"
            fullWidth
            value={formData.contact}
            onChange={handleChange}
            error={!!errors.contact}
            helperText={errors.contact || " "}
          />

          <TextField
            label="Address"
            name="address"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={formData.address}
            onChange={handleChange}
            error={!!errors.address}
            helperText={errors.address || " "}
          />

          <TextField
            label="Telephone No"
            name="telephone"
            size="small"
            fullWidth
            value={formData.telephone}
            onChange={handleChange}
            error={!!errors.telephone}
            helperText={errors.telephone || " "}
          />

          <TextField
            label="Secondary Telephone No"
            name="secondaryTelephone"
            size="small"
            fullWidth
            value={formData.secondaryTelephone}
            onChange={handleChange}
            error={!!errors.secondaryTelephone}
            helperText={errors.secondaryTelephone || " "}
          />

          <TextField
            label="Facsimile No"
            name="facsimile"
            size="small"
            fullWidth
            value={formData.facsimile}
            onChange={handleChange}
            error={!!errors.facsimile}
            helperText={errors.facsimile || " "}
          />

          <TextField
            label="Email"
            name="email"
            size="small"
            fullWidth
            value={formData.email}
            onChange={handleChange}
            error={!!errors.email}
            helperText={errors.email || " "}
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
          <Button onClick={() => navigate(-1)}>Back</Button>

          <Button disabled={!canEdit}
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            Update Location
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Inventory Location has been updated successfully!"
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
