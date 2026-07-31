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
import theme from "../../../../theme";
import { getItemUnits, deleteItemUnit, updateItemUnit } from "../../../../api/ItemUnit/ItemUnitApi";
import SearchBar from "../../../../components/SearchBar";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

export default function UnitsOfMeasureTable() {
  const [unitsData, setUnitsData] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Units of measure');

  // Fetch units from backend
  const loadData = async () => {
    try {
      const data = await getItemUnits();
      setUnitsData(data);
    } catch (error) {
      console.error("Failed to fetch Units of Measure:", error);
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to load units Please try again."
      );
      setErrorOpen(true);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter units based on search query and inactive status
  const filteredUnits = useMemo(() => {
    let filtered = unitsData;

    // Apply inactive filter
    if (!showInactive) {
      filtered = filtered.filter(u => !u.inactive);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.abbr.toLowerCase().includes(lowerQuery) ||
          u.name.toLowerCase().includes(lowerQuery)
      );
    }

    return filtered;
  }, [unitsData, searchQuery, showInactive]);

  // Pagination
  const paginatedUnits = useMemo(() => {
    if (rowsPerPage === -1) return filteredUnits;
    return filteredUnits.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredUnits, page, rowsPerPage]);

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await deleteItemUnit(selectedId);
      setOpenDeleteModal(false);
      setSelectedId(null);
      loadData();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to delete item unit Please try again."
      );
      setErrorOpen(true);
    }
  };

  const handleInactiveChange = async (item: any, checked: boolean) => {
    try {
      await updateItemUnit(item.id, { ...item, inactive: checked });
      loadData(); // Reload the data to get the updated state
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to update unit status. Please try again."
      );
      setErrorOpen(true);
    }
  };

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Units of Measure" },
  ];

  return (
    <FormPageLayout>
      {/* Header */}
      <Box
        sx={{
          padding: theme.spacing(2),
          boxShadow: 2,
          borderRadius: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Box>
          <PageTitle title="Units of Measure" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1} sx={{ mt: isMobile ? 1 : 0 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() =>
              navigate("/itemsandinventory/maintenance/units-of-measure/add-units-of-measure")
            }
          >
            Add Unit
          </Button>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Back
          </Button>
        </Stack>
      </Box>
      {/* Search and Filter */}
      {/* Search & Filter Section */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          mb: 2,
          px: 2,
          flexWrap: "wrap", //  allows wrapping on small screens
          gap: 2, //  adds space between checkbox and search bar
        }}
      >
        {/*  Show Inactive Checkbox (Left Side) */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Show also Inactive
              </Typography>
            }
          />
        </Box>

        {/* 🔍 Search Bar (Right Side) */}
        <Box sx={{ width: isMobile ? "180px" : "280px" }}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Search..."
          />
        </Box>
      </Box>
      {/* Table */}
      <TableContainer component={Paper} sx={{ overflowX: "auto", maxWidth: "100%", p: 1 }}>
        <Table>
          <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
            <TableRow>
              <TableCell>No</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Decimals</TableCell>
              {showInactive && <TableCell>Inactive</TableCell>}
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {paginatedUnits.length > 0 ? (
              paginatedUnits.map((item, index) => (
                <TableRow key={item.id} hover>
                  <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                  <TableCell>{item.abbr}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.decimals}</TableCell>
                  {showInactive && (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={item.inactive || false}
                        onChange={(e) => handleInactiveChange(item, e.target.checked)}
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
                            `/itemsandinventory/maintenance/units-of-measure/update-units-of-measure/${item.id}`
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
                <TableCell colSpan={showInactive ? 6 : 5} align="center">
                  <Typography>No Records Found</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                colSpan={showInactive ? 6 : 5}
                count={filteredUnits.length}
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
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={openDeleteModal}
        title="Delete Unit"
        content="Are you sure you want to delete this unit? This action cannot be undone."
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
