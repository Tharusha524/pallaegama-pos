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
  getItemTaxTypes,
  deleteItemTaxType,
} from "../../../../api/ItemTaxType/ItemTaxTypeApi";
import { updateItemTaxType } from "../../../../api/ItemTaxType/ItemTaxTypeApi";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

export default function ItemTaxTypesTable() {
  const [itemTaxTypes, setItemTaxTypes] = useState<any[]>([]);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Item tax type definitions');

  const loadData = async () => {
    try {
      const data = await getItemTaxTypes();
      setItemTaxTypes(data);
    } catch (error) {
      console.error("Failed to fetch Item Tax Types:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    let data = showInactive ? itemTaxTypes : itemTaxTypes.filter((t) => !t.inactive);
    if (searchQuery.trim() !== "") {
      const lower = searchQuery.toLowerCase();
      data = data.filter(
        (t) =>
          t.name?.toLowerCase().includes(lower) ||
          (t.exempt ? "yes" : "no").includes(lower)
      );
    }
    return data;
  }, [itemTaxTypes, showInactive, searchQuery]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [page, rowsPerPage, filteredData]);

  const columnsCount = showInactive ? 4 : 3;

  const handleToggleInactive = async (item: any) => {
    const id = item.id;
    if (!id) return;

    const newValue = !item.inactive;

    // optimistic update
    setItemTaxTypes((prev) => prev.map((i) => (i.id === id ? { ...i, inactive: newValue } : i)));

    const payload = {
      name: item.name,
      exempt: item.exempt,
      inactive: newValue,
    };

    try {
      await updateItemTaxType(id, payload);
    } catch (error: any) {
      // rollback
      setItemTaxTypes((prev) => prev.map((i) => (i.id === id ? { ...i, inactive: item.inactive } : i)));
      setErrorMessage(
        error?.response?.data?.message || "Failed to update inactive flag. Please try again."
      );
      setErrorOpen(true);
      console.error("Error updating inactive flag for item tax type:", error);
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
    if (!selectedId) return;
    try {
      await deleteItemTaxType(selectedId);
      setItemTaxTypes((prev) => prev.filter((i) => i.id !== selectedId));
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to delete item tax type Please try again."
      );
      setErrorOpen(true);

    } finally {
      setOpenDeleteModal(false);
      setSelectedId(null);
    }
  };

  const breadcrumbItems = [
    { title: "Company Setup", href: "/setup/companysetup" },
    { title: "Item Tax Types" },
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
          <PageTitle title="Item Tax Types" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/setup/companysetup/add-item-tax-types")}
          >
            Add Item Tax Type
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
      {/* Global checkbox & Search Bar */}
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
            placeholder="Search Description or Tax Exempt"
          />
        </Box>
      </Stack>
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer
          component={Paper}
          elevation={2}
          sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}
        >
          <Table aria-label="item tax types table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell align="center">Tax Exempt</TableCell>
                  {showInactive && <TableCell align="center">Inactive</TableCell>}
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.name}</TableCell>
                    <TableCell align="center">{item.exempt ? "Yes" : "No"}</TableCell>
                      {showInactive && (
                        <TableCell align="center">
                          <Checkbox
                            checked={Boolean(item.inactive)}
                            onChange={() => handleToggleInactive(item)}
                            inputProps={{ 'aria-label': `inactive-${item.id}` }}
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
                            navigate(`/setup/companysetup/update-item-tax-types/${item.id}`)
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
      {/* ✅ Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={openDeleteModal}
        title="Delete Item Tax Type"
        content="Are you sure you want to delete this Item Tax Type? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setSelectedId(null)}
        deleteFunc={handleDelete}
        onSuccess={() => {
          console.log("Item Tax Type deleted successfully!");
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
