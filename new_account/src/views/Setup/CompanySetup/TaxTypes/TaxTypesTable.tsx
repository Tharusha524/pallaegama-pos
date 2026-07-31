import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
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
  Button,
  Typography,
  useMediaQuery,
  Theme,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import SearchBar from "../../../../components/SearchBar";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import theme from "../../../../theme";
import { getTaxTypes, deleteTaxType, updateTaxType } from "../../../../api/Tax/taxServices";
import ErrorModal from "../../../../components/ErrorModal";
import { getChartMasters } from "../../../../api/GLAccounts/ChartMasterApi";
import { useAuth } from "../../../../context/AuthContext";

export default function TaxTypesTable() {
  const [taxGroups, setTaxGroups] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Tax rates');

  const [chartMasters, setChartMasters] = useState<any[]>([]);

  useEffect(() => {
    const fetchChartMasters = async () => {
      try {
        const data = await getChartMasters(); // Fetch GL accounts
        setChartMasters(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchChartMasters();
  }, []);
  // Load tax groups
  const loadTaxGroups = async () => {
    try {
      const data = await getTaxTypes();
      setTaxGroups(data);
    } catch (error) {
      console.error("Error fetching tax types:", error);
    }
  };

  useEffect(() => {
    loadTaxGroups();
  }, []);

  // Filter data by inactive and search query
  const filteredData = useMemo(() => {
    let data = showInactive ? taxGroups : taxGroups.filter((g) => !g.inactive);

    if (searchQuery.trim() !== "") {
      const lower = searchQuery.toLowerCase();
      data = data.filter((g) => {
        const desc = (g?.description ?? "").toString().toLowerCase();

        // sales_gl_account and purchasing_gl_account appear to be objects
        // with account_code and account_name. Guard against null/other types.
        const salesAccountCode = (g?.sales_gl_account?.account_code ?? "").toString().toLowerCase();
        const salesAccountName = (g?.sales_gl_account?.account_name ?? "").toString().toLowerCase();

        const purchaseAccountCode = (g?.purchasing_gl_account?.account_code ?? "").toString().toLowerCase();
        const purchaseAccountName = (g?.purchasing_gl_account?.account_name ?? "").toString().toLowerCase();

        return (
          desc.includes(lower) ||
          salesAccountCode.includes(lower) ||
          salesAccountName.includes(lower) ||
          purchaseAccountCode.includes(lower) ||
          purchaseAccountName.includes(lower)
        );
      });
    }

    return data;
  }, [taxGroups, showInactive, searchQuery]);

  // Pagination
  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  // Toggle inactive flag for a tax type and persist to server
  const handleToggleInactive = async (groupId: number, newValue: boolean) => {
    // snapshot previous state to revert on error
    const prev = taxGroups;
    setTaxGroups((s) => s.map((g) => (g.id === groupId ? { ...g, inactive: newValue } : g)));
    try {
      const group = prev.find((g) => g.id === groupId);
      if (!group) return;
      // Build payload: backend expects sales_gl_account and purchasing_gl_account as strings
      const payload: any = {
        ...group,
        inactive: newValue,
        sales_gl_account:
          group?.sales_gl_account?.account_code ?? group?.sales_gl_account ?? "",
        purchasing_gl_account:
          group?.purchasing_gl_account?.account_code ?? group?.purchasing_gl_account ?? "",
      };

      // send PUT with transformed payload
      await updateTaxType(groupId, payload);
      // refresh to ensure canonical data
      loadTaxGroups();
    } catch (error: any) {
      console.error("Error updating inactive flag:", error);
      setErrorMessage(error?.response?.data?.message || "Failed to update inactive flag. Please try again.");
      setErrorOpen(true);
      // revert optimistic change
      setTaxGroups(prev);
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await deleteTaxType(selectedId);
      setOpenDeleteModal(false);
      setSelectedId(null);
      loadTaxGroups();
    } catch (error) {
      console.error("Error deleting tax type:", error);
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to delete tax type Please try again."
      );
      setErrorOpen(true);
    }
  };

  const breadcrumbItems = [
    { title: "Company Setup", href: "/setup/companysetup" },
    { title: "Tax Types" },
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
          <PageTitle title="Tax Types" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/setup/companysetup/add-tax-types")}
          >
            Add Tax Types
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
      {/* Checkbox & Search */}
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
            placeholder="Search Description, Sales GL, Purchasing GL"
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
          <Table aria-label="tax types table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Description</TableCell>
                <TableCell>Default Rate (%)</TableCell>
                <TableCell>Sales GL Account</TableCell>
                <TableCell>Purchasing GL Account</TableCell>
                {showInactive && <TableCell align="center">Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((group) => (
                  <TableRow key={group.id} hover>
                    <TableCell>{group.description}</TableCell>
                    <TableCell>{group.default_rate}</TableCell>
                    <TableCell>
                      {group.sales_gl_account.account_code} - {group.sales_gl_account.account_name}
                    </TableCell>

                    <TableCell>
                      {group.purchasing_gl_account.account_code} - {group.purchasing_gl_account.account_name}
                    </TableCell>
                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={!!group.inactive}
                          onChange={(e) => handleToggleInactive(group.id, e.target.checked)}
                          inputProps={{ 'aria-label': 'inactive-checkbox' }}
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
                            navigate(`/setup/companysetup/update-tax-types/${group.id}`)
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
                            setSelectedId(group.id);
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
                    <Typography variant="body2">No Records Found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  colSpan={showInactive ? 6 : 5}
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
      {/* Delete Modal */}
      <DeleteConfirmationModal
        open={openDeleteModal}
        title="Delete Tax Type"
        content="Are you sure you want to delete this tax type? This action cannot be undone."
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
