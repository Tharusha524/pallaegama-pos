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
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import SearchBar from "../../../../components/SearchBar";
import { getSalesAreas, deleteSalesArea, SalesArea, patchSalesArea } from "../../../../api/SalesMaintenance/salesService";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

function SalesAreaTable() {

  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales areas maintenance');
  const queryClient = useQueryClient();

  const { data: salesAreas = [] } = useQuery<SalesArea[]>({
    queryKey: ["salesAreas"],
    queryFn: getSalesAreas,
    refetchOnMount: true,
  });

  const filteredAreas = useMemo(() => {
    if (!salesAreas) return [];

    let filtered = salesAreas;

    // when showInactive is false, hide items that are marked inactive
    if (!showInactive) {
      filtered = filtered.filter((item) => !item.inactive);
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter((area) =>
        area.name.toLowerCase().includes(lowerQuery)
      );
    }

    return filtered;
  }, [salesAreas, searchQuery, showInactive]);

  const paginatedAreas = useMemo(() => {
    if (rowsPerPage === -1) return filteredAreas;
    return filteredAreas.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [filteredAreas, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = async () => {
    if (!selectedAreaId) return;

    try {
      await deleteSalesArea(selectedAreaId);
      queryClient.invalidateQueries({ queryKey: ["salesAreas"] });
    } catch (error) {
      console.error("Failed to delete sales area:", error);
      setErrorMessage(
        error?.response?.data?.message ||
        "Failed to delete Sales Area Please try again."
      );
      setErrorOpen(true);
    } finally {
      setOpenDeleteModal(false);
      setSelectedAreaId(null);
    }
  };

  const toggleInactive = async (areaId: number | undefined, newValue: boolean) => {
    if (!areaId) return;

    // optimistic update
    const previous = queryClient.getQueryData<SalesArea[]>(["salesAreas"]);

    queryClient.setQueryData<SalesArea[] | undefined>(["salesAreas"], (old) => {
      if (!old) return old;
      return old.map((a) => (a.id === areaId ? { ...a, inactive: newValue } : a));
    });

    try {
      await patchSalesArea(areaId, { inactive: newValue });
      // refresh to ensure server truth
      queryClient.invalidateQueries({ queryKey: ["salesAreas"] });
    } catch (error) {
      // rollback
      queryClient.setQueryData(["salesAreas"], previous);
      console.error("Failed to update inactive flag:", error);
      setErrorMessage(
        // @ts-ignore
        error?.response?.data?.message || "Failed to update Inactive flag. Please try again."
      );
      setErrorOpen(true);
    }
  };


  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Sales Areas" },
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
          <PageTitle title="Sales Areas" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/sales/maintenance/sales-areas/add-sales-area")}
          >
            Add Area
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
          <Table aria-label="sales area table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>No</TableCell>
                <TableCell>Area Name</TableCell>
                {showInactive && <TableCell align="center">Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedAreas.length > 0 ? (
                paginatedAreas.map((area, index) => (
                  <TableRow key={area.id} hover>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{area.name}</TableCell>
                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={!!area.inactive}
                          onChange={(e) => toggleInactive(area.id, e.target.checked)}
                          inputProps={{ 'aria-label': `inactive-${area.id}` }}
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
                            navigate(`/sales/maintenance/sales-areas/update-sales-area/${area.id}`)
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
                            setSelectedAreaId(area.id);
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
                  count={filteredAreas.length}
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
        title="Delete Sales Area"
        content="Are you sure you want to delete this Sales Area? This action cannot be undone."
        handleClose={() => setOpenDeleteModal(false)}
        handleReject={() => setSelectedAreaId(null)}
        deleteFunc={handleDelete}
        onSuccess={() => console.log("Sales Area deleted successfully!")}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}

export default SalesAreaTable;
