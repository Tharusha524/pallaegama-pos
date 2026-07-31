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
import {
  getShippingCompany,
  updateShippingCompany,
} from "../../../../api/ShippingCompany/ShippingCompanyApi";
import { useParams, useNavigate } from "react-router-dom";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

interface ShippingCompanyFormData {
  shipper_name: string;
  contact: string;
  phone: string;
  phone2: string;
  address: string;
}

export default function UpdateShippingCompanyForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Shipping ways');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { shipper_id } = useParams<{ shipper_id: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<ShippingCompanyFormData>({
    shipper_name: "",
    contact: "",
    phone: "",
    phone2: "",
    address: "",
  });

  const [errors, setErrors] = useState<Partial<ShippingCompanyFormData>>({});

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  useEffect(() => {
    if (!shipper_id) return;

    const fetchCompany = async () => {
      try {
        const res = await getShippingCompany(Number(shipper_id));
        if (res) {
          setFormData({
            shipper_name: res.shipper_name || "",
            contact: res.contact || "",
            phone: res.phone || "",
            phone2: res.phone2 || "",
            address: res.address || "",
          });
        }
      } catch (error) {
        console.error("Error fetching shipping company:", error);
         setErrorMessage(
          error?.response?.data?.message ||
          "Failed to load shippin company Please try again."
        );
        setErrorOpen(true);
      }
    };

    fetchCompany();
  }, [shipper_id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const validate = (): boolean => {
    const newErrors: Partial<ShippingCompanyFormData> = {};

    if (!formData.shipper_name) newErrors.shipper_name = "Company name is required";
    if (!formData.contact) newErrors.contact = "Contact person is required";
    if (!formData.phone) newErrors.phone = "Phone number is required";
    else if (!/^\d{10,15}$/.test(formData.phone))
      newErrors.phone = "Phone number must be 10–15 digits";

    if (formData.phone2 && !/^\d{10,15}$/.test(formData.phone2))
      newErrors.phone2 = "Secondary number must be 10–15 digits";

    if (!formData.address) newErrors.address = "Address is required";

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    if (!validate()) return;

    try {
      await updateShippingCompany(Number(shipper_id), formData);
      setOpen(true);
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to update shipping company Please try again."
      );
      setErrorOpen(true);
      console.error(error);
    }
  };

  return (
    <FormPageLayout>
      <Paper
        sx={{
          p: theme.spacing(3),
          maxWidth: isMobile ? "100%" : "500px",
          width: "100%",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}
        >
          Edit Shipping Company
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Company Name"
            name="shipper_name"
            size="small"
            fullWidth
            value={formData.shipper_name}
            onChange={handleChange}
            error={!!errors.shipper_name}
            helperText={errors.shipper_name}
          />

          <TextField
            label="Contact Person"
            name="contact"
            size="small"
            fullWidth
            value={formData.contact}
            onChange={handleChange}
            error={!!errors.contact}
            helperText={errors.contact}
          />

          <TextField
            label="Phone Number"
            name="phone"
            size="small"
            fullWidth
            value={formData.phone}
            onChange={handleChange}
            error={!!errors.phone}
            helperText={errors.phone}
          />

          <TextField
            label="Secondary Number"
            name="phone2"
            size="small"
            fullWidth
            value={formData.phone2}
            onChange={handleChange}
            error={!!errors.phone2}
            helperText={errors.phone2}
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
            helperText={errors.address}
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
          <Button
            fullWidth={isMobile}
            variant="outlined"
            onClick={() => navigate(-1)}
          >
            Back
          </Button>

          <Button disabled={!canEdit}
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleUpdate}
          >
            Update Company
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Shipping Company has been updated successfully!"
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
