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
import {
  getSalesPosList,
  deleteSalesPos,
  updateSalesPos,
} from "../../../../api/SalePos/SalePosApi";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import { getBankAccounts } from "../../../../api/BankAccount/BankAccountApi";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../../context/AuthContext";

export default function PosTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [posList, setPosList] = useState<any[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedPosId, setSelectedPosId] = useState<number | null>(null);
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Point of Sale definitions');

  // Fetch master data
  const { data: locations = [] } = useQuery({
    queryKey: ["inventoryLocations"],
    queryFn: getInventoryLocations,
  });
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: getBankAccounts,
  });

  // Fetch data
  useEffect(() => {
    getSalesPosList().then((data) => setPosList(data));
  }, []);

  // Filter data
  const filteredData = useMemo(() => {
    let data = showInactive ? posList : posList.filter((p) => !p.inactive);

    if (searchQuery.trim() !== "") {
      const lower = searchQuery.toLowerCase();
      data = data.filter(
        (p) =>
          p.pos_name?.toLowerCase().includes(lower) ||
          p.pos_location?.toLowerCase().includes(lower) ||
          p.pos_account?.toString().includes(lower) ||
          p.id?.toString().includes(lower)
      );
    }

    return data;
  }, [posList, showInactive, searchQuery]);

  const columnsCount = showInactive ? 7 : 6;

  // Helper functions to get names
  const getLocationName = (locCode: string) => {
    const location = locations.find((loc: any) => loc.loc_code === locCode);
    return location?.location_name || locCode;
  };

  const getBankAccountName = (accountId: number) => {
    const account = bankAccounts.find((acc: any) => acc.id === accountId);
    return account?.bank_account_name || accountId;
  };

  // Pagination
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

  const handleToggleInactive = async (pos: any) => {
    const id = pos.id;
    if (!id) return;

    const newValue = !pos.inactive;

    // Optimistic update
    setPosList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, inactive: newValue } : p))
    );

    try {
      await updateSalesPos(id, { ...pos, inactive: newValue });
    } catch (error: any) {
      // rollback
      setPosList((prev) => prev.map((p) => (p.id === id ? { ...p, inactive: pos.inactive } : p)));
      setErrorMessage(
        error?.response?.data?.message || "Failed to update inactive flag. Please try again."
      );
      setErrorOpen(true);
      console.error("Error updating inactive flag for POS:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedPosId) return;

    try {
      await deleteSalesPos(selectedPosId);
      setPosList((prev) => prev.filter((p) => p.id !== selectedPosId));
    } catch (error: any) {
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to delete POS. Please try again."
      );
      setErrorOpen(true);
      console.error("Error deleting POS:", error);
    } finally {
      setOpenDeleteModal(false);
      setSelectedPosId(null);
    }
  };

  const breadcrumbItems = [
    { title: "Miscellaneous", href: "/setup/miscellaneous" },
    { title: "Point of Sale" },
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
          <PageTitle title="Point of Sale" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/setup/miscellaneous/add-point-of-sale")}
          >
            Add POS
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
      {/* Search + Filter */}
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
          label="Show Also Inactive"
        />

        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Search POS"
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
          <Table aria-label="pos table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>POS Name</TableCell>
                <TableCell>Credit Sale</TableCell>
                <TableCell>Cash Sale</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Default Account</TableCell>
                {showInactive && <TableCell align="center">Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((pos, index) => (
                  <TableRow key={pos.id ?? index} hover>
                    <TableCell>{pos.pos_name}</TableCell>
                    <TableCell>{pos.credit_sale ? "Yes" : "No"}</TableCell>
                    <TableCell>{pos.cash_sale ? "Yes" : "No"}</TableCell>
                    <TableCell>{getLocationName(pos.pos_location)}</TableCell>
                    <TableCell>{getBankAccountName(pos.pos_account)}</TableCell>
                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={Boolean(pos.inactive)}
                          onChange={() => handleToggleInactive(pos)}
                          inputProps={{ 'aria-label': `inactive-${pos.id}` }}
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
                            navigate(`/setup/miscellaneous/update-point-of-sale/${pos.id}`)
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
                            setSelectedPosId(pos.id);
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
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={openDeleteModal}
        title="Delete POS"
        content="Are you sure you want to delete this POS? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setSelectedPosId(null)}
        deleteFunc={handleDelete}
        onSuccess={() => {
          console.log("POS deleted successfully!");
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
