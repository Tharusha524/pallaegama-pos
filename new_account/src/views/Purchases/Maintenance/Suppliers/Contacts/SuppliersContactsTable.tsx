import { FormPageLayout } from "../../../../../components/Layout/FormPageLayout";
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
import Breadcrumb from "../../../../../components/BreadCrumb";
import PageTitle from "../../../../../components/PageTitle";
import theme from "../../../../../theme";
import SearchBar from "../../../../../components/SearchBar";
import { getSupplierContacts, deleteSupplierContact } from "../../../../../api/Supplier/SupplierContactApi";
import ErrorModal from "../../../../../components/ErrorModal";
import DeleteConfirmationModal from "../../../../../components/DeleteConfirmationModal";
import { useAuth } from "../../../../../context/AuthContext";
interface SupplierContacsProps {
  supplierId?: string | number;
}

export default function SuppliersContactsTable({ supplierId }: SupplierContacsProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [contacts, setContacts] = useState<any[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Suppliers changes');

  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);


  // Fetch contacts (mock API)
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        // if supplierId is not provided don't call API and clear list
        if (!supplierId) {
          setContacts([]);
          return;
        }

        const data = await getSupplierContacts(supplierId); // fetch merged contacts
        // map to the same UI shape used by CustomersContactsTable
        const mapped = data.map((item: any) => ({
          id: item.id,
          reference: item.reference,
          fullName: item.name ? item.name : `${item.firstName || ""} ${item.lastName || ""}`.trim(),
          phone: item.phone || "",
          secPhone: item.phone2 || "",
          fax: item.fax || "",
          email: item.email || "",
          assignment: item.assignment || "",
          inactive: item.inactive,
        }));

        setContacts(mapped);
      } catch (error: any) {
        console.error("Failed to load contacts:", error);
        // optionally show error modal
      }
    };

    fetchContacts();
  }, [supplierId]);


  // Filter by inactive & search
  const filteredData = useMemo(() => {
    let data = showInactive ? contacts : contacts.filter((c) => !c.inactive);

    if (searchQuery.trim() !== "") {
      const lower = searchQuery.toLowerCase();
      data = data.filter(
        (c) =>
          c.assignment.toLowerCase().includes(lower) ||
          c.reference.toLowerCase().includes(lower) ||
          c.fullName.toLowerCase().includes(lower) ||
          c.phone.toLowerCase().includes(lower) ||
          c.secPhone.toLowerCase().includes(lower) ||
          c.fax.toLowerCase().includes(lower) ||
          c.email.toLowerCase().includes(lower)
      );
    }

    return data;
  }, [contacts, showInactive, searchQuery]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [page, rowsPerPage, filteredData]);

  const handleChangePage = (event: React.MouseEvent<HTMLButtonElement> | null, newPage: number) =>
    setPage(newPage);

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = (id: number) => {
    setSelectedId(id);
    setOpenDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (selectedId !== null) {
      try {
        await deleteSupplierContact(selectedId);
        setContacts((prev) => prev.filter((c) => c.id !== selectedId)); // remove from local list
        console.log("Contact deleted successfully!");
      } catch (error) {
        console.error("Failed to delete contact:", error);
      } finally {
        setOpenDeleteModal(false);
      }
    }
  };


  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Contacts" },
  ];

  return (
    <FormPageLayout>
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
          <PageTitle title="Contacts" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/purchase/maintenance/suppliers/add-supplier-contact", {
              state: { supplierId }
            })}
          >
            Add Contact
          </Button>

          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/purchase/maintenance/suppliers/")}
          >
            Back
          </Button>
        </Stack>
      </Box>
      {/* Checkbox & Search */}
      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={2}
        sx={{ px: 2, mb: 2, alignItems: "center", justifyContent: "space-between" }}
      >
        <FormControlLabel
          control={
            <Checkbox checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          }
          label="Show Also Inactive"
        />

        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Search Contacts"
          />
        </Box>
      </Stack>
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer component={Paper} elevation={2} sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}>
          <Table aria-label="contacts table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Assignment</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Full Name</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Sec Phone</TableCell>
                <TableCell>Fax</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((contact) => (
                  <TableRow key={contact.id} hover>
                    <TableCell>{contact.assignment}</TableCell>
                    <TableCell>{contact.reference}</TableCell>
                    <TableCell>{contact.fullName}</TableCell>
                    <TableCell>{contact.phone}</TableCell>
                    <TableCell>{contact.secPhone}</TableCell>
                    <TableCell>{contact.fax}</TableCell>
                    <TableCell>{contact.email}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => navigate(
                            `/purchase/maintenance/suppliers/update-supplier-contact/${contact.id}`
                          )}
                        >
                          Edit
                        </Button>
                        <Button
                          disabled={!canEdit}
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleDelete(contact.id)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2">No Records Found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  colSpan={8}
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
      <DeleteConfirmationModal
        open={openDeleteModal}
        title="Delete Contact"
        content="Are you sure you want to delete this contact? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setOpenDeleteModal(false)}
        deleteFunc={confirmDelete}
        onSuccess={() => console.log("Contact deleted successfully!")}
      />
    </FormPageLayout>
  );
}
