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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import SearchBar from "../../../../components/SearchBar";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import theme from "../../../../theme";

import { getChartClasses } from "../../../../api/GLAccounts/ChartClassApi";
import { getChartTypes, deleteChartType, updateChartType } from "../../../../api/GLAccounts/ChartTypeApi";
import { useAuth } from "../../../../context/AuthContext";

function GlAccountGroupsTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('GL account groups');
  const queryClient = useQueryClient();

  const { data: chartTypesData = [] } = useQuery({
    queryKey: ["chartTypes"],
    queryFn: getChartTypes,
    refetchOnMount: true,
  });

  const { data: chartClassesData = [] } = useQuery({
    queryKey: ["chartClasses"],
    queryFn: getChartClasses,
    refetchOnMount: true,
  });

  // Map class_id -> class_name AND parent -> parent_name
  const mappedGroups = useMemo(() => {
    if (!chartTypesData || !chartClassesData) return [];

    return chartTypesData.map((item: any) => {
      const matchedClass = chartClassesData.find((cc: any) => cc.cid === item.class_id);
      const parentGroup = chartTypesData.find((g: any) => String(g.id) === String(item.parent));

      return {
        ...item,
        className: matchedClass ? matchedClass.class_name : `Unknown (${item.class_id})`,
        parentName: parentGroup ? parentGroup.name : "-",
      };
    });
  }, [chartTypesData, chartClassesData]);

  // Filter: search + showInactive toggle
  const filteredGroups = useMemo(() => {
    let filtered = mappedGroups;
    if (!showInactive) filtered = filtered.filter((item: any) => item.inactive === 0);

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item: any) =>
          (item.name ?? "").toLowerCase().includes(lowerQuery) ||
          (item.className ?? "").toLowerCase().includes(lowerQuery) ||
          (item.parent ?? "").toLowerCase().includes(lowerQuery)
      );
    }
    return filtered;
  }, [mappedGroups, searchQuery, showInactive]);

  const paginatedGroups = useMemo(() => {
    if (rowsPerPage === -1) return filteredGroups;
    return filteredGroups.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredGroups, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await deleteChartType(selectedId);
      queryClient.invalidateQueries({ queryKey: ["chartTypes"] });
      setOpenDeleteModal(false);
      setSelectedId(null);
    } catch (error) {
      console.error("Failed to delete GL Account Group:", error);
      alert("Failed to delete GL Account Group. Please try again.");
    }
  };

  const handleToggleInactive = async (item: any) => {
    try {
      const newInactive = item.inactive === 1 ? 0 : 1;
      // send only the inactive flag; backend should accept partial updates
      await updateChartType(item.id, { inactive: newInactive });
      queryClient.invalidateQueries({ queryKey: ["chartTypes"] });
    } catch (error) {
      console.error("Failed to update inactive flag:", error);
      alert("Failed to update inactive flag. Please try again.");
    }
  };

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "GL Account Groups" },
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
          <PageTitle title="GL Account Groups" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/bankingandgeneralledger/maintenance/add-gl-account-groups")}
          >
            Add GL Account Groups
          </Button>

          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
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
          control={<Checkbox checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />}
          label="Show also Inactive"
        />

        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Search..." />
        </Box>
      </Box>
      {/* Table */}
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer component={Paper} elevation={2} sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}>
          <Table aria-label="gl account groups table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Group ID</TableCell>
                <TableCell>Group Name</TableCell>
                <TableCell>Subgroup of</TableCell>
                <TableCell>Class</TableCell>
                {showInactive && <TableCell align="center">Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedGroups.length > 0 ? (
                paginatedGroups.map((item: any) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.parentName}</TableCell>
                    <TableCell>{item.className}</TableCell>
                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={Number(item.inactive) === 1}
                          onChange={() => handleToggleInactive(item)}
                          inputProps={{ 'aria-label': `inactive-${item.id}` }}
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
                            navigate(`/bankingandgeneralledger/maintenance/update-gl-account-groups/${item.id}`)
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
                  <TableCell colSpan={10} align="center">
                    <Typography variant="body2">No Records Found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  colSpan={10}
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
      {/* ✅ Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={openDeleteModal}
        title="Delete GL Account Group"
        content="Are you sure you want to delete this GL Account Group? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setSelectedId(null)}
        deleteFunc={handleDelete}
      />
    </FormPageLayout>
  );
}

export default GlAccountGroupsTable;
