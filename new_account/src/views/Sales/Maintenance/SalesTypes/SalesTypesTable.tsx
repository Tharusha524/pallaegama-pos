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
    Switch,
    FormControlLabel,
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
import { getSalesTypes, deleteSalesType, updateSalesType, SalesType } from "../../../../api/SalesMaintenance/salesService";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

function SalesTypesTable() {

    const [openDeleteModal, setOpenDeleteModal] = useState(false);
    const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);

    const [errorOpen, setErrorOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [searchQuery, setSearchQuery] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [updatingIds, setUpdatingIds] = useState<number[]>([]);
    const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
    const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales types');

    const { data: salesTypesData = [] } = useQuery({
        queryKey: ["salesTypes"],
        queryFn: getSalesTypes,
        refetchOnMount: true,
    });

    // Filter with search + inactive toggle
    const filteredSalesTypes = useMemo(() => {
        if (!salesTypesData) return [];
        let filtered = salesTypesData;

        if (!showInactive) {
            filtered = filtered.filter((type) => type.status === "Active");
        }

        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (type) =>
                    type.typeName.toLowerCase().includes(lowerQuery) ||
                    String(type.factor).toLowerCase().includes(lowerQuery) ||
                    (type.taxIncl ? "yes" : "no").includes(lowerQuery) ||
                    type.status.toLowerCase().includes(lowerQuery)
            );
        }
        return filtered;
    }, [salesTypesData, searchQuery, showInactive]);

    const paginatedSalesTypes = useMemo(() => {
        if (rowsPerPage === -1) return filteredSalesTypes;
        return filteredSalesTypes.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [filteredSalesTypes, page, rowsPerPage]);

    const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
    const handleChangeRowsPerPage = (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const queryClient = useQueryClient();

    const handleDelete = async (id: number) => {
        try {
            await deleteSalesType(id);
            queryClient.invalidateQueries({ queryKey: ["salesTypes"] });
        } catch (error) {
            console.error("Error deleting sales type:", error);
            setErrorMessage(
                error?.response?.data?.message ||
                "Failed to delete Sales Group Please try again."
            );
            setErrorOpen(true);
        } finally {
            setOpenDeleteModal(false);
            setSelectedTypeId(null);
        }
    };

    const handleToggleStatus = async (type: SalesType) => {
        if (!type?.id) return;
        const id = type.id;
        const newStatus = type.status === "Active" ? "Inactive" : "Active";

        // mark as updating
        setUpdatingIds((prev) => [...prev, id]);
        try {
            await updateSalesType(id, { ...type, status: newStatus });
            await queryClient.invalidateQueries({ queryKey: ["salesTypes"] });
        } catch (error) {
            console.error("Error updating sales type status:", error);
            setErrorMessage(
                error?.response?.data?.message ||
                "Failed to update Sales Type status. Please try again."
            );
            setErrorOpen(true);
        } finally {
            setUpdatingIds((prev) => prev.filter((i) => i !== id));
        }
    };


    const breadcrumbItems = [
        { title: "Home", href: "/dashboard" },
        { title: "Sales Types" },
    ];

    return (
        <FormPageLayout>
            {/* Header with buttons */}
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
                    <PageTitle title="Sales Types" />
                    <Breadcrumb breadcrumbs={breadcrumbItems} />
                </Box>

                <Stack direction="row" spacing={1}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => navigate("/sales/maintenance/sales-areas/add-sales-types")}
                    >
                        Add Sales Type
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
                    <Table aria-label="sales types table">
                        <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                            <TableRow>
                                <TableCell>No</TableCell>
                                <TableCell>Type Name</TableCell>
                                <TableCell>Factor</TableCell>
                                <TableCell>Tax Incl</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell align="center">Actions</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {paginatedSalesTypes.length > 0 ? (
                                paginatedSalesTypes.map((type, index) => (
                                    <TableRow key={type.id} hover>
                                        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                                        <TableCell>{type.typeName}</TableCell>
                                        <TableCell>{type.factor}</TableCell>
                                        <TableCell>{type.taxIncl ? "Yes" : "No"}</TableCell>
                                        <TableCell>
                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={type.status === "Active"}
                                                        onChange={() => handleToggleStatus(type)}
                                                        disabled={type.id ? updatingIds.includes(type.id) : false}
                                                        color="primary"
                                                        size="small"
                                                    />
                                                }
                                                label={type.status}
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Stack direction="row" spacing={1} justifyContent="center">
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    startIcon={<EditIcon />}
                                                    onClick={() => navigate(`/sales/maintenance/sales-areas/update-sales-types/${type.id}`)}
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
                                                        setSelectedTypeId(type.id);
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
                                    <TableCell colSpan={6} align="center">
                                        <Typography variant="body2">No Records Found</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>

                        <TableFooter>
                            <TableRow>
                                <TablePagination
                                    rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                                    colSpan={6}
                                    count={filteredSalesTypes.length}
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
                title="Delete Sales Type"
                content="Are you sure you want to delete this Sales Type? This action cannot be undone."
                handleClose={() => setOpenDeleteModal(false)}
                handleReject={() => setSelectedTypeId(null)}
                deleteFunc={() => selectedTypeId !== null && handleDelete(selectedTypeId)}
                onSuccess={() => console.log("Sales Type deleted successfully!")}
            />
            <ErrorModal
                open={errorOpen}
                onClose={() => setErrorOpen(false)}
                message={errorMessage}
            />
        </FormPageLayout>
    );
}

export default SalesTypesTable;
