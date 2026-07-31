import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TableFooter,
  TablePagination,
  TableRow as MuiTableRow,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PrintIcon from "@mui/icons-material/Print";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import { getRecurrentInvoices, generateAllDueRecurrentInvoices } from "../../../../api/RecurrentInvoice/RecurrentInvoiceApi";
import { getSalesGroups } from "../../../../api/SalesMaintenance/salesService";
import { getCustomers } from "../../../../api/Customer/AddCustomerApi";
import { resolveTransactionCurrencyCode } from "../../../../utils/relationId";
import { useMessageDialog } from "../../../../context/MessageDialogContext";
import { useAuth } from "../../../../context/AuthContext";

export default function CreateAndPrintRecurrentInvoices() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Recurrent invoices definitions');
  const breadcrumbItems = [
    { title: "Transactions", href: "/sales/transactions/" },
    { title: "Recurrent Invoices" },
  ];

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showError } = useMessageDialog();
  const [generatingAll, setGeneratingAll] = useState(false);

  const { data: recurrentInvoices = [] } = useQuery({
    queryKey: ["recurrentInvoices"],
    queryFn: getRecurrentInvoices,
  });

  const { data: salesGroups = [] } = useQuery({
    queryKey: ["salesGroups"],
    queryFn: getSalesGroups,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const paginatedInvoices = useMemo(() => {
    if (rowsPerPage === -1) return recurrentInvoices;
    return recurrentInvoices.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [recurrentInvoices, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  const calculateNextInvoiceDate = (
    begin: string,
    monthly: number,
    days: number,
    lastSent?: string | null,
    end?: string | null
  ) => {
    if (!begin) return "Not set";

    const base = lastSent ? new Date(`${lastSent}T00:00:00`) : new Date(`${begin}T00:00:00`);
    if (isNaN(base.getTime())) return "Not set";

    const next = new Date(base);
    next.setMonth(next.getMonth() + (monthly || 0));
    next.setDate(next.getDate() + (days || 0));

    const result = next.toISOString().split("T")[0];
    if (end && result > String(end).split(" ")[0]) return "Expired";
    return result;
  };

  const handlePrint = (invoice: {
    last_invoice_reference?: string | null;
    last_invoice_trans_no?: number | null;
  }) => {
    const reference = String(invoice.last_invoice_reference ?? "").trim();
    if (!reference) {
      showError(
        "No invoice has been generated for this recurrent template yet. Use Create Invoice first.",
        "Nothing to print"
      );
      return;
    }
    navigate("/sales/transactions/direct-invoice/view-direct-invoice", {
      state: {
        reference,
        transNo: invoice.last_invoice_trans_no,
        autoPrint: true,
      },
    });
  };

  const handleGenerateAllDue = async () => {
    setGeneratingAll(true);
    try {
      const result = await generateAllDueRecurrentInvoices(new Date().toISOString().split("T")[0]);
      await queryClient.invalidateQueries({ queryKey: ["recurrentInvoices"] });
      alert(`Generated ${result.generated ?? 0} recurrent invoice(s).`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Failed to generate due recurrent invoices.");
    } finally {
      setGeneratingAll(false);
    }
  };

  return (
    <FormPageLayout>
      <Box sx={{ padding: theme.spacing(2), boxShadow: 2, borderRadius: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <Box>
          <PageTitle title="Create and Print Recurrent Invoices" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button variant="contained" disabled={generatingAll || !canEdit} onClick={handleGenerateAllDue}>
            Generate All Due
          </Button>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Back
          </Button>
        </Stack>
      </Box>
      <TableContainer component={Paper} sx={{ p: 1 }}>
        <Table>
          <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
            <TableRow>
              <TableCell>Description</TableCell>
              <TableCell>Template No</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Currency</TableCell>
              <TableCell>Branch/Group</TableCell>
              <TableCell>Days</TableCell>
              <TableCell>Monthly</TableCell>
              <TableCell>Begin</TableCell>
              <TableCell>End</TableCell>
              <TableCell>Next invoice</TableCell>
              <TableCell align="center">Action</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {paginatedInvoices.length > 0 ? (
              paginatedInvoices.map((invoice) => (
                <TableRow key={invoice.id} hover>
                  <TableCell>{invoice.description}</TableCell>
                  <TableCell>{invoice.order_no}</TableCell>
                  <TableCell>{customers.find(c => c.debtor_no === invoice.debtor_no)?.name || (invoice.debtor_no ? invoice.debtor_no : '')}</TableCell>
                  <TableCell>
                    {resolveTransactionCurrencyCode(
                      customers.find((c) => c.debtor_no === invoice.debtor_no)
                    )}
                  </TableCell>
                  <TableCell>{salesGroups.find(g => g.id === invoice.group_no)?.name || invoice.group_no}</TableCell>
                  <TableCell>{invoice.days}</TableCell>
                  <TableCell>{invoice.monthly}</TableCell>
                  <TableCell>{invoice.begin ? new Date(invoice.begin).toISOString().split('T')[0] : ''}</TableCell>
                  <TableCell>{invoice.end ? new Date(invoice.end).toISOString().split('T')[0] : ''}</TableCell>
                  <TableCell>{calculateNextInvoiceDate(invoice.begin, invoice.monthly, invoice.days, invoice.last_sent, invoice.end)}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() =>
                          navigate(`/sales/maintenance/create-recurrent-invoices/${invoice.id}`)
                        }
                      >
                        Create Invoice
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<PrintIcon />}
                        disabled={!invoice.last_invoice_reference}
                        onClick={() => handlePrint(invoice)}
                      >
                        Print
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  <Typography variant="body2">No Recurrent Invoices Found</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>

          <TableFooter>
            <MuiTableRow>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                colSpan={11}
                count={recurrentInvoices.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </MuiTableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </FormPageLayout>
  );
}
