import { FormPageLayout } from "../../../../../components/Layout/FormPageLayout";
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
  MenuItem,
} from "@mui/material";
import { createCustomerContact } from "../../../../../api/Customer/CustomerContactApi";
import { createCrmContact } from "../../../../../api/CrmContact/CrmContact";
import { getContactCategory } from "../../../../../api/ContactCategory/ContactCategoryApi";
import { useLocation } from "react-router";
import { useNavigate } from "react-router";
import ErrorModal from "../../../../../components/ErrorModal";
import AddedConfirmationModal from "../../../../../components/AddedConfirmationModal";
import { getContactCategories } from "../../../../../api/ContactCategory/ContactCategoryApi";
import { useAuth } from "../../../../../context/AuthContext";

interface AddCustomersContactsData {
  firstName: string;
  lastName: string;
  reference: string;
  contactActiveFor: string;
  phone: string;
  secondaryPhone: string;
  fax: string;
  email: string;
  address: string;
  documentLanguage: string;
  notes: string;
}

export default function AddCustomersContactsForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales customer and branches changes');
  const [formData, setFormData] = useState<AddCustomersContactsData>({
    firstName: "",
    lastName: "",
    reference: "",
    contactActiveFor: "",
    phone: "",
    secondaryPhone: "",
    fax: "",
    email: "",
    address: "",
    documentLanguage: "",
    notes: "",
  });

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof AddCustomersContactsData, string>>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const location = useLocation();

  const [categories, setCategories] = useState<{ id?: number; name: string }[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getContactCategories(); // fetch all categories
        const filtered = data.filter((category: any) => category.type === "customer");
        setCategories(filtered);
      } catch (error) {
        console.error("Failed to fetch CRM categories:", error);
      }
    };

    fetchCategories();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof AddCustomersContactsData, string>> = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First Name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last Name is required";
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate()) {
      try {
        const payload = {
          ref: formData.reference,
          name: formData.firstName,
          name2: formData.lastName,
          address: formData.address,
          phone: formData.phone,
          phone2: formData.secondaryPhone,
          fax: formData.fax,
          email: formData.email,
          lang: formData.documentLanguage,
          notes: formData.notes
        }
        const created = await createCustomerContact(payload);

        // Create crm_contacts entry based on selected contact category
        (async () => {
          try {
            // type should come from contactActiveFor (category.id)
            const typeId = Number(formData.contactActiveFor) || undefined;
            if (!typeId) return; // no category selected

            // fetch action (subtype) from crm-categories
            const category = await getContactCategory(typeId);
            const action = category?.subtype || "";

            // determine entity_id: prefer location.state.customerId, then URL query 'customer', then form reference
            let entityId: string | number = "";
            if ((location as any)?.state && (location as any).state.debtor_no) {
              entityId = (location as any).state.debtor_no;
            } else {
              const params = new URLSearchParams(window.location.search);
              if (params.get("customer")) entityId = params.get("customer")!;
              else if (formData.reference) entityId = formData.reference;
            }

            await createCrmContact({
              person_id: (created as any).id,
              type: typeId,
              action,
              entity_id: String(entityId),
            });
          } catch (crmErr) {
            // Log but don't block the main flow
            // eslint-disable-next-line no-console
            console.error("Failed to create crm_contacts entry for contact:", crmErr);
          }
        })();

        setOpen(true);
      } catch (error) {
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to add Conatact Please try again."
        );
        setErrorOpen(true);
      }
    }
  };

  return (
    <FormPageLayout>
      <Paper
        sx={{
          p: 3,
          maxWidth: "600px",
          width: "100%",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}
        >
          Add Customer Contact
        </Typography>

        <Stack spacing={2}>
          {/* First Name */}
          <TextField
            label="First Name"
            name="firstName"
            size="small"
            fullWidth
            value={formData.firstName}
            onChange={handleInputChange}
            error={!!errors.firstName}
            helperText={errors.firstName || " "}
          />

          {/* Last Name */}
          <TextField
            label="Last Name"
            name="lastName"
            size="small"
            fullWidth
            value={formData.lastName}
            onChange={handleInputChange}
            error={!!errors.lastName}
            helperText={errors.lastName || " "}
          />

          {/* Reference */}
          <TextField
            label="Reference"
            name="reference"
            size="small"
            fullWidth
            value={formData.reference}
            onChange={handleInputChange}
            helperText=" "
          />

          {/* Contact Active For */}
          <TextField
            select
            label="Contact Active For"
            name="contactActiveFor"
            size="small"
            fullWidth
            value={formData.contactActiveFor}
            onChange={handleInputChange}
            helperText=" "
          >
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </TextField>

          {/* Phone */}
          <TextField
            label="Phone"
            name="phone"
            size="small"
            fullWidth
            value={formData.phone}
            onChange={handleInputChange}
            error={!!errors.phone}
            helperText={errors.phone || " "}
          />

          {/* Secondary Phone */}
          <TextField
            label="Secondary Phone Number"
            name="secondaryPhone"
            size="small"
            fullWidth
            value={formData.secondaryPhone}
            onChange={handleInputChange}
            helperText=" "
          />

          {/* Fax */}
          <TextField
            label="Fax Number"
            name="fax"
            size="small"
            fullWidth
            value={formData.fax}
            onChange={handleInputChange}
            helperText=" "
          />

          {/* Email */}
          <TextField
            label="Email"
            name="email"
            size="small"
            fullWidth
            value={formData.email}
            onChange={handleInputChange}
            error={!!errors.email}
            helperText={errors.email || " "}
          />

          {/* Address */}
          <TextField
            label="Address"
            name="address"
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={formData.address}
            onChange={handleInputChange}
            helperText=" "
          />

          {/* Document Language */}
          <TextField
            select
            label="Document Language"
            name="documentLanguage"
            size="small"
            fullWidth
            value={formData.documentLanguage}
            onChange={handleInputChange}
            helperText=" "
          >
            <MenuItem value="EN">English</MenuItem>
            <MenuItem value="SI">Sinhala</MenuItem>
            <MenuItem value="TA">Tamil</MenuItem>
          </TextField>

          {/* Notes */}
          <TextField
            label="Notes"
            name="notes"
            size="small"
            fullWidth
            multiline
            minRows={3}
            value={formData.notes}
            onChange={handleInputChange}
            helperText=" "
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
            Add New
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Customer contact has been added successfully!"
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
