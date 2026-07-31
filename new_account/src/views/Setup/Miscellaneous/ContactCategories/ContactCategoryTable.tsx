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
  getContactCategories,
  deleteContactCategory,
} from "../../../../api/ContactCategory/ContactCategoryApi";
import { updateContactCategory } from "../../../../api/ContactCategory/ContactCategoryApi";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

export default function ContactCategoryTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [categories, setCategories] = useState<any[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Contact categories');

  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getContactCategories();
        setCategories(data);
      } catch (error) {
        console.error("Failed to load contact categories:", error);
        setErrorMessage("Failed to load contact categories.");
        setErrorOpen(true);
      }
    };
    fetchData();
  }, []);

  // Filter data
  const filteredData = useMemo(() => {
    let data = showInactive ? categories : categories.filter((c) => !c.inactive);

    if (searchQuery.trim() === "") return data;

    const lower = searchQuery.toLowerCase();
    return data.filter(
      (c) =>
        c.type?.toLowerCase().includes(lower) ||
        c.subtype?.toLowerCase().includes(lower) ||
        c.name?.toLowerCase().includes(lower) ||
        c.description?.toLowerCase().includes(lower) ||
        c.id?.toString().includes(lower)
    );
  }, [categories, searchQuery, showInactive]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [page, rowsPerPage, filteredData]);

  const columnsCount = showInactive ? 6 : 5;

  const handleToggleInactive = async (cat: any) => {
    const id = cat.id;
    if (!id) return;

    const newValue = !cat.inactive;

    // optimistic update
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, inactive: newValue } : c)));

    const payload = {
      type: cat.type,
      subtype: cat.subtype,
      name: cat.name,
      description: cat.description,
      systm: cat.systm,
      inactive: newValue,
    };

    try {
      await updateContactCategory(id, payload);
    } catch (error: any) {
      // rollback
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, inactive: cat.inactive } : c)));
      console.error("Error updating inactive flag for contact category:", error);
      setErrorMessage(
        error?.response?.data?.message || "Failed to update inactive flag. Please try again."
      );
      setErrorOpen(true);
    }
  };

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

  // Handle Delete
  const handleDelete = async (id: number) => {
    try {
      await deleteContactCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (error: any) {
      console.error("Error deleting category:", error);
      setErrorMessage(
        error?.response?.data?.message || "Failed to delete contact category."
      );
      setErrorOpen(true);
    } finally {
      setOpenDeleteModal(false);
      setSelectedCategoryId(null);
    }
  };

  const breadcrumbItems = [
    { title: "Miscellaneous", href: "/setup/miscellaneous" },
    { title: "Contact Categories" },
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
          <PageTitle title="Contact Categories" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/setup/miscellaneous/add-contact-category")}
          >
            Add Category
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
      {/* Search */}
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
            placeholder="Search Categories"
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
          <Table aria-label="contact categories table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                  {/* <TableCell>#</TableCell> */}
                  <TableCell>Category Type</TableCell>
                  <TableCell>Category Sub Type</TableCell>
                  <TableCell>Short Name</TableCell>
                  <TableCell>Description</TableCell>
                  {showInactive && <TableCell align="center">Inactive</TableCell>}
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((cat) => (
                  <TableRow key={cat.id} hover>
                    {/* <TableCell>{cat.id}</TableCell> */}
                      <TableCell>{cat.type}</TableCell>
                      <TableCell>{cat.subtype}</TableCell>
                      <TableCell>{cat.name}</TableCell>
                      <TableCell>{cat.description}</TableCell>
                      {showInactive && (
                        <TableCell align="center">
                          <Checkbox
                            checked={Boolean(cat.inactive)}
                            onChange={() => handleToggleInactive(cat)}
                            inputProps={{ "aria-label": `inactive-${cat.id}` }}
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
                              `/setup/miscellaneous/update-contact-category/${cat.id}`
                            )
                          }
                        >
                          Edit
                        </Button>


                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => {
                            // Only allow click if systm is 0
                            if (!cat.systm) {
                              setSelectedCategoryId(cat.id);
                              setOpenDeleteModal(true);
                            }
                          }}
                          disabled={!!cat.systm || !canEdit} // true if systm is 1
                          sx={{
                            pointerEvents: cat.systm ? "none" : "auto", // ensures no hover/click
                            opacity: cat.systm ? 0.5 : 1, // grayed out
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
        title="Delete Contact Category"
        content="Are you sure you want to delete this Contact Category? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setSelectedCategoryId(null)}
        deleteFunc={() =>
          selectedCategoryId !== null && handleDelete(selectedCategoryId)
        }
        onSuccess={() => console.log("Contact Category deleted successfully!")}
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
