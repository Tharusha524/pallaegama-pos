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
import { updateSupplierContact } from "../../../../../api/Supplier/SupplierContactApi";
import api from "../../../../../api/apiClient";
import { getCrmContactById, updateCrmContact } from "../../../../../api/CrmContact/CrmContact";
import { getContactCategory } from "../../../../../api/ContactCategory/ContactCategoryApi";
import { useNavigate } from "react-router";
import ErrorModal from "../../../../../components/ErrorModal";
import UpdateConfirmationModal from "../../../../../components/UpdateConfirmationModal";
import { useParams } from "react-router";
import { getContactCategories } from "../../../../../api/ContactCategory/ContactCategoryApi";
import { useAuth } from "../../../../../context/AuthContext";
interface UpdateSuppliersContactsData {
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

export default function UpdateSuppliersContactsForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Suppliers changes');
  const [formData, setFormData] = useState<UpdateSuppliersContactsData>({
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
  const [errors, setErrors] = useState<Partial<Record<keyof UpdateSuppliersContactsData, string>>>({});
  const muiTheme = useTheme();
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const [loading, setLoading] = useState(true);
  const [originalCrmContact, setOriginalCrmContact] = useState<any>(null);

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
        const filtered = data.filter((category: any) => category.type === "supplier");
        setCategories(filtered);
      } catch (error) {
        console.error("Failed to fetch CRM categories:", error);
      }
    };

    fetchCategories();
  }, []);

  const validate = () => {
    const newErrors: Partial<Record<keyof UpdateSuppliersContactsData, string>> = {};
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
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // get crm_contact to find the person_id and type
  const crmContact = await getCrmContactById(Number(id));
        if (!crmContact) {
          setErrorMessage("Contact record not found");
          setErrorOpen(true);
          setLoading(false);
          return;
        }

  const personId = crmContact.person_id;
  // store original crm contact so we can update its type later
  setOriginalCrmContact(crmContact);
        if (!personId) {
          setErrorMessage("Person ID is missing from contact record");
          setErrorOpen(true);
          setLoading(false);
          return;
        }

        // fetch person details
        const personResp = await api.get(`/crm-persons/${personId}`);
        const person = personResp.data;

        // split name into first/last
        let firstName = "";
        let lastName = "";
        if (person?.name) {
          const parts = person.name.split(" ");
          firstName = parts[0];
          lastName = parts.slice(1).join(" ");
        }

        setFormData({
          firstName: firstName || "",
          lastName: lastName || person?.name2 || "",
          reference: person?.ref || "",
          contactActiveFor: String(crmContact.type || ""),
          phone: person?.phone || "",
          secondaryPhone: person?.phone2 || "",
          fax: person?.fax || "",
          email: person?.email || "",
          address: person?.address || "",
          documentLanguage: person?.lang || "",
          notes: person?.notes || "",
        });
      } catch (err: any) {
        console.error("Failed to fetch contact:", err);
        setErrorMessage(err?.response?.data?.message || err?.message || "Failed to load contact information. Please try again.");
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
        // Convert contactActiveFor to number when provided
        let assignment: number | undefined;
        if (formData.contactActiveFor) {
          const parsed = parseInt(formData.contactActiveFor, 10);
          if (!isNaN(parsed)) assignment = parsed;
        }

        if (!id) throw new Error("Contact ID is missing");

        // Update the person record first
        await updateSupplierContact(id, {
          name: formData.firstName,
          name2: formData.lastName,
          ref: formData.reference,
          assignment: undefined, // assignment lives on crm_contacts; keep undefined here
          phone: formData.phone,
          phone2: formData.secondaryPhone,
          fax: formData.fax,
          email: formData.email,
          address: formData.address,
          lang: formData.documentLanguage,
          notes: formData.notes,
        });

        // Then update crm_contacts.type if we have the original crm contact and assignment was provided
        if (originalCrmContact && typeof assignment !== 'undefined') {
          try {
            // Derive action from contact category subtype when possible
            let actionValue = originalCrmContact.action || 'assigned';
            try {
              const category = await getContactCategory(assignment);
              if (category && category.subtype) actionValue = category.subtype;
            } catch (catErr) {
              console.warn('Failed to fetch category for assignment, falling back to original action', catErr);
            }

            await updateCrmContact(originalCrmContact.id, {
              person_id: originalCrmContact.person_id,
              type: assignment,
              action: actionValue,
              entity_id: originalCrmContact.entity_id ? String(originalCrmContact.entity_id) : undefined,
            });
          } catch (crmErr) {
            console.error('Failed to update crm_contacts type/action:', crmErr);
            // non-blocking: we don't fail the whole update if crm contact update fails
          }
        }

        setOpen(true);
      } catch (error: any) {
        console.error("Update failed:", error);
        setErrorMessage(
          error?.response?.data?.message ||
          error?.message ||
          "Failed to update contact Please try again."
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
          Update Supplier Contact
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
        content="Supplier Contact has been updated successfully!"
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

