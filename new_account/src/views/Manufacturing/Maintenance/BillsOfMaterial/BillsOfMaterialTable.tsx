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
import { useNavigate, useLocation } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getItems } from "../../../../api/Item/ItemApi";
import { getItemCodes, deleteItemCode } from "../../../../api/ItemCodes/ItemCodesApi";
import { getItemCategories } from "../../../../api/ItemCategories/ItemCategoriesApi";
import { getBoms, deleteBom, normalizeBomList } from "../../../../api/Bom/BomApi";
import { getWorkCentres } from "../../../../api/WorkCentre/WorkCentreApi";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import DeleteConfirmationModal from "../../../../components/DeleteConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

function BillsOfMaterialTable() {
    const [selectedItem, setSelectedItem] = useState("");
    const [itemCode, setItemCode] = useState("");
    const [copyItemCode, setCopyItemCode] = useState("");
    const [selectedCopyItem, setSelectedCopyItem] = useState("");
    const [openDeleteModal, setOpenDeleteModal] = useState(false);
    const [selectedDeleteId, setSelectedDeleteId] = useState<number | null>(null);
    const [errorOpen, setErrorOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
    const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Bill of Materials');
    const location = useLocation();
    const queryClient = useQueryClient();

    const { data: rawForeignItemData } = useQuery({
        queryKey: ["item-codes"],
        queryFn: getItemCodes,
    });

    const { data: rawItems } = useQuery({
        queryKey: ["items"],
        queryFn: getItems,
    });

    // Fetch categories using React Query
    const { data: categories = [] } = useQuery<{ category_id: number; description: string }[]>({
        queryKey: ["itemCategories"],
        queryFn: () => getItemCategories() as Promise<{ category_id: number; description: string }[]>,
    });

    // Mutation to delete item code
    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteItemCode(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["item-codes"] });
        },
        onError: (err: any) => {
            console.error("Failed to delete item code:", err);
            setErrorMessage("Failed to delete item code");
            setErrorOpen(true);
        },
    });

    // Mutation to delete BOM
    const deleteBomMutation = useMutation({
        mutationFn: (id: number) => deleteBom(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["boms"] });
           // alert("BOM deleted successfully!");
        },
        onError: (err: any) => {
            console.error("Failed to delete BOM:", err);
            setErrorMessage("Failed to delete BOM");
            setErrorOpen(true);
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

    // Fetch BOMs
    const { data: rawBoms } = useQuery({
        queryKey: ["boms"],
        queryFn: getBoms,
    });
    const boms = normalizeBomList(rawBoms);

    // Fetch work centres
    const { data: workCentres = [] } = useQuery({
        queryKey: ["workCentres"],
        queryFn: getWorkCentres,
    });

    // Fetch inventory locations to resolve location_name from loc_code
    const { data: inventoryLocations = [] } = useQuery({
        queryKey: ["inventoryLocations"],
        queryFn: getInventoryLocations,
    });

    const locationMap = useMemo(() => {
        const list = (inventoryLocations as any[]) || [];
        const m = new Map<string, string>();
        list.forEach((loc: any) => {
            const code = String(loc.loc_code ?? "");
            const name = String(loc.location_name ?? code);
            if (code) m.set(code, name);
        });
        return m;
    }, [inventoryLocations]);



    // Pre-select based on navigation state or default to first manufacturable
    useEffect(() => {
        const navStock = (location as any)?.state?.stock_id;
        if (navStock) {
            // If a stock_id was passed via navigation state, use it
            const selected = String(navStock);
            setSelectedItem(selected);
            const matched = items.find((it: any) => String(it.stock_id ?? it.id) === selected);
            setItemCode(String(matched?.stock_id ?? matched?.id ?? selected));
            return;
        }

        if ((!selectedItem || String(selectedItem).trim() === "") && items && items.length > 0) {
            const manufacturable = items.find((it: any) => Number(it.mb_flag) === 1);
            if (manufacturable) {
                const firstStockId = manufacturable?.stock_id ?? manufacturable?.id ?? manufacturable?.stock_master_id ?? manufacturable?.item_id ?? 0;
                setSelectedItem(String(firstStockId));
                setItemCode(String(firstStockId));
            }
        }
    }, [items, location]);

    // Update item code when selected item changes
    useEffect(() => {
        if (selectedItem && items && items.length > 0) {
            const selectedItemData = items.find((item: any) => String(item.stock_id ?? item.id) === String(selectedItem));
            if (selectedItemData) {
                setItemCode(String(selectedItemData.stock_id ?? selectedItemData.id ?? selectedItem));
            }
        }
    }, [selectedItem, items]);

    // Update copy item code when selected copy item changes
    useEffect(() => {
        if (selectedCopyItem && items && items.length > 0) {
            const selectedCopyItemData = items.find((item: any) => String(item.stock_id ?? item.id) === String(selectedCopyItem));
            if (selectedCopyItemData) {
                setCopyItemCode(String(selectedCopyItemData.stock_id ?? selectedCopyItemData.id ?? selectedCopyItem));
            }
        } else {
            setCopyItemCode("");
        }
    }, [selectedCopyItem, items]);

    // Filter BOMs based on selected parent item
    const filteredData = useMemo(() => {
        if (!selectedItem) return [];
        return boms.filter((bom: any) => {
            const parentId = bom.parent ?? bom.parent_stock_id ?? bom.parent_stock_master ?? bom.parent_id;
            return String(parentId) === String(selectedItem);
        });
    }, [boms, selectedItem]);

    const handleDelete = (id: number) => {
        setSelectedDeleteId(id);
        setOpenDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (selectedDeleteId) {
            deleteBomMutation.mutate(selectedDeleteId);
            setOpenDeleteModal(false);
            setSelectedDeleteId(null);
        }
    };

    const breadcrumbItems = [
        { title: "Manufacturing Maintenance", href: "/manufacturing/maintenance/" },
        { title: "Bill Of Material" },
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
                    <PageTitle title="Bill Of Material" />
                    <Breadcrumb breadcrumbs={breadcrumbItems} />
                </Box>

                <Box sx={{ px: 2, mb: 2, display: "flex", gap: 2, alignItems: "center" }}>
                    <TextField
                        label="Item Code"
                        value={itemCode}
                        InputProps={{
                            readOnly: true,
                        }}
                        size="medium"
                        sx={{ maxWidth: 90 }}
                    />
                    <FormControl sx={{ minWidth: 180 }} size="medium">
                        <InputLabel>Manufacturable item</InputLabel>
                        <Select
                            value={selectedItem}
                            label="Select Item"
                            onChange={(e) => setSelectedItem(e.target.value)}
                        >
                                {items && items.length > 0 ? (
                                (() => {
                                    // Only include manufacturable items (mb_flag === 1)
                                    const manufacturable = items.filter((it: any) => Number(it.mb_flag) === 1);
                                    return Object.entries(
                                        manufacturable.reduce((groups: Record<string, any[]>, item) => {
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
                                                const stockId = item.stock_id ?? item.id ?? item.stock_master_id ?? item.item_id ?? 0;
                                                const key = stockId;
                                                const label = item.item_name ?? item.name ?? item.description ?? String(stockId);
                                                const value = String(stockId);
                                                return (
                                                    <MenuItem key={String(key)} value={value}>
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
                        onClick={() => navigate("/manufacturing/maintenance/add-bills-of-material", { state: { stock_id: selectedItem } })}
                    >
                        Add New
                    </Button>
                    <Button variant="outlined" startIcon={<ArrowBackIcon />}
                        onClick={() => navigate("/manufacturing/maintenance/")}>
                        Back
                    </Button>
                </Stack>
            </Box>
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
                                    <TableCell>Code</TableCell>
                                    <TableCell>Description</TableCell>
                                    <TableCell>Location</TableCell>
                                    <TableCell>Work Centre</TableCell>
                                    <TableCell>Quantity</TableCell>
                                    <TableCell>Units</TableCell>
                                    <TableCell align="center">Action</TableCell>
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {filteredData.length > 0 ? (
                                    filteredData.map((bom: any, index) => (
                                        <TableRow key={bom.id ?? index} hover>
                                            <TableCell>{bom.component ?? bom.component_stock_id ?? bom.component_id}</TableCell>
                                            <TableCell>
                                                {
                                                    (() => {
                                                        const compStockId = bom.component ?? bom.component_stock_id ?? bom.component_id;
                                                        const correspondingItem = items.find((it: any) => String(it.stock_id ?? it.id) === String(compStockId));
                                                        return correspondingItem ? (correspondingItem.item_name ?? correspondingItem.name ?? correspondingItem.description ?? String(compStockId)) : "";
                                                    })()
                                                }
                                            </TableCell>
                                            <TableCell>
                                                {(() => {
                                                    const code = String(bom.loc_code ?? bom.location ?? "");
                                                    if (!code) return "";
                                                    return locationMap.get(code) ?? code;
                                                })()}
                                            </TableCell>
                                            <TableCell>
                                                {
                                                    (() => {
                                                        const wcId = bom.work_centre ?? bom.work_centre_id;
                                                        const workCentre = workCentres.find((wc: any) => String(wc.id) === String(wcId));
                                                        return workCentre ? workCentre.name : String(wcId ?? "");
                                                    })()
                                                }
                                            </TableCell>
                                            <TableCell>{bom.quantity}</TableCell>
                                            <TableCell>
                                                {
                                                    (() => {
                                                        const compStockId = bom.component ?? bom.component_stock_id ?? bom.component_id;
                                                        const correspondingItem = items.find((it: any) => String(it.stock_id ?? it.id) === String(compStockId));
                                                        if (correspondingItem) {
                                                            const unitId = correspondingItem.units ?? correspondingItem.unit ?? correspondingItem.unit_id;
                                                            if (unitId && itemUnits && itemUnits.length > 0) {
                                                                const u = itemUnits.find((uu: any) => String(uu.id) === String(unitId));
                                                                if (u) return u.abbr ?? String(unitId);
                                                            }
                                                            return correspondingItem.unit_name ?? correspondingItem.unit ?? correspondingItem.units ?? "each";
                                                        }
                                                        return "each";
                                                    })()
                                                }
                                            </TableCell>
                                            <TableCell align="center">
                                                <Stack direction="row" spacing={1} justifyContent="center">
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        startIcon={<EditIcon />}
                                                        onClick={() => navigate(`/manufacturing/maintenance/update-bills-of-material/${bom.id}`)}
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                      disabled={!canEdit}
                                                        variant="outlined"
                                                        size="small"
                                                        color="error"
                                                        startIcon={<DeleteIcon />}
                                                        onClick={() => handleDelete(bom.id)}
                                                    >
                                                        Delete
                                                    </Button>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : null}
                                {/* <TableRow sx={{ backgroundColor: "action.hover" }}>
                                    <TableCell colSpan={4} sx={{ fontWeight: "bold", borderRight: "1px solid #ddd" }}>
                                        Copy BOM to another manufacturable item
                                    </TableCell>
                                    <TableCell sx={{ borderRight: "1px solid #ddd" }}>
                                        <TextField
                                            size="small"
                                            value={copyItemCode}
                                            placeholder="Item Code"
                                            InputProps={{
                                                readOnly: true,
                                            }}
                                            sx={{ maxWidth: 110 }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ borderRight: "1px solid #ddd" }}>
                                        <FormControl size="small" sx={{ minWidth: 150 }}>
                                            <InputLabel>Select Item</InputLabel>
                                            <Select
                                                value={selectedCopyItem}
                                                label="Select Item"
                                                onChange={(e) => setSelectedCopyItem(e.target.value)}
                                            >
                                                <MenuItem value="">
                                                    <em>None</em>
                                                </MenuItem>
                                                {items && items.length > 0 ? (
                                                    (() => {
                                                        // Only include manufacturable items (mb_flag === 1)
                                                        const manufacturable = items.filter((it: any) => Number(it.mb_flag) === 1);
                                                        return Object.entries(
                                                            manufacturable.reduce((groups: Record<string, any[]>, item) => {
                                                                const catId = item.category_id || "Uncategorized";
                                                                if (!groups[catId]) groups[catId] = [];
                                                                groups[catId].push(item);
                                                                return groups;
                                                            }, {} as Record<string, any[]>)
                                                        ).map(([categoryId, groupedItems]: [string, any[]]) => {
                                                            const category = categories.find(cat => cat.category_id === Number(categoryId));
                                                            const categoryLabel = category ? category.description : `Category ${categoryId}`;
                                                            return [
                                                                <ListSubheader key={`copy-cat-${categoryId}`}>
                                                                    {categoryLabel}
                                                                </ListSubheader>,
                                                                groupedItems.map((item) => {
                                                                    const stockId = item.stock_id ?? item.id ?? item.stock_master_id ?? item.item_id ?? 0;
                                                                    const key = stockId;
                                                                    const label = item.item_name ?? item.name ?? item.description ?? String(stockId);
                                                                    const value = String(stockId);
                                                                    return (
                                                                        <MenuItem key={`copy-${String(key)}`} value={value}>
                                                                            {label}
                                                                        </MenuItem>
                                                                    );
                                                                })
                                                            ];
                                                        });
                                                    })()
                                                ) : null}
                                            </Select>
                                        </FormControl>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Button
                                            variant="contained"
                                            size="small"
                                            color="primary"
                                        >
                                            Copy
                                        </Button>
                                    </TableCell>
                                </TableRow> */}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Stack>
            )}
            <DeleteConfirmationModal
                open={openDeleteModal}
                handleClose={() => setOpenDeleteModal(false)}
                handleReject={() => setOpenDeleteModal(false)}
                deleteFunc={confirmDelete}
                title="Delete BOM"
                content="Are you sure you want to delete this BOM? This action cannot be undone."
            />
            <ErrorModal
                open={errorOpen}
                onClose={() => setErrorOpen(false)}
                message={errorMessage}
            />
        </FormPageLayout>
    );
}

export default BillsOfMaterialTable;
