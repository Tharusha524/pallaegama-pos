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
  Checkbox,
  FormControlLabel,
  useMediaQuery,
  Theme,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import theme from "../../../../theme";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import SearchBar from "../../../../components/SearchBar";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import { getAccountTags, deleteAccountTag, updateAccountTag } from "../../../../api/AccountTag/AccountTagsApi";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

export default function AccountTagsTable() {
  const [tags, setTags] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [showInactive, setShowInactive] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('GL Account tags');

  // Load tags
  const loadTags = async () => {
    try {
      const data = await getAccountTags();
      setTags(data);
    } catch (error) {
      console.error("Error fetching account tags:", error);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  // Search filter
  const isTagInactive = (item: any) => {
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

  const filteredData = useMemo(() => {
    let data = showInactive ? tags : tags.filter((t) => !isTagInactive(t));
    if (!searchQuery.trim()) return data;
    const lower = searchQuery.toLowerCase();
    return data.filter(
      (t) =>
        (t.tag_name || t.name || "").toString().toLowerCase().includes(lower) ||
        (t.tag_description || t.description || "").toString().toLowerCase().includes(lower)
    );
  }, [tags, searchQuery, showInactive]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await deleteAccountTag(selectedId);
      setOpenDeleteModal(false);
      setSelectedId(null);
      loadTags();
    } catch (error) {
      console.error("Error deleting account tag:", error);
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to delete account tag Please try again."
      );
      setErrorOpen(true);
    }
  };

  const handleToggleInactive = async (item: any, checked: boolean) => {
    if (!item || !item.id) return;
    setUpdatingIds((p) => [...p, item.id]);
    try {
      await updateAccountTag(item.id, { ...item, inactive: checked });
      await loadTags();
    } catch (error) {
      console.error("Error updating account tag:", error);
      setErrorMessage(
        error?.response?.data?.message || "Failed to update account tag. Please try again."
      );
      setErrorOpen(true);
    } finally {
      setUpdatingIds((p) => p.filter((id) => id !== item.id));
    }
  };

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Account Tags" },
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
          <PageTitle title="Account Tags" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() =>
              navigate("/bankingandgeneralledger/maintenance/add-account-tags")
            }
          >
            Add Account Tag
          </Button>

          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/bankingandgeneralledger/maintenance/")}
          >
            Back
          </Button>
        </Stack>
      </Box>
      {/* Search */}
      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={2}
        sx={{ px: 2, mb: 2, alignItems: "center", justifyContent: "space-between" }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
            }
            label="Show also Inactive"
          />
        </Box>

        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Search tags..."
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
          <Table aria-label="account tags table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Tag Name</TableCell>
                <TableCell>Tag Description</TableCell>
                {showInactive && <TableCell align="center">Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((tag) => (
                  <TableRow key={tag.id} hover>
                    <TableCell>{tag.name}</TableCell>
                    <TableCell>{tag.description}</TableCell>
                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={isTagInactive(tag)}
                          disabled={updatingIds.includes(tag.id)}
                          onChange={(e) => handleToggleInactive(tag, e.target.checked)}
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
                              `/bankingandgeneralledger/maintenance/update-account-tags/${tag.id}`
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
                            setSelectedId(tag.id);
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
        title="Delete Account Tag"
        content="Are you sure you want to delete this account tag? This action cannot be undone."
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
