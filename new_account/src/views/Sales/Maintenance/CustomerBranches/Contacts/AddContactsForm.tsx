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
import { createCustomerContact } from "../../../../../api/CustomerBranch/ContactofBranchApi";
import { createCrmContact } from "../../../../../api/CrmContact/CrmContact";
import { getContactCategory } from "../../../../../api/ContactCategory/ContactCategoryApi";
import { useLocation } from "react-router";
import ErrorModal from "../../../../../components/ErrorModal";
import AddedConfirmationModal from "../../../../../components/AddedConfirmationModal";
import { getContactCategories } from "../../../../../api/ContactCategory/ContactCategoryApi";
import { useAuth } from "../../../../../context/AuthContext";
interface AddContactsData {
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

export default function AddContactsForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Customer branches maintenance');
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState<AddContactsData>({
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


  const [errors, setErrors] = useState<Partial<Record<keyof AddContactsData, string>>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof AddContactsData, string>> = {};
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
        console.log('Sending payload to create customer contact:', payload);
        const created = await createCustomerContact(payload);
        console.log('Person created successfully:', created);

        // Create crm_contacts entry for branch contact (making it blocking to ensure it completes)
        try {
          const typeId = Number(formData.contactActiveFor) || undefined;
          if (!typeId) {
            console.warn('No type/category selected. Contact will be created but not associated with a branch.');
            setOpen(true);
            return;
          }

          const category = await getContactCategory(typeId);
          const action = category?.subtype || "";

          // entity_id resolution order for crm_contacts table:
          // For customer branch contacts, entity_id must be the branch_code
          // 1) location.state.branch_code (if available)
          // 2) URL param 'branch' (should be the branch ID)
          // 3) URL param 'customer' (if no branch param, as fallback)
          // 4) form reference (last resort)
          let entityId: string | number = "";
          const params = new URLSearchParams(window.location.search);
          
          // Check for branch_code in location state (from navigation)
          if ((location as any)?.state && (location as any).state.branch_code) {
            entityId = (location as any).state.branch_code;
            console.log('Using branch_code from location state:', entityId);
          } 
          // Check for branch parameter in URL
          else if (params.get("branch")) {
            entityId = params.get("branch")!;
            console.log('Using branch from URL param:', entityId);
          }
          // Fall back to customer parameter 
          else if (params.get("customer")) {
            entityId = params.get("customer")!;
            console.log('Using customer from URL param as fallback:', entityId);
          }
          // Last resort: use reference field
          else if (formData.reference) {
            entityId = formData.reference;
            console.log('Using reference field as last resort:', entityId);
          }
          
          if (!entityId) {
            console.warn('No branch ID found for entity_id. Contact may not be properly associated with a branch.');
          }

          const crmContactPayload = {
            person_id: (created as any).id,
            type: typeId,
            action,
            entity_id: String(entityId),
          };
          
          console.log('Creating CRM contact with payload:', crmContactPayload);
          const crmContactResult = await createCrmContact(crmContactPayload);
          console.log('CRM contact created successfully:', crmContactResult);
          
          // Only show success after both person and contact are created
          setOpen(true);
        } catch (crmErr) {
          console.error("Failed to create crm_contacts entry for branch contact:", crmErr);
          setErrorMessage("Contact person was created but could not be associated with the branch. Please try again.");
          setErrorOpen(true);
        }
      } catch (error) {
        console.error("Error creating customer contact:", error.response?.data || error);
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
          Add Contact
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
        onSuccess={() => {
          // Set flag to refresh contacts list when returning to the list view
          sessionStorage.setItem('contactAdded', 'true');
          
          // Force the browser to reload the previous page to ensure we get fresh data
          const returnURL = document.referrer;
          console.log('Navigating back to:', returnURL);
          
          // Use history.back() which will trigger the location change detection in ContactsTable
          window.history.back();
          
          // Add a fallback timeout to check if we need to force a refresh
          setTimeout(() => {
            if (sessionStorage.getItem('contactAdded') === 'true') {
              console.log('Contact flag still present, forcing reload');
              sessionStorage.removeItem('contactAdded');
              window.location.reload();
            }
          }, 1000);
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
