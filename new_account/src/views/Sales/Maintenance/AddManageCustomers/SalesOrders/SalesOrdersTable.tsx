import { FormPageLayout } from "../../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect, useMemo } from "react";
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
    Typography,
    TextField,
    useMediaQuery,
    Theme,
    Button,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PrintIcon from "@mui/icons-material/Print";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../../components/BreadCrumb";
import PageTitle from "../../../../../components/PageTitle";
import theme from "../../../../../theme";
import DatePickerComponent from "../../../../../components/DatePickerComponent";
import { getSalesOrders } from "../../../../../api/SalesOrders/SalesOrdersApi";
import { getCustomers } from "../../../../../api/Customer/AddCustomerApi";
import { getBranches } from "../../../../../api/CustomerBranch/CustomerBranchApi";
import { getInventoryLocations } from "../../../../../api/InventoryLocation/InventoryLocationApi";
import { getItems } from "../../../../../api/Item/ItemApi";
import { getSalesOrderDetails } from "../../../../../api/SalesOrders/SalesOrderDetailsApi";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../../../context/AuthContext";

interface SalesOrdersProps {
    customerId?: string | number;
}



export default function SalesOrdersTable({ customerId }: SalesOrdersProps) {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [searchFilters, setSearchFilters] = useState({
        order: "",
        ref: "",
        fromDate: null as Date | null,
        toDate: null as Date | null,
        location: "",
        item: "",
    });

    const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
    const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales customer and branches changes');

    const { data: salesOrders = [], isLoading, error } = useQuery({ queryKey: ["salesOrders"], queryFn: () => getSalesOrders() });
    const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => getCustomers() });
    const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => getBranches() });
    const { data: locations = [] } = useQuery({ queryKey: ["inventoryLocations"], queryFn: () => getInventoryLocations() });
    const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: () => getItems() });
    const { data: salesOrderDetails = [] } = useQuery({ queryKey: ["salesOrderDetails"], queryFn: () => getSalesOrderDetails() });

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSearchFilters({ ...searchFilters, [name]: value });
    };

    const handleDateChange = (name: string, date: Date | null) => {
        setSearchFilters({ ...searchFilters, [name]: date });
    };

    // Filtered data
    const filteredData = useMemo(() => {
        return salesOrders.filter((so) => {
            // Match customer
            const matchesCustomer = !customerId || so.debtor_no == customerId;

            // Match order #
            const matchesOrder = searchFilters.order
                ? so.order_no.toString().toLowerCase().includes(searchFilters.order.toLowerCase())
                : true;

            // Match customer order ref
            const matchesRef = searchFilters.ref
                ? so.reference.toLowerCase().includes(searchFilters.ref.toLowerCase())
                : true;

            // Match location (inventory location)
            const matchesLocation = searchFilters.location
                ? so.from_stk_loc === searchFilters.location
                : true;

            // Match item/template
            const matchesItem = searchFilters.item
                ? salesOrderDetails.some(d => d.order_no == so.order_no && d.stk_code == searchFilters.item)
                : true;

            // Match dates
            let matchesDate = true;

            if (searchFilters.fromDate) {
                matchesDate =
                    new Date(so.ord_date).getTime() >= searchFilters.fromDate.getTime();
            }

            if (matchesDate && searchFilters.toDate) {
                matchesDate =
                    new Date(so.delivery_date).getTime() <= searchFilters.toDate.getTime();
            }

            // Match trans_type = 30
            const matchesType = so.trans_type == 30;

            return matchesOrder && matchesRef && matchesLocation && matchesItem && matchesDate && matchesType && matchesCustomer;
        });
    }, [salesOrders, searchFilters, customerId, salesOrderDetails]);


    const paginatedData = useMemo(() => {
        if (rowsPerPage === -1) return filteredData;
        return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [filteredData, page, rowsPerPage]);

    const handleChangePage = (_event: any, newPage: number) => setPage(newPage);
    const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(e.target.value, 10));
        setPage(0);
    };

    const handleDelete = (id: number) => {
        alert(`Delete Sales Order with id: ${id}`);
    };

    const breadcrumbItems = [
        { title: "Home", href: "/dashboard" },
        { title: "Sales Orders" },
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
                    <PageTitle title="Sales Orders" />
                    <Breadcrumb breadcrumbs={breadcrumbItems} />
                </Box>

                
            </Box>
            {/* Search & Filter */}
            <Grid container spacing={2} sx={{ px: 2, mb: 2 }}>
                {/* Order # */}
                <Grid item xs={12} sm={2}>
                    <TextField
                        fullWidth
                        label="#"
                        name="order"
                        size="small"
                        value={searchFilters.order}
                        onChange={handleFilterChange}
                    />
                </Grid>

                {/* Ref */}
                <Grid item xs={12} sm={2}>
                    <TextField
                        fullWidth
                        label="Ref"
                        name="ref"
                        size="small"
                        value={searchFilters.ref}
                        onChange={handleFilterChange}
                    />
                </Grid>

                {/* From Date */}
                <Grid item xs={12} sm={3} sx={{ display: "flex", alignItems: "center" }}>
                    <Typography variant="body2" sx={{ mr: 1 }}>From Date:</Typography>
                    <DatePickerComponent
                        label=""
                        value={searchFilters.fromDate}
                        onChange={(date) => handleDateChange("fromDate", date)}
                    />
                </Grid>

                {/* To Date */}
                <Grid item xs={12} sm={3} sx={{ display: "flex", alignItems: "center" }}>
                    <Typography variant="body2" sx={{ mr: 1 }}>To Date:</Typography>
                    <DatePickerComponent
                        label=""
                        value={searchFilters.toDate}
                        onChange={(date) => handleDateChange("toDate", date)}
                    />
                </Grid>

                {/* Location */}
                <Grid item xs={12} sm={2}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Location</InputLabel>
                        <Select
                            value={searchFilters.location}
                            label="Location"
                            onChange={(e) => setSearchFilters({ ...searchFilters, location: e.target.value })}
                        >
                            <MenuItem value="">
                                <em>All</em>
                            </MenuItem>
                            {locations.map((loc) => (
                                <MenuItem key={loc.loc_code} value={loc.loc_code}>
                                    {loc.location_name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                {/* Item / Template */}
                <Grid item xs={12} sm={4}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <TextField
                            label="Item Code"
                            size="small"
                            value={searchFilters.item}
                            onChange={(e) => setSearchFilters({ ...searchFilters, item: e.target.value })}
                            sx={{ minWidth: 100 }}
                        />
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>Item</InputLabel>
                            <Select
                                value={searchFilters.item}
                                label="Item"
                                onChange={(e) => setSearchFilters({ ...searchFilters, item: e.target.value })}
                            >
                                <MenuItem value="">
                                    <em>All</em>
                                </MenuItem>
                                {items.map((item) => (
                                    <MenuItem key={item.stock_id} value={item.stock_id}>
                                        {item.description}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </Grid>
            </Grid>
            <Stack sx={{ alignItems: "center" }}>
                <TableContainer component={Paper} elevation={2} sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}>
                    <Table aria-label="sales orders table">
                        <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                            <TableRow>
                                <TableCell>Order</TableCell>
                                <TableCell>Ref</TableCell>
                                <TableCell>Customer</TableCell>
                                <TableCell>Branch</TableCell>
                                <TableCell>Cust Order Ref</TableCell>
                                <TableCell>Order Date</TableCell>
                                <TableCell>Required By</TableCell>
                                <TableCell>Delivery To</TableCell>
                                <TableCell>Order Total</TableCell>
                                <TableCell>Currency</TableCell>
                                <TableCell>Tmpl</TableCell>
                                <TableCell align="center">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={12} align="center">
                                        <Typography variant="body2">Loading...</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : error ? (
                                <TableRow>
                                    <TableCell colSpan={12} align="center">
                                        <Typography variant="body2" color="error">Error loading data</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : paginatedData.length > 0 ? (
                                paginatedData.map((so) => {
                                    const customer = customers.find(c => c.debtor_no === so.debtor_no);
                                    const branch = branches.find(b => b.branch_code === so.branch_code);
                                    return (
                                    <TableRow key={so.order_no || so.id} hover>
                                        <TableCell>{so.order_no || so.order}</TableCell>
                                        <TableCell>{so.reference}</TableCell>
                                        <TableCell>{customer?.name || so.debtor_no}</TableCell>
                                        <TableCell>{branch?.br_name || so.branch_code}</TableCell>
                                        <TableCell>{so.custOrderRef}</TableCell>
                                        <TableCell>{so.ord_date}</TableCell>
                                        <TableCell>{so.delivery_date}</TableCell>
                                        <TableCell>{so.deliver_to}</TableCell>
                                        <TableCell>{so.total}</TableCell>
                                        <TableCell>{customer?.curr_code}</TableCell>
                                        <TableCell>{so.tmpl}</TableCell>
                                        <TableCell align="center">
                                            <Stack direction="row" spacing={1} justifyContent="center">
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<PrintIcon />}
                                                    onClick={() =>
                                                        navigate(
                                                            "/sales/transactions/sales-order-entry/view-sales-order",
                                                            {
                                                                state: {
                                                                    orderNo: so.order_no ?? so.order,
                                                                    autoPrint: true,
                                                                },
                                                            }
                                                        )
                                                    }
                                                >
                                                    Print
                                                </Button>
                                                {/* <Button
                                                    variant="contained"
                                                    size="small"
                                                    startIcon={<EditIcon />}
                                                    onClick={() => navigate(`/sales/orders/update/${so.id}`)}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                  disabled={!canEdit}
                                                    variant="outlined"
                                                    size="small"
                                                    color="error"
                                                    startIcon={<DeleteIcon />}
                                                    onClick={() => handleDelete(so.id)}
                                                >
                                                    Delete
                                                </Button> */}
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={12} align="center">
                                        <Typography variant="body2">No Records Found</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TablePagination
                                    rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                                    colSpan={12}
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
        </FormPageLayout>
    );
}
