import { FormPageLayout } from "../../../../../components/Layout/FormPageLayout";
import React, { useState, useMemo, useEffect } from "react";
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
import { useNavigate } from "react-router-dom";
import theme from "../../../../../theme";
import Breadcrumb from "../../../../../components/BreadCrumb";
import PageTitle from "../../../../../components/PageTitle";
import SearchBar from "../../../../../components/SearchBar";
import { getStockMoves } from "../../../../../api/StockMoves/StockMovesApi";
import { getInventoryLocations } from "../../../../../api/InventoryLocation/InventoryLocationApi";
import { getLocStocks } from "../../../../../api/LocStock/LocStockApi";
import { useAuth } from "../../../../../context/AuthContext";

interface ItemStatusProps {
  itemId?: string | number;
}

interface Status {
    id: number;
    location: string;
    quantityOnHand: number;
    reorderLevel: number;
    demand: number;
    available: number;
    onOrder: number;
}

function StatusTable({ itemId }: ItemStatusProps) {
    const [statusData, setStatusData] = useState<Status[]>([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Stock status view');
    const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));

    // Fetch data from stock_moves and inventory_locations for the selected item
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [stockMovesData, locationsData, locStocksData] = await Promise.all([
                    getStockMoves(),
                    getInventoryLocations(),
                    getLocStocks()
                ]);

                // Create map of loc_code to location_name
                const locationMap = new Map<string, string>();
                locationsData.forEach(loc => {
                    locationMap.set(loc.loc_code, loc.location_name);
                });

                // Create map of loc_code-stock_id to reorder_level
                const reorderMap = new Map<string, number>();
                locStocksData.forEach(stock => {
                    reorderMap.set(`${stock.loc_code}-${stock.stock_id}`, stock.reorder_level);
                });

                // Filter stock_moves by stock_id (itemId)
                const filteredMoves = itemId ? stockMovesData.filter((move: any) => move.stock_id === itemId) : stockMovesData;

                // Helper: sum qty for a given locCode
                const sumQtyForLoc = (locCode: string) => {
                    return filteredMoves
                        .filter((m: any) => String(m.loc_code) === String(locCode))
                        .reduce((s: number, m: any) => s + (parseFloat(m.qty) || 0), 0);
                };

                // Map ALL locations to Status format (show zero qty for locations with no moves)
                const mappedData: Status[] = locationsData.map((loc: any, index: number) => {
                    const locCode = loc.loc_code;
                    const qty = sumQtyForLoc(locCode);
                    return {
                        id: index + 1,
                        location: locationMap.get(locCode) || locCode,
                        quantityOnHand: qty,
                        reorderLevel: reorderMap.get(`${locCode}-${itemId}`) || 0,
                        demand: 0,
                        available: 0,
                        onOrder: 0,
                    } as Status;
                });

                setStatusData(mappedData);
            } catch (error) {
                console.error("Error fetching data:", error);
                setStatusData([]);
            }
        };

        if (itemId) {
            fetchData();
        } else {
            setStatusData([]);
        }
    }, [itemId]);

    const filteredData = useMemo(() => {
        return statusData.filter(item =>
            item.location.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [statusData, searchQuery]);

    const paginatedData = useMemo(() => {
        if (rowsPerPage === -1) return filteredData;
        return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [filteredData, page, rowsPerPage]);

    const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleDelete = (id: number) => {
        if (window.confirm("Are you sure you want to delete this entry?")) {
            setStatusData(prev => prev.filter(item => item.id !== id));
        }
    };

    const breadcrumbItems = [
        { title: "Home", href: "/dashboard" },
        { title: "Status" },
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
                    <PageTitle title="Status" />
                    <Breadcrumb breadcrumbs={breadcrumbItems} />
                </Box>

                <Stack direction="row" spacing={1}>


                    <Button
                        variant="outlined"
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate("/itemsandinventory/maintenance/items")}
                    >
                        Back
                    </Button>
                </Stack>
            </Box>
            {/* Search */}
            <Stack
                direction="row"
                sx={{ px: 2, mb: 2, width: "100%", justifyContent: "flex-end" }}
            >
                <Box sx={{ width: isMobile ? "100%" : "300px" }}>
                    <SearchBar
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        placeholder="Search by location..."
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
                    <Table aria-label="status table">
                        <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                            <TableRow>
                                <TableCell>No</TableCell>
                                <TableCell>Location</TableCell>
                                <TableCell>Quantity on Hand</TableCell>
                                <TableCell>Reorder Level</TableCell>
                                <TableCell>Demand</TableCell>
                                <TableCell>Available</TableCell>
                                <TableCell>On Order</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {paginatedData.length > 0 ? (
                                paginatedData.map((item, index) => (
                                    <TableRow key={item.id} hover>
                                        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                                        <TableCell>{item.location}</TableCell>
                                        <TableCell>{item.quantityOnHand}</TableCell>
                                        <TableCell>{item.reorderLevel}</TableCell>
                                        <TableCell>{item.demand}</TableCell>
                                        <TableCell>{item.quantityOnHand - item.demand}</TableCell>
                                        <TableCell>{item.onOrder}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} align="center">
                                        <Typography variant="body2">No Records Found</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>

                        <TableFooter>
                            <TableRow>
                                <TablePagination
                                    rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                                    colSpan={8}
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
        </FormPageLayout>
    );
}

export default StatusTable;
