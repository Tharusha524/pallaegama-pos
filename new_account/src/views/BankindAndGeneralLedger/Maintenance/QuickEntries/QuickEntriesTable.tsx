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
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import SearchBar from "../../../../components/SearchBar";
import theme from "../../../../theme";
import { deleteQuickEntry, getQuickEntries } from "../../../../api/QuickEntry/QuickEntryApi";
import { useSnackbar } from "notistack";
import { useAuth } from "../../../../context/AuthContext";

function QuickEntriesTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Quick GL entry definitions');
  const { enqueueSnackbar } = useSnackbar();

  const { data: quickEntriesData = [], refetch } = useQuery({
    queryKey: ["quickEntries"],
    queryFn: getQuickEntries,
  });

  // Filter with search
  const filteredEntries = useMemo(() => {
    if (!quickEntriesData) return [];
    if (!searchQuery.trim()) return quickEntriesData;

    const lowerQuery = searchQuery.toLowerCase();
    return quickEntriesData.filter(
      (item) =>
        (item.name ?? item.description ?? "").toLowerCase().includes(lowerQuery) ||
        (item.entry_type ?? "").toLowerCase().includes(lowerQuery) ||
        (item.usage ?? "").toLowerCase().includes(lowerQuery)
    );
  }, [quickEntriesData, searchQuery]);

  const paginatedEntries = useMemo(() => {
    if (rowsPerPage === -1) return filteredEntries;
    return filteredEntries.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredEntries, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this quick entry?")) return;
    try {
      await deleteQuickEntry(id);
      enqueueSnackbar("Quick entry deleted.", { variant: "success" });
      refetch();
    } catch {
      enqueueSnackbar("Failed to delete quick entry.", { variant: "error" });
    }
  };

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Quick Entries" },
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
          <PageTitle title="Quick Entries" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/bankingandgeneralledger/maintenance/add-quick-entry")}
          >
            Add Quick Entry
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
      {/* Search */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          px: 2,
          mb: 2,
          width: "100%",
        }}
      >
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
          <Table aria-label="quick entries table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>No</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Usage</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedEntries.length > 0 ? (
                paginatedEntries.map((item, index) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{item.name ?? item.description}</TableCell>
                    <TableCell>{item.entry_type ?? (item as any).type}</TableCell>
                    <TableCell>{item.usage ?? ""}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() =>
                            navigate("/bankingandgeneralledger/maintenance/update-quick-entry")
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
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2">No Records Found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  colSpan={5}
                  count={filteredEntries.length}
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
    </FormPageLayout>
  );
}

export default QuickEntriesTable;
