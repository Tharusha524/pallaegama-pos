import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect, useMemo } from "react";
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
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import SearchBar from "../../../../components/SearchBar";
import theme from "../../../../theme";
import {
  getCreditStatusSetups,
  updateCreditStatusSetup,
  deleteCreditStatusSetup,
} from "../../../../api/CreditStatusSetup/CreditStatusSetupApi";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

export default function CreditStatusTable() {
  const [creditStatuses, setCreditStatuses] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Credit status definitions changes');

  const loadData = async () => {
    try {
      const data = await getCreditStatusSetups();
      setCreditStatuses(data);
    } catch (error) {
      console.error("Failed to fetch credit statuses:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    let data = showInactive ? creditStatuses : creditStatuses.filter((item) => !item.inactive);

    if (searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase();
      data = data.filter(
        (item) =>
          item.reason_description.toLowerCase().includes(lowerQuery) ||
          (item.disallow_invoices ? "Yes" : "No").toLowerCase().includes(lowerQuery)
      );
    }

    return data;
  }, [creditStatuses, searchQuery, showInactive]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await deleteCreditStatusSetup(selectedId);
      setOpenDeleteModal(false);
      setSelectedId(null);
      loadData();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to delete Credit Status Please try again."
      );
      setErrorOpen(true);
    }
  };

  const handleToggleInactive = async (item: any) => {
    if (!item || item.id == null) return;

    const updatedValue = !item.inactive;

    // Optimistic update
    setCreditStatuses((prev) => prev.map((c) => (c.id === item.id ? { ...c, inactive: updatedValue } : c)));

    try {
      // send inactive as 1 or 0 to backend
      await updateCreditStatusSetup(item.id, { ...item, inactive: updatedValue ? 1 : 0 });
    } catch (error: any) {
      // Revert on error
      setCreditStatuses((prev) => prev.map((c) => (c.id === item.id ? { ...c, inactive: !!item.inactive } : c)));
      setErrorMessage(error?.response?.data?.message || "Failed to update inactive state. Please try again.");
      setErrorOpen(true);
    }
  };

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Credit Status" },
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
          <PageTitle title="Credit Status" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/sales/maintenance/credit-status-setup/add-credit-status")}
          >
            Add Credit Status
          </Button>

          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Back
          </Button>
        </Stack>
      </Box>
      {/* Search + Show Inactive */}
      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={2}
        sx={{ px: 2, mb: 2, alignItems: "center", justifyContent: "space-between" }}
      >
        <FormControlLabel
          control={<Checkbox checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />}
          label="Show Also Inactive"
        />
        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Search Description or Disallow Invoices" />
        </Box>
      </Stack>
      {/* Table */}
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer component={Paper} elevation={2} sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}>
          <Table aria-label="credit status table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>No</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Disallow Invoices</TableCell>
                {showInactive && <TableCell align="center">Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((item, index) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{item.reason_description}</TableCell>
                    <TableCell>{item.disallow_invoices ? "Yes" : "No"}</TableCell>
                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={!!item.inactive}
                          onChange={() => handleToggleInactive(item)}
                          inputProps={{ 'aria-label': `inactive-checkbox-${item.id}` }}
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
                            navigate(`/sales/maintenance/credit-status-setup/update-credit-status/${item.id}`)
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
                            setSelectedId(item.id);
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
                  <TableCell colSpan={showInactive ? 5 : 4} align="center">
                    <Typography variant="body2">No Records Found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  colSpan={showInactive ? 5 : 4}
                  count={filteredData.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  showFirstButton
                  showLastButton
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      </Stack>
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={openDeleteModal}
        title="Delete Credit Status"
        content="Are you sure you want to delete this Credit Status? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setSelectedId(null)}
        deleteFunc={handleDelete}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}
