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
import { getLocations, deleteLocation, updateLocation } from "../../../../api/FixedAssetsLocation/FixedAssetsLocationApi";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

export default function FixedAssetsLocationsTable() {
  const [page, setPage] = useState(0);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [locations, setLocations] = useState<any[]>([]);
  const [updatingIds, setUpdatingIds] = useState<number[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Fixed assets locations maintenance');

  useEffect(() => {
    loadLocations();
  }, []);

  const isLocationInactive = (item: any) => {
    if (!item) return false;
    if (typeof item.inactive === "boolean") return Boolean(item.inactive);
    if (item.inactive !== undefined && item.inactive !== null) {
      const val = String(item.inactive).toLowerCase();
      if (val === "1" || val === "true") return true;
      if (val === "0" || val === "false") return false;
    }
    if (typeof item.isActive === "boolean") return !item.isActive;
    if (typeof item.status === "string") return item.status.toLowerCase() !== "active";
    return false;
  };

  const loadLocations = async () => {
    try {
      const data = await getLocations();
      setLocations(data);
    } catch (error) {
      console.error("Failed to fetch locations", error);
    }
  };

  const filteredData = useMemo(() => {
    let data = showInactive ? locations : locations.filter((l) => !l.inactive);

    if (searchQuery.trim() !== "") {
      const lower = searchQuery.toLowerCase();
      data = data.filter(
        (l) =>
          l.locationCode.toLowerCase().includes(lower) ||
          l.locationName.toLowerCase().includes(lower) ||
          l.address.toLowerCase().includes(lower) ||
          l.phone.toLowerCase().includes(lower) ||
          l.secondaryPhone.toLowerCase().includes(lower) ||
          l.id.toString().includes(lower)
      );
    }
    return data;
  }, [locations, showInactive, searchQuery]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [page, rowsPerPage, filteredData]);

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await deleteLocation(selectedId);
      setOpenDeleteModal(false);
      setSelectedId(null);
      loadLocations();
    } catch (error) {
      console.error("Delete failed", error);
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to delete location Please try again."
      );
      setErrorOpen(true);
    }
  };

  const handleToggleInactive = async (loc: any, checked: boolean) => {
    if (!loc?.id) return;
    const id = loc.id;
    try {
      setUpdatingIds((prev) => [...prev, id]);
      const payload = { ...loc, inactive: checked };
      await updateLocation(id, payload);
      await loadLocations();
    } catch (error: any) {
      console.error("Failed to update location inactive flag:", error);
      setErrorMessage(error?.response?.data?.message || "Failed to update. Please try again.");
      setErrorOpen(true);
    } finally {
      setUpdatingIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Fixed Assets Locations" },
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
          <PageTitle title="Fixed Assets Locations" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/fixedassets/maintenance/add-fixed-asset-location")}
          >
            Add Location
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
      {/* Checkbox + Search */}
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
          <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Search Locations" />
        </Box>
      </Stack>
      {/* Table */}
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer component={Paper} elevation={2} sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}>
          <Table aria-label="fixed assets locations table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                  <TableCell>ID</TableCell>
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
              {paginatedData.length > 0 ? (
                paginatedData.map((loc) => (
                  <TableRow key={loc.id} hover>
                    <TableCell>{loc.id}</TableCell>
                    <TableCell>{loc.locationCode}</TableCell>
                    <TableCell>{loc.locationName}</TableCell>
                    <TableCell>{loc.address}</TableCell>
                    <TableCell>{loc.phone}</TableCell>
                    <TableCell>{loc.secondaryPhone}</TableCell>
                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={isLocationInactive(loc)}
                          disabled={updatingIds.includes(loc.id)}
                          onChange={(e) => handleToggleInactive(loc, e.target.checked)}
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
                            navigate(`/fixedassets/maintenance/update-fixed-asset-location/${loc.id}`)
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
        title="Delete Location"
        content="Are you sure you want to delete this location? This action cannot be undone."
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
