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
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import SearchBar from "../../../../components/SearchBar";
import { getSalesGroups, deleteSalesGroup, SalesGroup, patchSalesGroup } from "../../../../api/SalesMaintenance/salesService";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

function SalesGroupsTable() {

  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales groups changes');
  const queryClient = useQueryClient();

  const { data: salesGroups = [] } = useQuery<SalesGroup[]>({
    queryKey: ["salesGroups"],
    queryFn: getSalesGroups,
    refetchOnMount: true,
  });

  const filteredGroups = useMemo(() => {
    if (!salesGroups) return [];

    let filtered = salesGroups;

    const isGroupInactive = (group: any) => {
      // Support multiple possible shapes coming from API: `inactive` boolean, numeric 0/1, `isActive` boolean, or `status` string
      if (group == null) return false;
      // handle boolean
      if (typeof group.inactive === "boolean") return Boolean(group.inactive);
      // handle numeric or string values like 0/1, "0"/"1", "true"/"false"
      if (group.inactive !== undefined && group.inactive !== null) {
        const val = String(group.inactive).toLowerCase();
        if (val === "1" || val === "true") return true;
        if (val === "0" || val === "false") return false;
      }
      if (typeof group.isActive === "boolean") return !group.isActive;
      if (typeof group.status === "string") return group.status.toLowerCase() !== "active";
      return false;
    };

    // If user does not want to see inactive entries, filter them out
    if (!showInactive) {
      filtered = filtered.filter((item: any) => !isGroupInactive(item));
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter((group) =>
        group.name.toLowerCase().includes(lowerQuery)
      );
    }
    return filtered;
  }, [salesGroups, searchQuery, showInactive]);

  const paginatedGroups = useMemo(() => {
    if (rowsPerPage === -1) return filteredGroups;
    return filteredGroups.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [filteredGroups, page, rowsPerPage]);

  const isGroupInactive = (group: any) => {
    if (group == null) return false;
    if (typeof group.inactive === "boolean") return Boolean(group.inactive);
    if (group.inactive !== undefined && group.inactive !== null) {
      const val = String(group.inactive).toLowerCase();
      if (val === "1" || val === "true") return true;
      if (val === "0" || val === "false") return false;
    }
    if (typeof group.isActive === "boolean") return !group.isActive;
    if (typeof group.status === "string") return group.status.toLowerCase() !== "active";
    return false;
  };

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = async () => {
    if (!selectedGroupId) return;

    try {
      await deleteSalesGroup(selectedGroupId);
      queryClient.invalidateQueries({ queryKey: ["salesGroups"] });
    } catch (error) {
      console.error("Failed to delete Sales Group:", error);
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to delete. Please try again."
      );
      setErrorOpen(true);
    } finally {
      setOpenDeleteModal(false);
      setSelectedGroupId(null);
    }
  };

  // mutation to toggle inactive flag on a sales group with optimistic update
  const toggleInactiveMutation = useMutation<SalesGroup, unknown, { id: number; inactive: boolean }, { previous?: SalesGroup[] }>(
    {
      mutationFn: ({ id, inactive }) => patchSalesGroup(id, { inactive }),
      onMutate: async ({ id, inactive }) => {
        await queryClient.cancelQueries({ queryKey: ["salesGroups"] });
        const previous = queryClient.getQueryData<SalesGroup[]>(["salesGroups"]);

        // optimistic update
        if (previous) {
          queryClient.setQueryData<SalesGroup[] | undefined>(["salesGroups"], () =>
            previous.map((g) => (g.id === id ? { ...g, inactive } : g))
          );
        }

        return { previous };
      },
      onError: (err, _variables, context) => {
        // rollback
        if (context?.previous) {
          queryClient.setQueryData(["salesGroups"], context.previous);
        }
        setErrorMessage(
          (err as any)?.response?.data?.message || "Failed to update. Please try again."
        );
        setErrorOpen(true);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["salesGroups"] });
      },
    }
  );

  const handleToggleInactive = (group: any) => {
    if (!group?.id) return;

    const currentlyInactive = isGroupInactive(group);
    const newInactive = !currentlyInactive;

    toggleInactiveMutation.mutate({ id: group.id, inactive: newInactive });
  };


  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Sales Groups" },
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
          <PageTitle title="Sales Groups" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() =>
              navigate("/sales/maintenance/sales-groups/add-sales-groups")
            }
          >
            Add Group
          </Button>

          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/sales/maintenance")}
          >
            Back
          </Button>
        </Stack>
      </Box>
      {/* Search Bar */}
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
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer
          component={Paper}
          elevation={2}
          sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}
        >
          <Table aria-label="sales groups table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Group Name</TableCell>
                {showInactive && <TableCell align="center">Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedGroups.length > 0 ? (
                paginatedGroups.map((group, index) => (
                  <TableRow key={group.id || index} hover>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{group.name}</TableCell>
                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={isGroupInactive(group)}
                          onChange={() => handleToggleInactive(group)}
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
                            navigate(`/sales/maintenance/sales-groups/update-sales-groups/${group.id}`)
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
                            setSelectedGroupId(group.id);
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
                  <TableCell colSpan={showInactive ? 4 : 3} align="center">
                    <Typography variant="body2">No Records Found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  colSpan={showInactive ? 4 : 3}
                  count={filteredGroups.length}
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
        title="Delete Sales Group"
        content="Are you sure you want to delete this Sales Group? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setSelectedGroupId(null)}
        deleteFunc={handleDelete}
        onSuccess={() => {
          console.log("Sales Group deleted successfully!");
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

export default SalesGroupsTable;
