import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
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
import { generateRecurrentInvoice, getRecurrentInvoices } from "../../../../api/RecurrentInvoice/RecurrentInvoiceApi";
import { getDebtorTrans } from "../../../../api/DebtorTrans/DebtorTransApi";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import useFormPersist from "../../../../hooks/useFormPersist";
import { getFriendlyApiErrorMessage } from "../../../../utils/apiErrorMessage";
import { useAuth } from "../../../../context/AuthContext";

interface InvoiceFormData {
  name: string;
  template: string;
  numberOfInvoiced: string;
  invoiceDate: string;
  invoiceNotice: string;
}

export default function CreateInvoice() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Recurrent invoices maintenance');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch all recurrent invoices to find the specific one
  const { data: recurrentInvoices = [], isLoading } = useQuery({
    queryKey: ["recurrentInvoices"],
    queryFn: getRecurrentInvoices,
  });
  const { data: debtorTrans = [] } = useQuery({
    queryKey: ["debtorTrans"],
    queryFn: getDebtorTrans,
  });

  // Find the specific invoice based on the ID from URL
  const selectedInvoice = recurrentInvoices.find(invoice => invoice.id === parseInt(id || '0'));

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [generatedReference, setGeneratedReference] = useState<string | null>(null);
  const [formData, setFormData, clearFormData] = useFormPersist<InvoiceFormData>(
    `invoice-form-${id || 'new'}`,  // unique key for this form based on invoice ID
    { 
      name: "",
      template: "",
      numberOfInvoiced: "",
      invoiceDate: "",
      invoiceNotice: ""
    }
  );
  const [error, setError] = useState<string>("");
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  // Populate form data when invoice is loaded
  useEffect(() => {
    if (selectedInvoice) {
      const invoicedCount = (debtorTrans || []).filter(
        (dt: any) =>
          Number(dt.trans_type) === 10 &&
          String(dt.comments ?? "").includes(`Recurrent: ${selectedInvoice.description}`)
      ).length;
      setFormData({
        name: selectedInvoice.description || "",
        template: selectedInvoice.order_no || "",
        numberOfInvoiced: String(invoicedCount),
        invoiceDate: new Date().toISOString().split("T")[0],
        invoiceNotice: "",
      });
    }
  }, [selectedInvoice, debtorTrans, setFormData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const validate = () => {
    if (!formData.name.trim()) {
      setError("Name is required");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async () => {
    if (!validate() || !id) {
      return;
    }
    try {
      const result = await generateRecurrentInvoice(Number(id), formData.invoiceDate);
      queryClient.invalidateQueries({ queryKey: ["recurrentInvoices"] });
      queryClient.invalidateQueries({ queryKey: ["debtorTrans"] });
      clearFormData();
      setGeneratedReference(result?.reference ?? null);
      setOpen(true);
    } catch (error: unknown) {
      console.error(error);
      setErrorMessage(getFriendlyApiErrorMessage(error));
      setErrorOpen(true);
    }
  };

  return (
    <FormPageLayout>
      {isLoading ? (
        <Typography>Loading invoice data...</Typography>
      ) : !selectedInvoice ? (
        <Typography color="error">Invoice not found. Please check the URL and try again.</Typography>
      ) : (
        <Paper
          sx={{
            p: theme.spacing(3),
            maxWidth: "500px",
            width: "100%",
            boxShadow: 2,
            borderRadius: 2,
          }}
        >
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Create Invoice
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Description"
            name="name"
            size="small"
            fullWidth
            value={formData.name}
            onChange={handleInputChange}
            error={!!error}
            helperText={error}
            InputProps={{
              readOnly: true,
            }}
          />

          <TextField
            label="Template"
            name="template"
            size="small"
            fullWidth
            value={formData.template}
            onChange={handleInputChange}
            InputProps={{
              readOnly: true,
            }}
          />

          <TextField
            label="Number of Invoiced"
            name="numberOfInvoiced"
            size="small"
            fullWidth
            value={formData.numberOfInvoiced}
            onChange={handleInputChange}
            InputProps={{
              readOnly: true,
            }}
          />

          <TextField
            label="Invoice Date"
            name="invoiceDate"
            type="date"
            size="small"
            fullWidth
            value={formData.invoiceDate}
            onChange={handleInputChange}
            InputLabelProps={{
              shrink: true,
            }}
          />

          <TextField
            label="Invoice Notice"
            name="invoiceNotice"
            size="small"
            fullWidth
            multiline
            rows={3}
            value={formData.invoiceNotice}
            onChange={handleInputChange}
          />
        </Stack>

        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 2 : 0, }}>
          <Button onClick={() => {
            // Ask user if they want to save the data for later or discard it
            const hasData = formData.name || formData.template || formData.numberOfInvoiced || formData.invoiceDate || formData.invoiceNotice;
            if (hasData && !confirm("Do you want to save your progress for later?")) {
              clearFormData();
            }
            navigate(-1);
          }}>Back</Button>

          <Button disabled={!canEdit}
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            Create Invoice
          </Button>
        </Box>
      </Paper>
      )}
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Invoice has been created successfully!"
        addFunc={async () => { }}
        handleClose={() => setOpen(false)}
        onSuccess={() => {
          if (generatedReference) {
            navigate("/sales/transactions/direct-invoice/view-direct-invoice", {
              state: { reference: generatedReference, autoPrint: true },
            });
          } else {
            window.history.back();
          }
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
