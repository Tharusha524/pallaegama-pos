import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useMemo, useEffect } from "react";
import {
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  TablePagination,
  Paper,
  Typography,
  useMediaQuery,
  Theme,
  Alert,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import SearchBar from "../../../../components/SearchBar";
import {
  getFiscalYears,
  deleteFiscalYear,
  runFiscalYearRollover,
} from "../../../../api/FiscalYear/FiscalYearApi";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

export default function FiscalYearTable() {
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [rolloverMessage, setRolloverMessage] = useState("");
  const [rolloverError, setRolloverError] = useState("");
  const [rolloverLoading, setRolloverLoading] = useState(false);
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Fiscal years maintenance');

  const formatFiscalDate = (dateValue: string) => {
    if (!dateValue) return "";
    const parts = dateValue.split("-");
    if (parts.length !== 3) return dateValue;

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (!year || !month || !day) return dateValue;

    // Build a local date (not UTC) so date-only values do not shift by timezone.
    return new Date(year, month - 1, day).toLocaleDateString();
  };

  const loadData = async () => {
    try {
      const data = await getFiscalYears();
      setFiscalYears(data);
    } catch (error) {
      console.error("Failed to fetch fiscal years:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return fiscalYears;
    const lower = searchQuery.toLowerCase();
    return fiscalYears.filter((fy) => {
      const from = formatFiscalDate(fy.fiscal_year_from);
      const to = formatFiscalDate(fy.fiscal_year_to);
      const closed = fy.closed ? "yes" : "no";
      return (
        from.toLowerCase().includes(lower) ||
        to.toLowerCase().includes(lower) ||
        closed.includes(lower)
      );
    });
  }, [fiscalYears, searchQuery]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  const handleChangePage = (
    _event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => setPage(newPage);

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await deleteFiscalYear(selectedId);
      setFiscalYears((prev) => prev.filter((fy) => fy.id !== selectedId));
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to delet fiscal year Please try again."
      );
      setErrorOpen(true);
      console.error("Error deleting fiscal year:", error);
    } finally {
      setOpenDeleteModal(false);
      setSelectedId(null);
    }
  };

  const handleRollover = async () => {
    setRolloverLoading(true);
    setRolloverMessage("");
    setRolloverError("");
    try {
      const result = await runFiscalYearRollover();
      setRolloverMessage(result?.message || "Fiscal year rollover completed.");
      await loadData();
    } catch (error: any) {
      setRolloverError(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to run fiscal year rollover."
      );
    } finally {
      setRolloverLoading(false);
    }
  };

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Fiscal Years" },
  ];

  return (
    <FormPageLayout>
      {/* Header */}
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
          <PageTitle title="Fiscal Years" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            onClick={() => void handleRollover()}
            disabled={rolloverLoading}
          >
            {rolloverLoading ? "Running..." : "Run Year-End Rollover"}
          </Button>

          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/setup/companysetup/add-fiscal-year")}
          >
            Add Fiscal Year
          </Button>

          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/setup/companysetup")}
          >
            Back
          </Button>
        </Stack>
      </Box>
      {rolloverMessage && (
        <Alert severity="success" sx={{ mx: 2 }} onClose={() => setRolloverMessage("")}>
          {rolloverMessage}
        </Alert>
      )}
      {rolloverError && (
        <Alert severity="error" sx={{ mx: 2 }} onClose={() => setRolloverError("")}>
          {rolloverError}
        </Alert>
      )}
      <Alert severity="info" sx={{ mx: 2 }}>
        When a fiscal year end date passes, the system can automatically close that year,
        post year-end GL entries, create the next fiscal year, and update company setup.
        This also runs daily at 00:15 via the server scheduler, or click Run Year-End Rollover now.
      </Alert>
      {/* Search Bar */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          px: 2,
          mb: 2,
          width: "100%",
          maxWidth: isMobile ? "88vw" : "100%",
        }}
      >
        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Search Fiscal Years..."
          />
        </Box>
      </Box>
      {/* Table */}
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer
          component={Paper}
          elevation={2}
          sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}
        >
          <Table aria-label="fiscal years table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>No</TableCell>
                <TableCell>Fiscal Year Begin</TableCell>
                <TableCell>Fiscal Year End</TableCell>
                <TableCell>Is Closed</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((fy, index) => (
                  <TableRow key={fy.id} hover>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>
                      {formatFiscalDate(fy.fiscal_year_from)}
                    </TableCell>
                    <TableCell>
                      {formatFiscalDate(fy.fiscal_year_to)}
                    </TableCell>
                    <TableCell>{fy.closed ? "Yes" : "No"}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() =>
                            navigate(
                              `/setup/companysetup/update-fiscal-year/${fy.id}`
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
                            setSelectedId(fy.id);
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
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2">No Records Found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  colSpan={5}
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
      {/* ✅ Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={openDeleteModal}
        title="Delete Fiscal Year"
        content="Are you sure you want to delete this Fiscal Year? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setSelectedId(null)}
        deleteFunc={handleDelete}
        onSuccess={() => {
          console.log("Fiscal year deleted successfully!");
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
