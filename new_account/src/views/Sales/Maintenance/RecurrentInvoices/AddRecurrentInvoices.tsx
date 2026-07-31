import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Checkbox,
  FormControlLabel,
  Button,
  Paper,
  useMediaQuery,
  useTheme,
  ListSubheader,
} from "@mui/material";
import theme from "../../../../theme";
import { createRecurrentInvoice, getRecurrentInvoices } from "../../../../api/RecurrentInvoice/RecurrentInvoiceApi";
import { getSalesOrders } from "../../../../api/SalesOrders/SalesOrdersApi";
import { getCustomers } from "../../../../api/Customer/AddCustomerApi";
import { getSalesGroups } from "../../../../api/SalesMaintenance/salesService";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

interface RecurrentInvoiceData {
  categoryName: string;
  template: string;
  customer: string;
  salesGroup: string;
  days: string;
  monthly: string;
  beginDate: string;
  endDate: string;
}

export default function AddRecurrentInvoices() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Recurrent invoices maintenance');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const currentDate = new Date();
  const endDateDefault = new Date(currentDate);
  endDateDefault.setFullYear(currentDate.getFullYear() + 5);

  const [formData, setFormData] = useState<RecurrentInvoiceData>({
    categoryName: "",
    template: "",
    customer: "",
    salesGroup: "",
    days: "0",
    monthly: "0",
    beginDate: currentDate.toISOString().split('T')[0],
    endDate: endDateDefault.toISOString().split('T')[0],
  });

  const [templates, setTemplates] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [salesGroups, setSalesGroups] = useState<any[]>([]);
  const [errors, setErrors] = useState<Partial<RecurrentInvoiceData>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all data in parallel
        const [salesOrdersRes, customersRes, salesGroupsRes] = await Promise.all([
          getSalesOrders(),
          getCustomers(),
          getSalesGroups(),
        ]);

        const filteredTemplates = (salesOrdersRes || []).filter((order: any) => order.type === 1);
        setTemplates(filteredTemplates);

        setCustomers(customersRes || []);

        setSalesGroups(salesGroupsRes || []);

        // Set default values for dropdowns
        setFormData((prev) => ({
          ...prev,
          template: filteredTemplates.length > 0 ? String(filteredTemplates[0].order_no) : "",
          customer: "",
          salesGroup: salesGroupsRes.length > 0 ? String(salesGroupsRes[0].id) : "",
        }));
      } catch (err) {
        console.error("Failed to fetch data:", err);
      }
    };
    fetchData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<RecurrentInvoiceData> = {};
    if (!formData.categoryName) newErrors.categoryName = "Description is required";
    if (!formData.template) newErrors.template = "Select Template";
    // if (!formData.customer) newErrors.customer = "Select Customer";
    if (!formData.salesGroup) newErrors.salesGroup = "Select Sales Group";

    if (formData.days && (isNaN(Number(formData.days)) || Number(formData.days) <= 0)) {
      newErrors.days = "No recurence interval has been entered.";
    }
    if (formData.monthly && isNaN(Number(formData.monthly))) {
      newErrors.monthly = "Monthly must be a number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      // Check if description already exists
      const existingInvoices = await getRecurrentInvoices();
      const descriptionExists = existingInvoices.some(invoice => invoice.description.toLowerCase() === formData.categoryName.toLowerCase());
      if (descriptionExists) {
        setErrorMessage("This recurrent invoice description is already in use.");
        setErrorOpen(true);
        return;
      }

      const payload = {
        description: formData.categoryName,
        order_no: parseInt(formData.template),
        debtor_no: formData.customer ? parseInt(formData.customer) : null,
        group_no: parseInt(formData.salesGroup),
        days: formData.days ? parseInt(formData.days) : null,
        monthly: formData.monthly ? parseInt(formData.monthly) : null,
        begin: formData.beginDate,
        end: formData.endDate,
        last_sent: formData.endDate,
      };

      const res = await createRecurrentInvoice(payload);
      // alert("Recurrent Invoice added successfully!");
      setOpen(true);
      console.log("Created:", res);
      queryClient.invalidateQueries({ queryKey: ["recurrentInvoices"], exact: false });
      //navigate("/itemsandinventory/maintenance/item-categories");
    } catch (err) {
      console.error("Failed to create Recurrent Invoice:", err);
      setErrorMessage("Failed to add Recurrent Invoice.");
      setErrorOpen(true);
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
          Add Recurrent Invoice
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Description"
            name="categoryName"
            size="small"
            fullWidth
            value={formData.categoryName}
            onChange={handleInputChange}
            error={!!errors.categoryName}
            helperText={errors.categoryName || " "}
          />

          <FormControl size="small" fullWidth error={!!errors.template}>
            <InputLabel>Template</InputLabel>
            <Select
              name="template"
              value={formData.template}
              onChange={handleSelectChange}
              label="Template"
            >
              {templates.map((temp) => (
                <MenuItem key={temp.order_no} value={String(temp.order_no)}>
                  {temp.order_no} - amount {temp.total}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.template || " "}</FormHelperText>
          </FormControl>

          <FormControl size="small" fullWidth error={!!errors.customer}>
            <InputLabel>Customer</InputLabel>
            <Select
              name="customer"
              value={formData.customer}
              onChange={handleSelectChange}
              label="Customer"
            >
              <MenuItem value="0">
                <em>None</em>
              </MenuItem>
              {customers.map((cust) => (
                <MenuItem key={cust.debtor_no} value={String(cust.debtor_no)}>
                  {cust.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.customer || " "}</FormHelperText>
          </FormControl>

          <FormControl size="small" fullWidth error={!!errors.salesGroup}>
            <InputLabel>Sales Group</InputLabel>
            <Select
              name="salesGroup"
              value={formData.salesGroup}
              onChange={handleSelectChange}
              label="Sales Group"
            >
              {salesGroups.map((sg) => (
                <MenuItem key={sg.id} value={String(sg.id)}>
                  {sg.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.salesGroup || " "}</FormHelperText>
          </FormControl>

          <FormattedNumberField
            label="Days"
            name="days"
            size="small"
            fullWidth
            value={formData.days}
            onChange={handleInputChange}
            error={!!errors.days}
            helperText={errors.days || " "}
          />

          <FormattedNumberField
            label="Monthly"
            name="monthly"
            size="small"
            fullWidth
            value={formData.monthly}
            onChange={handleInputChange}
            error={!!errors.monthly}
            helperText={errors.monthly || " "}
          />

          <TextField
            label="Begin Date"
            name="beginDate"
            type="date"
            size="small"
            fullWidth
            value={formData.beginDate}
            onChange={handleInputChange}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="End Date"
            name="endDate"
            type="date"
            size="small"
            fullWidth
            value={formData.endDate}
            onChange={handleInputChange}
            InputLabelProps={{ shrink: true }}
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
            Add Recurrent Invoice
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="New Recurrent Invoice has been added!"
        addFunc={async () => { }}
        handleClose={() => setOpen(false)}
        onSuccess={() => navigate("/sales/maintenance/recurrent-invoices")}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}