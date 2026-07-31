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
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { getItemCategories, deleteItemCategory, updateItemCategory } from "../../../../api/ItemCategories/ItemCategoriesApi";
import { getItemTaxTypes } from "../../../../api/ItemTaxType/ItemTaxTypeApi";
import { getItemUnits } from "../../../../api/ItemUnit/ItemUnitApi";
import { useAuth } from "../../../../context/AuthContext";

export default function FixedAssetsCategoriesTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [categories, setCategories] = useState<any[]>([]);
  const [itemTaxTypes, setItemTaxTypes] = useState<any[]>([]);
  const [itemUnits, setItemUnits] = useState<any[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [updatingIds, setUpdatingIds] = useState<number[]>([]);

  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Fixed Asset categories');
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));



  const loadCategories = async (includeInactive = false) => {
    try {
      const [categoriesData, taxTypesData, unitsData] = await Promise.all([
        getItemCategories(includeInactive),
        getItemTaxTypes(),
        getItemUnits(),
      ]);
      const filteredCategories = categoriesData.filter((cat: any) => cat.dflt_mb_flag === 4);
      setCategories(filteredCategories);
      setItemTaxTypes(taxTypesData);
      setItemUnits(unitsData);
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  // Refetch when showInactive changes so backend can return inactive items when needed
  useEffect(() => {
    loadCategories(showInactive);
  }, [showInactive]);

  const filteredData = useMemo(() => {
    let list = showInactive ? categories : categories.filter((c) => !c.inactive);

    if (searchQuery.trim() !== "") {
      const lower = searchQuery.toLowerCase();
      list = list.filter(
        (c) => {
          const taxName = itemTaxTypes.find((tax: any) => tax.id === c.dflt_tax_type)?.name || "";
          const unitAbbr = itemUnits.find((unit: any) => unit.id === c.dflt_units)?.abbr || "";
          return (
            c.description.toLowerCase().includes(lower) ||
            taxName.toLowerCase().includes(lower) ||
            unitAbbr.toLowerCase().includes(lower)
          );
        }
      );
    }
    return list;
  }, [categories, showInactive, searchQuery, itemTaxTypes, itemUnits]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [page, rowsPerPage, filteredData]);

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleDelete = async () => {
    if (!selectedId) return;

    try {
      await deleteItemCategory(selectedId);
      setOpenDeleteModal(false);
      setSelectedId(null);
      loadCategories();
    } catch (error) {
      setErrorMessage("Failed to delete asset category");
      setErrorOpen(true);
    }
  };

  // Handler to update inactive status (updates backend)
  const handleToggleInactive = async (cat: any, checked: boolean) => {
    if (!cat || !cat.category_id) return;
    const id = cat.category_id;
    try {
      setUpdatingIds(prev => [...prev, id]);
      await updateItemCategory(id, { ...cat, inactive: checked });
      await loadCategories();
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || "Failed to update inactive status");
      setErrorOpen(true);
    } finally {
      setUpdatingIds(prev => prev.filter(i => i !== id));
    }
  };

  return (
    <FormPageLayout>
      {/* Header */}
      <Box
        sx={{
          padding: theme.spacing(2),
          boxShadow: 2,
          marginY: 2,
          borderRadius: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <PageTitle title="Fixed Assets Categories" />
          <Breadcrumb
            breadcrumbs={[
              { title: "Home", href: "/dashboard" },
              { title: "Fixed Asset Categories" },
            ]}
          />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={() =>
              navigate("/fixedassets/maintenance/add-fixed-asset-categories")
            }
          >
            Add Category
          </Button>

          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/fixedassets/maintenance")}
          >
            Back
          </Button>
        </Stack>
      </Box>
      {/* Search + Filters */}
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
          label="Show Inactive"
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
          sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}
        >
          <Table>
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Tax Type</TableCell>
                <TableCell>Units</TableCell>
                <TableCell>Sales Account</TableCell>
                <TableCell>Asset Account</TableCell>
                <TableCell>Depreciation Cost Account</TableCell>
                <TableCell>Depreciation / Disposal Account</TableCell>
                {showInactive && <TableCell align="center">Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((cat) => (
                  <TableRow key={cat.category_id} hover>
                    <TableCell>{cat.description}</TableCell>
                    <TableCell>{itemTaxTypes.find((tax: any) => tax.id === cat.dflt_tax_type)?.name || cat.dflt_tax_type}</TableCell>
                    <TableCell>{itemUnits.find((unit: any) => unit.id === cat.dflt_units)?.abbr || cat.dflt_units}</TableCell>
                    <TableCell>{cat.dflt_sales_act}</TableCell>
                    <TableCell>{cat.dflt_inventory_act}</TableCell>
                    <TableCell>{cat.dflt_cogs_act}</TableCell>
                    <TableCell>{cat.dflt_adjustment_act}</TableCell>

                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={!!cat.inactive}
                          disabled={updatingIds.includes(cat.category_id)}
                          onChange={(e) => handleToggleInactive(cat, e.target.checked)}
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
                              `/fixedassets/maintenance/update-fixed-asset-categories/${cat.category_id}`
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
                            setSelectedId(cat.category_id);
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
                  <TableCell colSpan={showInactive ? 9 : 8} align="center">
                    <Typography>No Records Found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  count={filteredData.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      </Stack>
      {/* Confirmation + Error Modals */}
      <DeleteConfirmationModal
        open={openDeleteModal}
        title="Delete Category"
        content="Are you sure you want to delete this category?"
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
