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
import { useLocation, useNavigate } from "react-router-dom";
import { createSupplierContact } from "../../../../../api/Supplier/SupplierContactApi";
import { createCrmContact } from "../../../../../api/CrmContact/CrmContact";
import { getContactCategories, getContactCategory } from "../../../../../api/ContactCategory/ContactCategoryApi";
import AddedConfirmationModal from "../../../../../components/AddedConfirmationModal";
import ErrorModal from "../../../../../components/ErrorModal";
import { useAuth } from "../../../../../context/AuthContext";

interface AddSuppliersContactsData {
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

export default function AddSuppliersContactsForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Suppliers changes');
  const location = useLocation();
  const navigate = useNavigate();
  const supplierId = location.state?.supplierId; // get supplierId from dropdown

  const [formData, setFormData] = useState<AddSuppliersContactsData>({
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

  const [categories, setCategories] = useState<{ id?: number; name: string }[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof AddSuppliersContactsData, string>>>({});
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  // Fetch categories for "Contact Active For"
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getContactCategories();
        const filtered = data.filter((cat: any) => cat.type === "supplier");
        setCategories(filtered);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    };
    fetchCategories();
  }, []);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  // Validate form
  const validate = () => {
    const newErrors: Partial<Record<keyof AddSuppliersContactsData, string>> = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First Name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last Name is required";
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Invalid email format";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submit
  const handleSubmit = async () => {
    if (!validate()) return;

    if (!supplierId) {
      setErrorMessage("Supplier ID not found. Cannot add contact.");
      setErrorOpen(true);
      return;
    }

    if (!formData.contactActiveFor) {
      setErrorMessage("Please select 'Contact Active For' category.");
      setErrorOpen(true);
      return;
    }

    try {
      // Step 1: Create supplier contact (person)
      const supplierPayload = {
        ref: formData.reference,
        name: formData.firstName,
        name2: formData.lastName,
        address: formData.address,
        phone: formData.phone,
        phone2: formData.secondaryPhone,
        fax: formData.fax,
        email: formData.email,
        lang: formData.documentLanguage,
        notes: formData.notes,
      };

      const createdPerson = await createSupplierContact(supplierPayload);
      const personId = createdPerson.id;

      // Step 2: Create CRM contact linked to this person (non-blocking)
      (async () => {
        try {
          const typeId = Number(formData.contactActiveFor) || undefined;
          if (!typeId) return; // no category selected

          // fetch action (subtype) from crm-categories
          const category = await getContactCategory(typeId);
          const action = category?.subtype || "assigned";

          // determine entity_id: prefer location.state.supplierId, then URL query 'supplier', then form reference
          let entityId: string | number = "";
          if ((location as any)?.state && (location as any).state.supplierId) {
            entityId = (location as any).state.supplierId;
          } else {
            const params = new URLSearchParams(window.location.search);
            if (params.get("supplier")) entityId = params.get("supplier")!;
            else if (formData.reference) entityId = formData.reference;
          }

          await createCrmContact({
            person_id: personId,
            type: typeId,
            action,
            entity_id: String(entityId),
          });
        } catch (crmErr) {
          console.error("Failed to create crm_contacts entry for supplier contact:", crmErr);
        }
      })();

      // Show success modal
      setOpen(true);
    } catch (error: any) {
      console.error("Error adding contact:", error);
      setErrorMessage(error?.response?.data?.message || "Failed to add contact. Please try again.");
      setErrorOpen(true);
    }
  };

  return (
    <FormPageLayout>
      <Paper sx={{ p: 3, maxWidth: 600, width: "100%", boxShadow: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Add Supplier Contact
        </Typography>

        <Stack spacing={2}>
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

          <TextField
            label="Reference"
            name="reference"
            size="small"
            fullWidth
            value={formData.reference}
            onChange={handleInputChange}
            helperText=" "
          />

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
            {categories.map((cat) => (
              <MenuItem key={cat.id} value={cat.id}>
                {cat.name}
              </MenuItem>
            ))}
          </TextField>

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

          <TextField
            label="Secondary Phone"
            name="secondaryPhone"
            size="small"
            fullWidth
            value={formData.secondaryPhone}
            onChange={handleInputChange}
            helperText=" "
          />

          <TextField
            label="Fax"
            name="fax"
            size="small"
            fullWidth
            value={formData.fax}
            onChange={handleInputChange}
            helperText=" "
          />

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

        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 2 : 0 }}>
          <Button onClick={() => navigate(-1)}>Back</Button>
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
        content="Supplier contact has been added successfully!"
        handleClose={() => setOpen(false)}
        onSuccess={() => navigate(-1)}
        addFunc={async () => {}}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}
