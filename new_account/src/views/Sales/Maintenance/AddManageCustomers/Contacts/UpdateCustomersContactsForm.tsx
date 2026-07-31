import { FormPageLayout } from "../../../../../components/Layout/FormPageLayout";
import React, { useState } from "react";
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
import { useParams, useNavigate } from "react-router";
import { updateCustomerContact, getCustomerContacts } from "../../../../../api/Customer/CustomerContactApi";
import { getContactCategory } from "../../../../../api/ContactCategory/ContactCategoryApi";
import { updateCrmContact } from "../../../../../api/CrmContact/CrmContact";
import { useEffect } from "react";
import ErrorModal from "../../../../../components/ErrorModal";
import UpdateConfirmationModal from "../../../../../components/UpdateConfirmationModal";
import { getContactCategories } from "../../../../../api/ContactCategory/ContactCategoryApi";
import api from "../../../../../api/apiClient";
import { useAuth } from "../../../../../context/AuthContext";

interface UpdateCustomersContactsData {
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

export default function UpdateCustomersContactsForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales customer and branches changes');
  const [formData, setFormData] = useState<UpdateCustomersContactsData>({
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
  const [errors, setErrors] = useState<Partial<Record<keyof UpdateCustomersContactsData, string>>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const { id } = useParams();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<{ id?: number; name: string }[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getContactCategories(); // fetch all categories
        const filtered = data.filter((category: any) => category.type === "customer");
        
        if (filtered.length === 0) {
          console.warn("No customer contact categories found. Contact type selection will be empty.");
        }
        
        setCategories(filtered);
      } catch (error: any) {
        console.error("Failed to fetch CRM categories:", error);
        setErrorMessage(
          error?.response?.data?.message || 
          error?.message || 
          "Failed to load contact categories. Some form options may be unavailable."
        );
        setErrorOpen(true);
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
    const newErrors: Partial<Record<keyof UpdateCustomersContactsData, string>> = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First Name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last Name is required";
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Store the original contact data for reference
  const [originalContact, setOriginalContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContact = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // First, get the crm_contact record to get the type ID and person_id
        const contactResponse = await api.get(`/crm-contacts/${id}`);
        const contactRecord = contactResponse.data;
        
        if (!contactRecord) {
          setErrorMessage("Contact record not found");
          setErrorOpen(true);
          setLoading(false);
          return;
        }
        
        const typeId = contactRecord.type;
        const personId = contactRecord.person_id;
        
        if (!personId) {
          setErrorMessage("Person ID is missing from contact record");
          setErrorOpen(true);
          setLoading(false);
          return;
        }
        
        // Get the person details directly
        const personResponse = await api.get(`/crm-persons/${personId}`);
        const personData = personResponse.data;
        
        if (!personData) {
          setErrorMessage("Person data not found");
          setErrorOpen(true);
          setLoading(false);
          return;
        }
        
        // Store the original contact and person separately so we don't overwrite crm_contact.id with person.id
        setOriginalContact({
          contact: contactRecord,
          person: personData,
        });
        
        // Set form data based on the retrieved information
        setFormData({
          firstName: personData.name || "",
          lastName: personData.name2 || "",
          reference: personData.ref || "",
          contactActiveFor: typeId?.toString() || "",
          phone: personData.phone || "",
          secondaryPhone: personData.phone2 || "",
          fax: personData.fax || "",
          email: personData.email || "",
          address: personData.address || "",
          documentLanguage: personData.lang || "",
          notes: personData.notes || "",
        });
      } catch (err: any) {
        console.error("Failed to fetch contact:", err);
        setErrorMessage(
          err?.response?.data?.message || 
          err?.message || 
          "Failed to load contact information. Please try again."
        );
        setErrorOpen(true);
      } finally {
        setLoading(false);
      }
    };

    fetchContact();
  }, [id]);


  const handleSubmit = async () => {
    if (validate()) {
      try {
        // Convert contactActiveFor to number when it exists
        let assignment: number | undefined;
        
        if (formData.contactActiveFor) {
          const parsed = parseInt(formData.contactActiveFor, 10);
          // Verify that it parsed to a valid number
          if (!isNaN(parsed)) {
            assignment = parsed;
          }
        }
        
        if (!id) {
          throw new Error("Contact ID is missing");
        }
        
        // prevent the helper from updating crm_contacts directly; we'll update crm_contacts explicitly below
        await updateCustomerContact(id, {
          name: formData.firstName,
          name2: formData.lastName,
          ref: formData.reference,
          assignment: undefined,
          phone: formData.phone,
          phone2: formData.secondaryPhone,
          fax: formData.fax,
          email: formData.email,
          address: formData.address,
          lang: formData.documentLanguage,
          notes: formData.notes,
        });

        // Also update crm_contacts.type and crm_contacts.action when assignment provided
        if (originalContact && typeof assignment !== 'undefined') {
          try {
            // derive action from contact category (prefer subtype, then name/description)
            let actionValue = originalContact.contact?.action || 'assigned';
            try {
              const category = await getContactCategory(assignment);
              if (category) actionValue = category.subtype || category.name || category.description || actionValue;
            } catch (catErr) {
              console.warn('Failed to fetch category for assignment, falling back to original action', catErr);
            }

            await updateCrmContact(originalContact.contact.id, {
              person_id: originalContact.contact.person_id,
              type: assignment,
              action: actionValue,
              entity_id: originalContact.contact.entity_id ? String(originalContact.contact.entity_id) : undefined,
            });
          } catch (crmErr) {
            console.error('Failed to update crm_contacts type/action:', crmErr);
            // non-blocking
          }
        }

        setOpen(true);
      } catch (error: any) {
        console.error("Update failed:", error);
        setErrorMessage(
          error?.response?.data?.message || 
          error?.message || 
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
          Update Customer Contact
        </Typography>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <Typography>Loading contact data...</Typography>
          </Box>
        ) : (
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
        )}
        
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

