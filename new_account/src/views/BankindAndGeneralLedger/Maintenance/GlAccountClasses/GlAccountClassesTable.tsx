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

import { getChartClasses, deleteChartClass, updateChartClass } from "../../../../api/GLAccounts/ChartClassApi";
import { getClassTypes } from "../../../../api/GLAccounts/ClassTypeApi";
import { useAuth } from "../../../../context/AuthContext";

function GlAccountClassesTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedCid, setSelectedCid] = useState<string | null>(null);

  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('GL account classes');
  const queryClient = useQueryClient();

  const { data: glAccountClassesData = [] } = useQuery({
    queryKey: ["glAccountClasses"],
    queryFn: getChartClasses,
  });

  const { data: classTypesData = [] } = useQuery({
    queryKey: ["classTypes"],
    queryFn: getClassTypes,
  });

  // Map chart type names
  const mappedClasses = useMemo(() => {
    if (!glAccountClassesData || !classTypesData) return [];
    return glAccountClassesData.map((item) => {
      const matchedType = classTypesData.find(
        (ct: any) => Number(ct.id) === Number(item.ctype)
      );
      return {
        ...item,
        classTypeName: matchedType ? matchedType.type_name : `Unknown (${item.ctype})`,
      };
    });
  }, [glAccountClassesData, classTypesData]);

  // Filter search + inactive toggle
  const filteredClasses = useMemo(() => {
    let filtered = mappedClasses;
    if (!showInactive) filtered = filtered.filter((item) => !item.inactive);

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          (item.class_name ?? "").toLowerCase().includes(lowerQuery) ||
          (item.classTypeName ?? "").toLowerCase().includes(lowerQuery)
      );
    }
    return filtered;
  }, [mappedClasses, searchQuery, showInactive]);

  const paginatedAccounts = useMemo(() => {
    if (rowsPerPage === -1) return filteredClasses;
    return filteredClasses.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredClasses, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = async () => {
    if (!selectedCid) return;
    try {
      await deleteChartClass(selectedCid);
      queryClient.invalidateQueries({ queryKey: ["glAccountClasses"] });
      setOpenDeleteModal(false);
      setSelectedCid(null);
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete GL Account Class. Please try again.");
    }
  };

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "GL Account Classes" },
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
          <PageTitle title="GL Account Classes" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() =>
              navigate("/bankingandgeneralledger/maintenance/add-gl-account-classes")
            }
          >
            Add GL Account Classes
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
          control={
            <Checkbox
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
          }
          label="Show also Inactive"
        />

        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Search..." />
        </Box>
      </Box>
      {/* Table */}
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer
          component={Paper}
          elevation={2}
          sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}
        >
          <Table aria-label="gl account classes table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Class ID</TableCell>
                <TableCell>Class Name</TableCell>
                <TableCell>Class Type</TableCell>
                {showInactive && <TableCell align="center">Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedAccounts.length > 0 ? (
                paginatedAccounts.map((item) => (
                  <TableRow key={item.cid} hover>
                    <TableCell>{item.cid}</TableCell>
                    <TableCell>{item.class_name}</TableCell>
                    <TableCell>{item.classTypeName}</TableCell>
                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={Boolean(item.inactive)}
                          onChange={async (e) => {
                            const checked = e.target.checked;
                            try {
                              await updateChartClass(item.cid, { ...item, inactive: checked });
                              queryClient.invalidateQueries({ queryKey: ["glAccountClasses"] });
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
                              `/bankingandgeneralledger/maintenance/update-gl-account-classes/${item.cid}`
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
                            setSelectedCid(item.cid);
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
                  count={filteredClasses.length}
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
      {/*  Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={openDeleteModal}
        title="Delete GL Account Class"
        content="Are you sure you want to delete this GL Account Class? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setSelectedCid(null)}
        deleteFunc={handleDelete}
      />
    </FormPageLayout>
  );
}

export default GlAccountClassesTable;
