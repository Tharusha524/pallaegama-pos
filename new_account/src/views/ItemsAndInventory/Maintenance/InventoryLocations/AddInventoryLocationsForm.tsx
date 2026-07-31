import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Paper,
  FormHelperText,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import theme from "../../../../theme";
import { createInventoryLocation } from "../../../../api/InventoryLocation/InventoryLocationApi";
import { getItems } from "../../../../api/Item/ItemApi";
import { createLocStock } from "../../../../api/LocStock/LocStockApi";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
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

export default function AddInventoryLocationForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Inventory locations changes');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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
    else if (!/^\d{10,15}$/.test(formData.telephone)) newErrors.telephone = "Enter a valid telephone number";
    if (formData.secondaryTelephone && !/^\d{10,15}$/.test(formData.secondaryTelephone))
      newErrors.secondaryTelephone = "Enter a valid secondary telephone number";
    if (formData.facsimile && !/^\d+$/.test(formData.facsimile)) newErrors.facsimile = "Enter a valid facsimile number";
    if (!formData.email) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Enter a valid email";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate()) {
      try {
        const payload = {
          loc_code: formData.locationCode,
          location_name: formData.locationName,
          delivery_address: formData.address,
          contact: formData.contact,
          phone: formData.telephone,
          phone2: formData.secondaryTelephone,
          fax: formData.facsimile,
          email: formData.email,
        };

        await createInventoryLocation(payload);

        // Get all items
        const items = await getItems();

        // Create loc_stock entries for each item
        const locStockPromises = items.map((item: any) =>
          createLocStock({
            stock_id: item.stock_id,
            loc_code: formData.locationCode,
            reorder_level: 0, // default reorder level
          })
        );

        await Promise.all(locStockPromises);

        setOpen(true);
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to add Inventory location Please try again."
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
          Add Inventory Location
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
          <Button onClick={() => window.history.back()}>Back</Button>

          <Button disabled={!canEdit}
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            Add Location
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Inventory location has been added successfully!"
        addFunc={async () => { }}
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
