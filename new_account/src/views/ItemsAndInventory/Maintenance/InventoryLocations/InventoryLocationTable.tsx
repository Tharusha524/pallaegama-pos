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
  FormControlLabel,
  Checkbox,
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
  getInventoryLocations as fetchInventoryLocations,
  updateInventoryLocation,
  deleteInventoryLocation,
} from "../../../../api/InventoryLocation/InventoryLocationApi";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

export default function InventoryLocationTable() {
  const [page, setPage] = useState(0);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [locations, setLocations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Inventory locations changes');

  const loadData = async () => {
    try {
      const data = await fetchInventoryLocations();
      setLocations(data);
    } catch (error) {
      console.error("Failed to fetch Inventory Locations:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  //  Function to detect inactive records flexibly
  const isInactive = (item: any) => {
    if (!item) return false;
    if (typeof item.inactive === "boolean") return Boolean(item.inactive);
    return false;
  };

  const toggleInactive = async (id: number, currentValue: boolean) => {
    // optimistic update
    const newValue = !currentValue;
    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, inactive: newValue } : l)));

    try {
      const loc = locations.find((l) => l.id === id);
      if (!loc) return;
      const updated = { ...loc, inactive: newValue };
      await updateInventoryLocation(id, updated);
      // keep local state as is (already optimistic)
    } catch (error) {
      // revert on error
      setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, inactive: currentValue } : l)));
      setErrorMessage(
        error?.response?.data?.message || "Failed to update inactive flag. Please try again."
      );
      setErrorOpen(true);
    }
  };

  //  Filtering logic
  const filteredLocations = useMemo(() => {
    let data = locations;

    // Filter out inactive ones if checkbox not checked
    if (!showInactive) {
      data = data.filter((loc) => !isInactive(loc));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      data = data.filter(
        (loc) =>
          loc.loc_code.toLowerCase().includes(lower) ||
          loc.location_name.toLowerCase().includes(lower) ||
          loc.delivery_address.toLowerCase().includes(lower)
      );
    }
    return data;
  }, [locations, searchQuery, showInactive]);

  const paginatedLocations = useMemo(() => {
    if (rowsPerPage === -1) return filteredLocations;
    return filteredLocations.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredLocations, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await deleteInventoryLocation(selectedId);
      setOpenDeleteModal(false);
      setSelectedId(null);
      loadData();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to delete inventory location. Please try again."
      );
      setErrorOpen(true);
    }
  };

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Inventory Locations" },
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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <PageTitle title="Inventory Locations" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/itemsandinventory/maintenance/add-inventory-location")}
          >
            Add Location
          </Button>

          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Back
          </Button>
        </Stack>
      </Box>
      {/*  Search + Show inactive toggle */}
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
          label="Show also inactive"
        />

        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Search..." />
        </Box>
      </Stack>
      {/* Table */}
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer component={Paper} elevation={2} sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}>
          <Table aria-label="inventory location table">
              <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>No</TableCell>
                <TableCell>Location Code</TableCell>
                <TableCell>Location Name</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Secondary Phone</TableCell>
                {showInactive && <TableCell align="center">Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedLocations.length > 0 ? (
                paginatedLocations.map((loc, index) => (
                  <TableRow key={loc.id} hover>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{loc.loc_code}</TableCell>
                    <TableCell>{loc.location_name}</TableCell>
                    <TableCell>{loc.delivery_address}</TableCell>
                    <TableCell>{loc.phone}</TableCell>
                    <TableCell>{loc.phone2}</TableCell>
                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={isInactive(loc)}
                          onChange={() => toggleInactive(loc.id, isInactive(loc))}
                          color="primary"
                        />
                      </TableCell>
                    )}
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => navigate(`/itemsandinventory/maintenance/update-inventory-location/${loc.id}`)}
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
                            setSelectedId(loc.id);
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
                  <TableCell colSpan={showInactive ? 8 : 7} align="center">
                    <Typography variant="body2">No Records Found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  colSpan={showInactive ? 8 : 7}
                  count={filteredLocations.length}
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
        title="Delete Inventory Location"
        content="Are you sure you want to delete this inventory location? This action cannot be undone."
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
