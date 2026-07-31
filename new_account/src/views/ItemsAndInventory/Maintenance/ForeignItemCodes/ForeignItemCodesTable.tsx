import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useMemo, useState, useEffect } from "react";
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
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    ListSubheader,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getItems } from "../../../../api/Item/ItemApi";
import { getItemCodes, deleteItemCode } from "../../../../api/ItemCodes/ItemCodesApi";
import { resolveStockId } from "../../../../utils/itemCodePayload";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

function ForeignItemCodesTable() {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedItem, setSelectedItem] = useState(""); // dropdown state

    const [openDeleteModal, setOpenDeleteModal] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [errorOpen, setErrorOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
    const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Foreign item codes entry');
    const queryClient = useQueryClient();

    const { data: rawForeignItemData } = useQuery({
        queryKey: ["item-codes"],
        queryFn: getItemCodes,
    });

    const { data: rawItems } = useQuery({
        queryKey: ["items"],
        queryFn: getItems,
    });

    const { data: categories = [] } = useQuery({
        queryKey: ["itemCategories"],
        queryFn: () => import("../../../../api/ItemCategories/ItemCategoriesApi").then(m => m.getItemCategories()) as Promise<{ category_id: number; description: string }[]>,
    });

    // Mutation to delete item code
    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteItemCode(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["item-codes"] });
        },
    });

    // Backend may return `{ data: [...] }` or the array directly. Normalize to array.
    const foreignItemData = rawForeignItemData?.data ?? rawForeignItemData ?? [];
    const items = rawItems?.data ?? rawItems ?? [];

    // Fetch item units so we can display unit text
    const { data: rawItemUnits } = useQuery({
        queryKey: ["item-units"],
        queryFn: () => import("../../../../api/ItemUnit/ItemUnitApi").then(m => m.getItemUnits()),
    });
    const itemUnits = rawItemUnits?.data ?? rawItemUnits ?? [];

    // Auto-select the first item when items load and nothing is selected yet
    useEffect(() => {
        if ((!selectedItem || String(selectedItem).trim() === "") && items && items.length > 0) {
            const firstStockId = resolveStockId(items[0]);
            if (firstStockId) setSelectedItem(firstStockId);
        }
    }, [items]);

    // Filter data based on selected item and search query
    const filteredData = useMemo(() => {
        // Only filter when an item is selected
        if (!selectedItem) return [];

        // The only shared column between items and item-codes is `stock_id`.
        // Match item-codes where code.stock_id === selectedItem and is_foreign === 1.
        const result = foreignItemData.filter((code: any) => {
            const codeStockId = code.stock_id ?? code.stockMasterId ?? code.stock_master?.stock_id ?? code.stock_master_id ?? code.item_id ?? code.itemId;
            return String(codeStockId) === String(selectedItem) && Number(code.is_foreign) === 1;
        });

        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            return result.filter((item: any) => {
                const codeStr = String(item.item_code ?? item.code ?? "").toLowerCase();
                const desc = String(item.description ?? "").toLowerCase();
                const cat = String(item.category_id ?? item.category ?? "").toLowerCase();
                return (
                    codeStr.includes(lowerQuery) ||
                    desc.includes(lowerQuery) ||
                    cat.includes(lowerQuery)
                );
            });
        }

        return result;
    }, [foreignItemData, selectedItem, searchQuery]);


    const paginatedData = useMemo(() => {
        if (rowsPerPage === -1) return filteredData;
        return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [filteredData, page, rowsPerPage]);

    const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleDeleteClick = (id: number) => {
        setSelectedId(id);
        setOpenDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (!selectedId) return;
        try {
            await deleteMutation.mutateAsync(selectedId);
            setOpenDeleteModal(false);
            setSelectedId(null);
        } catch (error) {
            console.error("Failed to delete foreign item code:", error);
            setErrorMessage("Failed to delete the foreign item code. Please try again.");
            setErrorOpen(true);
            setOpenDeleteModal(false);
            setSelectedId(null);
        }
    };

    const breadcrumbItems = [
        { title: "Home", href: "/dashboard" },
        { title: "Foreign Item Codes" },
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
                    flexWrap: "wrap",
                    gap: 2,
                }}
            >
                <Box>
                    <PageTitle title="Foreign Item Codes" />
                    <Breadcrumb breadcrumbs={breadcrumbItems} />
                </Box>

                <Box sx={{ px: 2, mb: 2 }}>
                    <FormControl sx={{ minWidth: 250 }}>
                        <InputLabel>Select Item</InputLabel>
                        <Select
                            value={selectedItem}
                            label="Select Item"
                            onChange={(e) => setSelectedItem(e.target.value)}
                        >
                            <MenuItem value="">Select item</MenuItem>
                            {items && items.length > 0 ? (
                                (() => {
                                    return Object.entries(
                                        items.reduce((groups: Record<string, any[]>, item) => {
                                            const catId = item.category_id || "Uncategorized";
                                            if (!groups[catId]) groups[catId] = [];
                                            groups[catId].push(item);
                                            return groups;
                                        }, {} as Record<string, any[]>)
                                    ).map(([categoryId, groupedItems]: [string, any[]]) => {
                                        const category = categories.find(cat => cat.category_id === Number(categoryId));
                                        const categoryLabel = category ? category.description : `Category ${categoryId}`;
                                        return [
                                            <ListSubheader key={`cat-${categoryId}`}>
                                                {categoryLabel}
                                            </ListSubheader>,
                                            groupedItems.map((item) => {
                                                const stockId = resolveStockId(item);
                                                if (!stockId) return null;
                                                const label = item.item_name ?? item.name ?? item.description ?? stockId;
                                                return (
                                                    <MenuItem key={stockId} value={stockId}>
                                                        {label}
                                                    </MenuItem>
                                                );
                                            })
                                        ];
                                    });
                                })()
                            ) : (
                                <MenuItem disabled value="">
                                    No items
                                </MenuItem>
                            )}
                        </Select>
                    </FormControl>
                </Box>

                <Stack direction="row" spacing={1}>
                    <Button
                        variant="contained"
                        color="primary"
                        disabled={!selectedItem}
                        onClick={() =>
                            navigate(
                                `/itemsandinventory/maintenance/add-foreign-item-codes?stock_id=${encodeURIComponent(selectedItem)}`,
                                { state: { stock_id: selectedItem } }
                            )
                        }
                    >
                        Add Item
                    </Button>
                    <Button variant="outlined" startIcon={<ArrowBackIcon />}
                        onClick={() => navigate("/itemsandinventory/maintenance/")}>
                        Back
                    </Button>
                </Stack>
            </Box>
            {/* Search bar only visible if item is selected */}
            {selectedItem && (
                <Box sx={{ display: "flex", justifyContent: "flex-end", px: 2, mb: 2 }}>
                    <TextField
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        size="small"
                    />
                </Box>
            )}
            {/* Table */}
            {selectedItem && (
                <Stack sx={{ alignItems: "center" }}>
                    <TableContainer
                        component={Paper}
                        elevation={2}
                        sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}
                    >
                        <Table aria-label="foreign item codes table">
                            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                                <TableRow>
                                    <TableCell>No</TableCell>
                                    <TableCell>EAN/UPC Code</TableCell>
                                    <TableCell>Quantity</TableCell>
                                    <TableCell>Units</TableCell>
                                    <TableCell>Description</TableCell>
                                    <TableCell>Category</TableCell>
                                    <TableCell align="center">Actions</TableCell>
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {paginatedData.length > 0 ? (
                                    paginatedData.map((item, index) => (
                                        <TableRow key={item.id ?? index} hover>
                                            <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                                            <TableCell>{item.item_code ?? item.code}</TableCell>
                                            <TableCell>{item.quantity}</TableCell>
                                            <TableCell>
                                                {
                                                    // resolve corresponding item and map its units id to unit text
                                                    (() => {
                                                        const codeStockId = item.stock_id ?? item.stockMasterId ?? item.stock_master?.stock_id ?? item.stock_master_id ?? item.item_id ?? item.itemId;
                                                        const correspondingItem = items.find((it: any) => String(it.stock_id ?? it.id) === String(codeStockId));
                                                        if (correspondingItem) {
                                                            const unitId = correspondingItem.units ?? correspondingItem.unit ?? correspondingItem.unit_id;
                                                            if (unitId && itemUnits && itemUnits.length > 0) {
                                                                const u = itemUnits.find((uu: any) => String(uu.id) === String(unitId));
                                                                if (u) return u.description ?? u.name ?? u.abbr ?? String(unitId);
                                                            }
                                                            return correspondingItem.unit_name ?? correspondingItem.unit ?? correspondingItem.units ?? "each";
                                                        }
                                                        return "each";
                                                    })()
                                                }
                                            </TableCell>
                                            <TableCell>{item.description}</TableCell>
                                            <TableCell>{item.category_id ?? item.category}</TableCell>
                                            <TableCell align="center">
                                                <Stack direction="row" spacing={1} justifyContent="center">
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        startIcon={<EditIcon />}
                                                        onClick={() => navigate("/itemsandinventory/maintenance/update-foreign-item-codes", { state: { stock_id: selectedItem, itemCode: item } })}
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                      disabled={!canEdit}
                                                        variant="outlined"
                                                        size="small"
                                                        color="error"
                                                        startIcon={<DeleteIcon />}
                                                        onClick={() => handleDeleteClick(item.id)}
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
                                        colSpan={7}
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
            )}
            <DeleteConfirmationModal
                open={openDeleteModal}
                title="Delete Foreign Item Code"
                content="Are you sure you want to delete this foreign item code? This action cannot be undone."
                handleClose={() => setOpenDeleteModal(false)}
                handleReject={() => setOpenDeleteModal(false)}
                deleteFunc={handleDeleteConfirm}
                onSuccess={() => {}}
            />
            <ErrorModal
                open={errorOpen}
                onClose={() => setErrorOpen(false)}
                message={errorMessage}
            />
        </FormPageLayout>
    );
}

export default ForeignItemCodesTable;
