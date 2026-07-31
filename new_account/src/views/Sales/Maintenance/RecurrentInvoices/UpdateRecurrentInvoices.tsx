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
  FormControlLabel,
  Button,
  Paper,
  useMediaQuery,
  useTheme,
  ListSubheader,
} from "@mui/material";
import theme from "../../../../theme";
import { getRecurrentInvoice, updateRecurrentInvoice, getRecurrentInvoices } from "../../../../api/RecurrentInvoice/RecurrentInvoiceApi";
import { getSalesOrders } from "../../../../api/SalesOrders/SalesOrdersApi";
import { getCustomers } from "../../../../api/Customer/AddCustomerApi";
import { getSalesGroups } from "../../../../api/SalesMaintenance/salesService";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal"
import ErrorModal from "../../../../components/ErrorModal";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

interface RecurrentInvoiceData {
  description: string;
  template: string;
  customer: string;
  salesGroup: string;
  days: string;
  monthly: string;
  beginDate: string;
  endDate: string;
}

export default function UpdateRecurrentInvoices() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Recurrent invoices maintenance');

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState<RecurrentInvoiceData>({
    description: "",
    template: "",
    customer: "",
    salesGroup: "",
    days: "0",
    monthly: "0",
    beginDate: "",
    endDate: "",
  });

  const [templates, setTemplates] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [salesGroups, setSalesGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<Partial<RecurrentInvoiceData>>({});
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Fetch recurrent invoice data and dropdown options in parallel
        const [recurrentInvoiceRes, salesOrdersRes, customersRes, salesGroupsRes] = await Promise.all([
          getRecurrentInvoice(Number(id)),
          getSalesOrders(),
          getCustomers(),
          getSalesGroups(),
        ]);

        const filteredTemplates = (salesOrdersRes || []).filter((order: any) => order.type === 1);
        setTemplates(filteredTemplates);
        setCustomers(customersRes || []);
        setSalesGroups(salesGroupsRes || []);

        if (recurrentInvoiceRes) {
          setFormData({
            description: recurrentInvoiceRes.description,
            template: String(recurrentInvoiceRes.order_no),
            customer: String(recurrentInvoiceRes.debtor_no),
            salesGroup: String(recurrentInvoiceRes.group_no),
            days: String(recurrentInvoiceRes.days),
            monthly: String(recurrentInvoiceRes.monthly),
            beginDate: recurrentInvoiceRes.begin ? new Date(recurrentInvoiceRes.begin).toISOString().split('T')[0] : '',
            endDate: recurrentInvoiceRes.end ? new Date(recurrentInvoiceRes.end).toISOString().split('T')[0] : '',
          });
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setErrorMessage("Failed to load recurrent invoice data. Please try again.");
        setErrorOpen(true);
        navigate(-1);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

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

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData({ ...formData, [name]: checked });
  };

  const validate = () => {
    const newErrors: Partial<RecurrentInvoiceData> = {};
    if (!formData.description) newErrors.description = "Description is required";
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
      // Check if description already exists (excluding current invoice)
      const existingInvoices = await getRecurrentInvoices();
      const descriptionExists = existingInvoices.some(invoice => invoice.description.toLowerCase() === formData.description.toLowerCase() && invoice.id !== Number(id));
      if (descriptionExists) {
        setErrorMessage("This recurrent invoice description is already in use.");
        setErrorOpen(true);
        return;
      }

      const payload = {
        description: formData.description,
        order_no: parseInt(formData.template),
        debtor_no: formData.customer ? parseInt(formData.customer) : null,
        group_no: parseInt(formData.salesGroup),
        days: formData.days ? parseInt(formData.days) : null,
        monthly: formData.monthly ? parseInt(formData.monthly) : null,
        begin: formData.beginDate,
        end: formData.endDate,
        last_sent: formData.endDate,
      };

      const res = await updateRecurrentInvoice(Number(id), payload);
      setOpen(true);
      console.log("Updated:", res);
      queryClient.invalidateQueries({ queryKey: ["recurrentInvoices"], exact: false });
    } catch (err) {
      console.error("Failed to update Recurrent Invoice:", err);
      setErrorMessage("Failed to update Recurrent Invoice.");
      setErrorOpen(true);
    }
  };

  return (
    <FormPageLayout>
      {isLoading ? (
        <Typography>Loading...</Typography>
      ) : (
        <Paper
          sx={{
            p: theme.spacing(3),
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
            Update Recurrent Invoice
          </Typography>

          <Stack spacing={2}>
            <TextField
              label="Description"
              name="description"
              size="small"
              fullWidth
              value={formData.description}
              onChange={handleInputChange}
              error={!!errors.description}
              helperText={errors.description || " "}
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
              onClick={handleSubmit}
            >
              Update Recurrent Invoice
            </Button>
          </Box>
        </Paper>
      )}
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Recurrent Invoice has been updated!"
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
