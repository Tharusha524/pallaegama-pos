import { FormPageLayout } from "../../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import api from "../../../../../api/apiClient";
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
import { updateCustomerContact, getCustomerContacts } from "../../../../../api/CustomerBranch/ContactofBranchApi";
import { useParams } from "react-router";
import UpdateConfirmationModal from "../../../../../components/UpdateConfirmationModal";
import ErrorModal from "../../../../../components/ErrorModal";
import { getContactCategories } from "../../../../../api/ContactCategory/ContactCategoryApi";
import { useAuth } from "../../../../../context/AuthContext";
interface UpdateContactsData {
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

export default function UpdateContactsForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Customer branches maintenance');
  const [formData, setFormData] = useState<UpdateContactsData>({
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
  const [errors, setErrors] = useState<Partial<Record<keyof UpdateContactsData, string>>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const { id } = useParams();
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const [categories, setCategories] = useState<{ id?: number; name: string }[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getContactCategories(); // fetch all categories
        const filtered = data.filter((category: any) => category.type === "cust_branch");
        setCategories(filtered);
      } catch (error) {
        console.error("Failed to fetch CRM categories:", error);
      }
    };
  
    fetchCategories();
  }, []);

  const validate = () => {
    const newErrors: Partial<Record<keyof UpdateContactsData, string>> = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First Name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last Name is required";
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    const fetchContact = async () => {
      try {
        console.log('Fetching contact with ID:', id);
        
        // First, get the contact record to find the person_id
        const contactResponse = await api.get(`/crm-contacts/${id}`);
        const contact = contactResponse.data;
        
        if (!contact) {
          console.error('No contact found with ID:', id);
          setErrorMessage("Contact not found. Please try again.");
          setErrorOpen(true);
          return;
        }
        
        // Get the person details
        const personResponse = await api.get(`/crm-persons/${contact.person_id}`);
        const personData = personResponse.data;
        
        if (!personData) {
          console.error('No person found with ID:', contact.person_id);
          setErrorMessage("Contact person details not found. Please try again.");
          setErrorOpen(true);
          return;
        }
        
        // Get the category details
        const categoryResponse = await api.get(`/crm-categories/${contact.type}`);
        const categoryData = categoryResponse.data;
        console.log('Category data:', categoryData);
        
        setFormData({
          firstName: personData.name || "",
          lastName: personData.name2 || "",
          reference: personData.ref || "",
          contactActiveFor: contact.type.toString() || "", // Make sure to convert to string for the select
          phone: personData.phone || "",
          secondaryPhone: personData.phone2 || "",
          fax: personData.fax || "",
          email: personData.email || "",
          address: personData.address || "",
          documentLanguage: personData.lang || "",
          notes: personData.notes || "",
        });
        
      } catch (err) {
        console.error("Failed to fetch contact:", err);
        setErrorMessage("Failed to load contact details. Please try again.");
        setErrorOpen(true);
      }
    };
    if (id) fetchContact();
  }, [id]);

  const handleSubmit = async () => {
    if (validate()) {
      try {
        console.log('Submitting updated contact data for ID:', id);
        
        await updateCustomerContact(id!, {
          name: formData.firstName,
          name2: formData.lastName,
          ref: formData.reference,
          assignment: parseInt(formData.contactActiveFor), // Convert to number for the API
          phone: formData.phone,
          phone2: formData.secondaryPhone,
          fax: formData.fax,
          email: formData.email,
          address: formData.address,
          lang: formData.documentLanguage,
          notes: formData.notes,
        });
        
        console.log('Contact updated successfully');
        setOpen(true);
      }
      catch (error: any) {
        console.error("Update failed:", error);
        setErrorMessage(
          error?.response?.data?.message || error?.message ||
          "Failed to update contact. Please try again."
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
          Update
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
            Update
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Customer Contact has been updated successfully!"
        handleClose={() => setOpen(false)}
        onSuccess={() => {
          // Set a flag in sessionStorage to indicate a contact was just updated
          sessionStorage.setItem('contactAdded', 'true');
          // Navigate back to the contacts list
          window.history.back();
        }}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}

