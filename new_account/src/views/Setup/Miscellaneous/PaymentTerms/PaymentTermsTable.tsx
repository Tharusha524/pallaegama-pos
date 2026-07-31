import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import {
  Box,
  Button,
  Stack,
  TableFooter,
  TablePagination,
  Typography,
  useMediaQuery,
  Theme,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { useMemo, useState, useEffect } from "react";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import SearchBar from "../../../../components/SearchBar";
import {
  getPaymentTerms,
  deletePaymentTerm,
} from "../../../../api/PaymentTerm/PaymentTermApi";
import { updatePaymentTerm } from "../../../../api/PaymentTerm/PaymentTermApi";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

export default function PaymentTermsTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Payment terms');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getPaymentTerms();
        setPaymentTerms(data);
      } catch (error) {
        console.error("Error fetching payment terms:", error);
        setErrorMessage("Failed to fetch payment terms. Please try again.");
        setErrorOpen(true);
      }
    };
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    let data = showInactive ? paymentTerms : paymentTerms.filter((p) => !p.inactive);

    if (searchQuery.trim() !== "") {
      const lower = searchQuery.toLowerCase();
      data = data.filter(
        (p) =>
          p.description?.toLowerCase().includes(lower) ||
          p.payment_type?.name?.toLowerCase().includes(lower) ||
          String(p.days_before_due)?.toLowerCase().includes(lower) ||
          String(p.day_in_following_month)?.toLowerCase().includes(lower)
      );
    }

    return data;
  }, [paymentTerms, showInactive, searchQuery]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [page, rowsPerPage, filteredData]);

  // columns: Description, Type, DueAfter/DayInFollowingMonth, (optional Inactive), Actions
  const columnsCount = showInactive ? 5 : 4;

  const handleToggleInactive = async (term: any) => {
    const id = term.terms_indicator;
    if (!id) return;

    const newValue = !term.inactive;

    // Optimistic update
    setPaymentTerms((prev) =>
      prev.map((p) => (p.terms_indicator === id ? { ...p, inactive: newValue } : p))
    );

    // Build payload compatible with the update endpoint.
    // The API expects `payment_type` as an ID (number), not a nested object.
    const payment_type = (() => {
      const pt = term.payment_type;
      if (pt == null) return null;
      if (typeof pt === "number") return pt;
      // try common id fields
      return pt.id ?? pt.payment_type ?? null;
    })();

    const payload: any = {
      description: term.description ?? "",
      payment_type,
      days_before_due: term.days_before_due ?? 0,
      day_in_following_month: term.day_in_following_month ?? 0,
      inactive: newValue,
    };

    try {
      await updatePaymentTerm(id, payload);
    } catch (error: any) {
      // rollback
      setPaymentTerms((prev) =>
        prev.map((p) => (p.terms_indicator === id ? { ...p, inactive: term.inactive } : p))
      );
      console.error("Error updating inactive flag for payment term:", error);
      setErrorMessage(
        error?.response?.data?.message || "Failed to update inactive flag. Please try again."
      );
      setErrorOpen(true);
    }
  };

  const handleChangePage = (
    event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => setPage(newPage);

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = async () => {
    if (!selectedTermId) return;

    try {
      await deletePaymentTerm(selectedTermId);
      setPaymentTerms((prev) =>
        prev.filter((p) => p.terms_indicator !== selectedTermId)
      );
    } catch (error: any) {
      console.error("Error deleting payment term:", error);
      setErrorMessage(
        error?.response?.data?.message ||
          "Failed to delete payment term. Please try again."
      );
      setErrorOpen(true);
    } finally {
      setOpenDeleteModal(false);
      setSelectedTermId(null);
    }
  };

  const breadcrumbItems = [
    { title: "Miscellaneous", href: "/setup/miscellaneous" },
    { title: "Payment Terms" },
  ];

  return (
    <FormPageLayout>
      {/* Header Section */}
      <Box
        sx={{
          padding: theme.spacing(2),
          boxShadow: 2,
          marginY: 2,
          borderRadius: 1,
          overflowX: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <PageTitle title="Payment Terms" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/setup/miscellaneous/add-payment-term")}
          >
            Add Payment Term
          </Button>

          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/setup/miscellaneous")}
          >
            Back
          </Button>
        </Stack>
      </Box>
      {/* Filters */}
      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={2}
        sx={{ px: 2, mb: 2, alignItems: "center", justifyContent: "space-between" }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
          }
          label="Show Also Inactive"
        />

        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Search Description, Type, Due After"
          />
        </Box>
      </Stack>
      {/* Table */}
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer
          component={Paper}
          elevation={2}
          sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}
        >
          <Table aria-label="payment terms table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Description</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Due After / Day in Following Month</TableCell>
                {showInactive && <TableCell align="center">Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((term) => (
                  <TableRow key={term.terms_indicator} hover>
                    <TableCell>{term?.description ?? "-"}</TableCell>
                    <TableCell>{term?.payment_type?.name ?? "-"}</TableCell>
                    <TableCell>
                      {term?.days_before_due || term?.day_in_following_month
                        ? term.days_before_due || term.day_in_following_month
                        : "-"}
                    </TableCell>
                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={Boolean(term.inactive)}
                          onChange={() => handleToggleInactive(term)}
                          inputProps={{ 'aria-label': `inactive-${term.terms_indicator}` }}
                        />
                      </TableCell>
                    )}
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() =>
                            navigate(
                              `/setup/miscellaneous/update-payment-term/${term.terms_indicator}`
                            )
                          }
                        >
                          Edit
                        </Button>
                        <Button
                          disabled={!canEdit}
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => {
                            setSelectedTermId(term.terms_indicator);
                            setOpenDeleteModal(true);
                          }}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columnsCount} align="center">
                    <Typography variant="body2">No Records Found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  colSpan={columnsCount}
                  count={filteredData.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  showFirstButton
                  showLastButton
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      </Stack>
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={openDeleteModal}
        title="Delete Payment Term"
        content="Are you sure you want to delete this Payment Term? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setSelectedTermId(null)}
        deleteFunc={handleDelete}
        onSuccess={() => console.log("Payment Term deleted successfully!")}
      />
      {/* Error Modal */}
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}
