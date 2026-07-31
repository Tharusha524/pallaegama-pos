import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useMemo, useEffect } from "react";
import {
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TablePagination,
  TableRow,
  Paper,
  Checkbox,
  FormControlLabel,
  Typography,
  useMediaQuery,
  Theme,
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import SearchBar from "../../../../components/SearchBar";
import theme from "../../../../theme";
import ErrorModal from "../../../../components/ErrorModal";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
// import {
//   getAssetClasses,
//   deleteAssetClass,
// } from "../../../../api/FixedAssetClasses/FixedAssetClassesApi";
import { getStockFaClasses, deleteStockFaClass } from "../../../../api/StockFaClass/StockFaClassesApi";
import { useAuth } from "../../../../context/AuthContext";

export default function FixedAssetClassesTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [assetClasses, setAssetClasses] = useState<any[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Helper to determine if a class is inactive (copied from SalesPersonTable logic)
  const isClassInactive = (item: any) => {
    if (item == null) return false;
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

  // Track which rows are being updated
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);

  // Handler to toggle inactive
  const handleToggleInactive = async (cls: any, checked: boolean) => {
    if (!cls || !cls.fa_class_id) return;
    const id = cls.fa_class_id;
    try {
      setUpdatingIds((prev) => [...prev, id]);
      const payload = { ...cls, inactive: checked };
      const api = await import("../../../../api/StockFaClass/StockFaClassesApi");
      await api.updateStockFaClass(id, payload);
      await loadAssetClasses();
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || "Failed to update. Please try again.");
      setErrorOpen(true);
    } finally {
      setUpdatingIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Fixed Asset classes');
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));

  /** API Loading (Uncomment when backend ready) */
  useEffect(() => {
    loadAssetClasses();
  }, []);

  const loadAssetClasses = async () => {
    try {
      const data = await getStockFaClasses();
      setAssetClasses(data);
    } catch (error) {
      setErrorMessage("Failed to fetch asset classes");
      setErrorOpen(true);
    }
  };

  /** Filter + Search Logic */
  const filteredData = useMemo(() => {
    let list = showInactive
      ? assetClasses
      : assetClasses.filter((c) => !c.inactive);

    if (searchQuery.trim() !== "") {
      const lower = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.fa_class_id.toLowerCase().includes(lower) ||
          c.description.toLowerCase().includes(lower) ||
          c.depreciation_rate.toString().includes(lower)
      );
    }

    return list;
  }, [assetClasses, showInactive, searchQuery]);

  /** Pagination */
  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [page, rowsPerPage, filteredData]);

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);

  const handleChangeRowsPerPage = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  /** Delete Handler */
  const handleDelete = async (faClassId: string) => {
    try {
      await deleteStockFaClass(faClassId);
      loadAssetClasses();
    } catch (error) {
      setErrorMessage("Failed to delete asset class");
      setErrorOpen(true);
    }finally {
      setOpenDeleteModal(false);
      setSelectedTypeId(null);
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
          <PageTitle title="Fixed Asset Classes" />
          <Breadcrumb
            breadcrumbs={[
              { title: "Home", href: "/dashboard" },
              { title: "Fixed Asset Classes" },
            ]}
          />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={() =>
              navigate("/fixedassets/maintenance/add-fixed-asset-classes")
            }
          >
            Add Class
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
          label="Show Inactive"
        />

        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Search Asset Classes"
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
                <TableCell>Fixed Asset Class</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Basic Depreciation Rate (%)</TableCell>
                {showInactive && <TableCell align="center">Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((cls) => (
                  <TableRow key={cls.fa_class_id} hover>
                    <TableCell>{cls.fa_class_id}</TableCell>
                    <TableCell>{cls.description}</TableCell>
                    <TableCell>{cls.depreciation_rate}%</TableCell>

                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={isClassInactive(cls)}
                          disabled={updatingIds.includes(cls.fa_class_id)}
                          onChange={(e) => handleToggleInactive(cls, e.target.checked)}
                          inputProps={{ 'aria-label': 'inactive-checkbox' }}
                        />
                      </TableCell>
                    )}

                    <TableCell align="center">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="center"
                      >
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() =>
                            navigate(
                              `/fixedassets/maintenance/update-fixed-asset-classes/${cls.fa_class_id}`
                            )
                          }
                        >
                          Edit
                        </Button>

                        {/* Delete optional */}
                        <Button
                          disabled={!canEdit}
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => {
                            setSelectedTypeId(cls.fa_class_id);
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
                  <TableCell
                    colSpan={showInactive ? 5 : 4}
                    align="center"
                  >
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
      {/* Error modal */}
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
      <DeleteConfirmationModal
        open={openDeleteModal}
        title="Delete Sales Type"
        content="Are you sure you want to delete this Sales Type? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setSelectedTypeId(null)}
        deleteFunc={() => selectedTypeId !== null && handleDelete(selectedTypeId)}
        onSuccess={() => console.log("Sales Type deleted successfully!")}
      />
    </FormPageLayout>
  );
}
