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
  getShippingCompanies,
  deleteShippingCompany,
  updateShippingCompany,
} from "../../../../api/ShippingCompany/ShippingCompanyApi";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

export default function ShippingCompanyTable() {
  const [page, setPage] = useState(0);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [companies, setCompanies] = useState<any[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Shipping ways');

  // Fetch data
  useEffect(() => {
    getShippingCompanies().then((data) => setCompanies(data));
  }, []);

  const filteredData = useMemo(() => {
    let data = showInactive ? companies : companies.filter((c) => !c.inactive);

    if (searchQuery.trim() !== "") {
      const lower = searchQuery.toLowerCase();
      data = data.filter(
        (c) =>
          c.shipper_name.toLowerCase().includes(lower) ||
          c.contact.toLowerCase().includes(lower) ||
          c.phone.toLowerCase().includes(lower) ||
          c.phone2.toLowerCase().includes(lower) ||
          c.address.toLowerCase().includes(lower)
      );
    }

    return data;
  }, [companies, showInactive, searchQuery]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [page, rowsPerPage, filteredData]);

  const columnsCount = showInactive ? 7 : 6;

  const handleToggleInactive = async (company: any) => {
    const id = company.shipper_id;
    if (!id) return;

    const newValue = !company.inactive;

    // Optimistic update
    setCompanies((prev) =>
      prev.map((c) => (c.shipper_id === id ? { ...c, inactive: newValue } : c))
    );

    try {
      // send update - re-use entire company object with updated inactive flag
      await updateShippingCompany(id, { ...company, inactive: newValue });
    } catch (error) {
      // rollback
      setCompanies((prev) => prev.map((c) => (c.shipper_id === id ? { ...c, inactive: company.inactive } : c)));
      setErrorMessage(
        error?.response?.data?.message || "Failed to update inactive flag. Please try again."
      );
      setErrorOpen(true);
      console.error("Error updating inactive flag for shipping company:", error);
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
    if (!selectedCompanyId) return;

    try {
      await deleteShippingCompany(selectedCompanyId);
      setCompanies((prev) => prev.filter((c) => c.shipper_id !== selectedCompanyId));
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to delete shipping company Please try again."
      );
      setErrorOpen(true);
      console.error("Error deleting shipping company:", error);
    } finally {
      setOpenDeleteModal(false);
      setSelectedCompanyId(null);
    }
  };

  const breadcrumbItems = [
    { title: "Miscellaneous", href: "/setup/miscellaneous" },
    { title: "Shipping Companies" },
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
          <PageTitle title="Shipping Companies" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() =>
              navigate("/setup/miscellaneous/add-shipping-company")
            }
          >
            Add Company
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
      {/* Search + Filter */}
      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={2}
        sx={{
          px: 2,
          mb: 2,
          alignItems: "center",
          justifyContent: "space-between",
        }}
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
            placeholder="Search Name, Contact, Phone, Address"
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
          <Table aria-label="shipping companies table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Contact Person</TableCell>
                <TableCell>Phone Number</TableCell>
                <TableCell>Secondary Phone</TableCell>
                <TableCell>Address</TableCell>
                {showInactive && <TableCell align="center">Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((company, index) => (
                  <TableRow key={company.shipper_id ?? index} hover>
                    <TableCell>{company.shipper_name}</TableCell>
                    <TableCell>{company.contact}</TableCell>
                    <TableCell>{company.phone}</TableCell>
                    <TableCell>{company.phone2}</TableCell>
                    <TableCell>{company.address}</TableCell>
                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={Boolean(company.inactive)}
                          onChange={() => handleToggleInactive(company)}
                          inputProps={{ 'aria-label': `inactive-${company.shipper_id}` }}
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
                              `/setup/miscellaneous/update-shipping-company/${company.shipper_id}`
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
                            setSelectedCompanyId(company.shipper_id);
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
        title="Delete Shipping Company"
        content="Are you sure you want to delete this shipping company? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setSelectedCompanyId(null)}
        deleteFunc={handleDelete}
        onSuccess={() => {
          console.log("Shipping Company deleted successfully!");
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
