import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useMemo, useState } from "react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import SearchBar from "../../../../components/SearchBar";
import theme from "../../../../theme";
import { getBankAccounts, deleteBankAccount } from "../../../../api/BankAccount/BankAccountApi";
import { updateBankAccount } from "../../../../api/BankAccount/BankAccountApi";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import { useAuth } from "../../../../context/AuthContext";

function BankAccountsTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const colCount = showInactive ? 11 : 10;
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Bank accounts');
  const queryClient = useQueryClient();

  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);


  const { data: bankAccountsData = [], isLoading, isError } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: getBankAccounts,
    refetchOnMount: true,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBankAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
    },
  });

  const handleDelete = (id: number) => {
    setSelectedId(id);
    setOpenDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (selectedId !== null) {
      try {
        await deleteMutation.mutateAsync(selectedId);
        queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
        console.log("Bank account deleted successfully!");
      } catch (error) {
        console.error("Error deleting bank account:", error);
      } finally {
        setOpenDeleteModal(false);
      }
    }
  };

  // Filter with search + showInactive toggle
  const filteredAccounts = useMemo(() => {
    if (!bankAccountsData) return [];

    let filtered = [...bankAccountsData];

    if (!showInactive) {
      filtered = filtered.filter((item) => !item.inactive);
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.bank_account_name.toLowerCase().includes(lowerQuery) ||
          item.bank_name.toLowerCase().includes(lowerQuery) ||
          item.bank_account_number.toLowerCase().includes(lowerQuery)
      );
    }

    return filtered;
  }, [bankAccountsData, searchQuery, showInactive]);

  const paginatedAccounts = useMemo(() => {
    if (rowsPerPage === -1) return filteredAccounts;
    return filteredAccounts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredAccounts, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Bank Accounts" },
  ];

  if (isLoading)
    return (
      <Typography variant="body1" sx={{ textAlign: "center", mt: 4 }}>
        Loading...
      </Typography>
    );

  if (isError)
    return (
      <Typography variant="body1" sx={{ textAlign: "center", mt: 4, color: "red" }}>
        Failed to load data.
      </Typography>
    );

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
          <PageTitle title="Bank Accounts" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/bankingandgeneralledger/maintenance/add-bank-accounts")}
          >
            Add Bank Account
          </Button>

          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
          >
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
          control={
            <Checkbox
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
          }
          label="Show also Inactive"
        />

        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Search..."
          />
        </Box>
      </Box>
      {/* Table */}
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer
          component={Paper}
          elevation={2}
          sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}
        >
          <Table aria-label="bank accounts table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>No</TableCell>
                <TableCell>Account Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Currency</TableCell>
                <TableCell>GL Account</TableCell>
                <TableCell>Bank</TableCell>
                <TableCell>Number</TableCell>
                <TableCell>Bank Address</TableCell>
                <TableCell>Default</TableCell>
                  {showInactive && <TableCell align="center">Inactive</TableCell>}
                  <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedAccounts.length > 0 ? (
                paginatedAccounts.map((item, index) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{item.bank_account_name}</TableCell>
                    <TableCell>{item.account_type?.type_name ?? "—"}</TableCell>
                    <TableCell>{item.bank_curr_code}</TableCell>
                    <TableCell>{item.account_gl_code}</TableCell>
                    <TableCell>{item.bank_name}</TableCell>
                    <TableCell>{item.bank_account_number}</TableCell>
                    <TableCell>{item.bank_address}</TableCell>
                        <TableCell>
                          <Checkbox checked={item.default_curr_act} disabled />
                        </TableCell>
                        {showInactive && (
                          <TableCell align="center">
                            <Checkbox
                              checked={Boolean(item.inactive)}
                              onChange={async (e) => {
                                const checked = e.target.checked;

                                // Build payload in the same shape as the Update form expects
                                const payload = {
                                  bank_account_name: item.bank_account_name ?? "",
                                  // account_type may be an object (with id) or an id already; normalize to id/string
                                  account_type: item.account_type?.id ?? item.account_type ?? "",
                                  bank_curr_code: item.bank_curr_code ?? "",
                                  default_curr_act: Boolean(item.default_curr_act),
                                  account_gl_code: item.account_gl_code ?? "",
                                  bank_charges_act: item.bank_charges_act ?? "",
                                  bank_name: item.bank_name ?? "",
                                  bank_account_number: item.bank_account_number ?? "",
                                  bank_address: item.bank_address ?? "",
                                  inactive: checked,
                                };

                                try {
                                  await updateBankAccount(item.id, payload);
                                  queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
                                } catch (error) {
                                  console.error("Failed to update inactive flag:", error);
                                  alert("Failed to update inactive flag. Please try again.");
                                }
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
                          onClick={() =>
                            navigate(
                              `/bankingandgeneralledger/maintenance/update-bank-accounts/${item.id}`
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
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </Button>

                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={colCount} align="center">
                    <Typography variant="body2">No Records Found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  colSpan={colCount}
                  count={filteredAccounts.length}
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
        title="Delete Bank Account"
        content="Are you sure you want to delete this bank account? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setOpenDeleteModal(false)}
        deleteFunc={confirmDelete}
        onSuccess={() => console.log("Bank account deleted successfully!")}
      />
    </FormPageLayout>
  );
}

export default BankAccountsTable;
