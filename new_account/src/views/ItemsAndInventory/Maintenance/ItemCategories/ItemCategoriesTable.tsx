import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useMemo, useState, useEffect } from "react";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import SearchBar from "../../../../components/SearchBar";
import theme from "../../../../theme";
import { getItemCategories, updateItemCategory, deleteItemCategory } from "../../../../api/ItemCategories/ItemCategoriesApi";
import { getItemTaxTypes } from "../../../../api/ItemTaxType/ItemTaxTypeApi";
import { getItemUnits } from "../../../../api/ItemUnit/ItemUnitApi";
import { getItemTypes } from "../../../../api/ItemType/ItemType";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

function ItemCategoriesTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Item categories');

  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const queryClient = useQueryClient();

  const { data: categoriesData = [] } = useQuery({
    queryKey: ["itemCategories", showInactive],
    queryFn: () => getItemCategories(showInactive),
    // ensure we refetch when the component mounts or window regains focus so new items appear
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Reference data for mapping
  const [taxTypes, setTaxTypes] = useState([]);
  const [units, setUnits] = useState([]);
  const [itemTypes, setItemTypes] = useState([]);

  useEffect(() => {
    async function fetchRefs() {
      const [taxRes, unitRes, typeRes] = await Promise.all([
        getItemTaxTypes(),
        getItemUnits(),
        getItemTypes()
      ]);
      setTaxTypes(taxRes || []);
      setUnits(unitRes || []);
      setItemTypes(typeRes || []);
    }
    fetchRefs();
  }, []);

  // Lookup maps
  const taxTypeMap = useMemo(() => Object.fromEntries(taxTypes.map(t => [t.id, t.name])), [taxTypes]);
  const unitMap = useMemo(() => Object.fromEntries(units.map(u => [u.id, u.name])), [units]);
  const itemTypeMap = useMemo(() => Object.fromEntries(itemTypes.map(i => [i.id, i.name])), [itemTypes]);

  const filteredCategories = useMemo(() => {
    if (!categoriesData) return [];
    let filtered = categoriesData;

    // Exclude categories with dflt_mb_flag === 4 (fixed assets categories)
    filtered = filtered.filter(item => item.dflt_mb_flag !== 4);

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          (item.description || "").toLowerCase().includes(lowerQuery) ||
          (taxTypeMap[item.dflt_tax_type] || "").toLowerCase().includes(lowerQuery) ||
          (unitMap[item.dflt_units] || "").toLowerCase().includes(lowerQuery)
      );
    }

    // Only show inactive items if showInactive is checked, otherwise show only active items
    if (!showInactive) {
      filtered = filtered.filter(item => !item.inactive);
    }

    return filtered;
  }, [categoriesData, searchQuery, showInactive, taxTypeMap, unitMap]);

  const paginatedCategories = useMemo(() => {
    if (rowsPerPage === -1) return filteredCategories;
    return filteredCategories.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredCategories, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => deleteItemCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itemCategories"], exact: false });
    },
  });

  const handleDeleteClick = (id: number) => {
    setSelectedId(id);
    setOpenDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedId) return;
    try {
      await deleteCategoryMutation.mutateAsync(selectedId);
      setOpenDeleteModal(false);
      setSelectedId(null);
    } catch (error) {
      console.error("Failed to delete item category:", error);
      setErrorMessage("Failed to delete the item category. Please try again.");
      setErrorOpen(true);
      setOpenDeleteModal(false);
      setSelectedId(null);
    }
  };

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateItemCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itemCategories"], exact: false });
    },
  });

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Item Categories" },
  ];

  return (
    <FormPageLayout>
      {/* Header with buttons */}
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
          <PageTitle title="Item Categories" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/itemsandinventory/maintenance/add-item-categories")}
          >
            Add Category
          </Button>

          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/itemsandinventory/maintenance")}>
            Back
          </Button>
        </Stack>
      </Box>
      {/* Search + Show Inactive Toggle */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          px: 2,
          mb: 2,
          width: "100%",
          alignItems: "center",
        }}
      >
        <FormControlLabel
          control={<Checkbox checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />}
          label="Show also Inactive"
        />

        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Search..." />
        </Box>
      </Box>
      {/* Table */}
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer
          component={Paper}
          elevation={2}
          sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}
        >
          <Table aria-label="item categories table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>No</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Tax Type</TableCell>
                <TableCell>Units</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Sales Account</TableCell>
                <TableCell>Inventory Account</TableCell>
                <TableCell>COGS Account</TableCell>
                <TableCell>Adjustment Account</TableCell>
                <TableCell>Assembly Account</TableCell>
                {showInactive && <TableCell>Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedCategories.length > 0 ? (
                paginatedCategories.map((item, index) => (
                  <TableRow key={item.category_id} hover>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{taxTypeMap[item.dflt_tax_type] || item.dflt_tax_type} </TableCell>
                    <TableCell>{unitMap[item.dflt_units] || item.dflt_units}</TableCell>
                    <TableCell>{itemTypeMap[item.dflt_mb_flag] || item.dflt_mb_flag}</TableCell>
                    <TableCell>{item.dflt_sales_act}</TableCell>
                    <TableCell>{item.dflt_inventory_act}</TableCell>
                    <TableCell>{item.dflt_cogs_act}</TableCell>
                    <TableCell>{item.dflt_adjustment_act}</TableCell>
                    <TableCell>{item.dflt_wip_act}</TableCell>
                    {showInactive && (
                      <TableCell>
                        <Checkbox
                          checked={item.inactive}
                          onChange={(e) => {
                            updateCategoryMutation.mutate(
                              {
                                id: item.category_id, // use category_id if that’s what API expects
                                data: { ...item, inactive: e.target.checked },
                              },
                              {
                                onSuccess: () => {
                                  queryClient.invalidateQueries({ queryKey: ["itemCategories", showInactive], exact: false });
                                },
                                onError: (err) => {
                                  console.error("Error updating category:", err);
                                },
                              }
                            );
                          }}
                        />
                      </TableCell>
                    )}

                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => navigate(`/itemsandinventory/maintenance/update-item-categories/${item.category_id}`)}
                        >
                          Edit
                        </Button>
                        <Button
                          disabled={!canEdit}
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleDeleteClick(item.category_id)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={showInactive ? 12 : 11} align="center">
                    <Typography variant="body2">No Records Found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  colSpan={showInactive ? 12 : 11}
                  count={filteredCategories.length}
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
      <DeleteConfirmationModal
             open={openDeleteModal}
             title="Delete Item Category"
             content="Are you sure you want to delete this item category? This action cannot be undone."
             handleClose={() => setOpenDeleteModal(false)}
             handleReject={() => setOpenDeleteModal(false)}
             deleteFunc={handleDeleteConfirm}
             onSuccess={() => {}}
           />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}

export default ItemCategoriesTable;