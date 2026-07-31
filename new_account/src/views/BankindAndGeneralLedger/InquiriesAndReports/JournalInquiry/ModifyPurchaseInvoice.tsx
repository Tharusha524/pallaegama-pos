import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
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
    Paper,
    TextField,
    Typography,
    MenuItem,
    Grid,
    ListSubheader,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";

import { useNavigate } from "react-router-dom";
import { getSuppliers } from "../../../../api/Supplier/SupplierApi";
import { getCostCenters } from "../../../../api/CostCenter/CostCenterApi";
import { getTaxGroups } from "../../../../api/Tax/taxServices";
import { getPaymentTerms } from "../../../../api/PaymentTerm/PaymentTermApi";
import { getChartMasters } from "../../../../api/GLAccounts/ChartMasterApi";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

export default function ModifyPurchaseInvoice() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('GL analytical reports and inquiries');
    const navigate = useNavigate();

    // ================= Form States =================
    const [supplier, setSupplier] = useState(0);
    const [dueDate, setDueDate] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [taxGroup, setTaxGroup] = useState(0);
    const [terms, setTerms] = useState(0);
    const [credit, setCredit] = useState(0);
    const [reference, setReference] = useState("");
    const [costCenter, setCostCenter] = useState(0);
    const [supplierRef, setSupplierRef] = useState("");
    const [memo, setMemo] = useState("");

    // API Data
    const [suppliers, setSuppliers] = useState([]);
    const [costCenters, setCostCenters] = useState([]);
    const [taxGroups, setTaxGroups] = useState([]);
    const [termList, setTermList] = useState([]);
    const [chartMasters, setChartMasters] = useState([]);
    const [taxGroupDesc, setTaxGroupDesc] = useState("");
    const [termsDesc, setTermsDesc] = useState("");

    const accountTypeMap: { [key: number]: string } = {
        "1": "Current Assets",
        "2": "Inventory Assets",
        "3": "Capital Assets",
        "4": "Current Liabilities",
        "5": "Long Term Liabilities",
        "6": "Share Capital",
        "7": "Retained Earnings",
        "8": "Sales Revenue",
        "9": "Other Revenue",
        "10": "Cost of Good Sold",
        "11": "Payroll Expenses",
        "12": "General and Adminitrative Expenses",
    };

    // Generate Reference
    useEffect(() => {
        const year = new Date().getFullYear();
        const r = Math.floor(Math.random() * 9000 + 1000);
        setReference(`SIN-${r}/${year}`);
    }, []);

    // Fetch API
    useEffect(() => {
        const load = async () => {
            const [s, d, t, p, c] = await Promise.all([
                getSuppliers(),
                getCostCenters(),
                getTaxGroups(),
                getPaymentTerms(),
                getChartMasters(),
            ]);
            setSuppliers(s);
            setCostCenters(d);
            setTaxGroups(t);
            setTermList(p);
            setChartMasters(c);
        };
        load();
    }, []);

    // Update payment terms and tax group when supplier changes
    useEffect(() => {
        const find = suppliers.find((x) => x.supplier_id === supplier);
        if (find) {
            setTaxGroup(find.tax_group || 0);
            setTerms(find.payment_terms || 0);
            const tg = taxGroups.find(t => t.id === find.tax_group);
            setTaxGroupDesc(tg ? tg.description : "");
            const pt = termList.find(t => t.terms_indicator === find.payment_terms);
            setTermsDesc(pt ? pt.description : "");
        } else {
            setTaxGroupDesc("");
            setTermsDesc("");
        }
    }, [supplier, suppliers, taxGroups, termList]);

    // ================= Table 1: Items Yet To Invoice =================
    const [itemRows, setItemRows] = useState([
        {
            id: 1,
            delivery: "",
            po: "",
            item: "",
            description: "",
            receivedOn: "",
            qtyReceived: 0,
            qtyInvoiced: 0,
            qtyYet: 0,
            price: 0,
            total: 0,
        },
    ]);

    const addItemRow = () => {
        setItemRows((p) => [
            ...p,
            {
                id: p.length + 1,
                delivery: "",
                po: "",
                item: "",
                description: "",
                receivedOn: "",
                qtyReceived: 0,
                qtyInvoiced: 0,
                qtyYet: 0,
                price: 0,
                total: 0,
            },
        ]);
    };

    const removeItemRow = (id) => {
        setItemRows((p) => p.filter((x) => x.id !== id));
    };

    const updateItemRow = (id, field, value) => {
        setItemRows((p) =>
            p.map((r) =>
                r.id === id
                    ? {
                        ...r,
                        [field]: value,
                        total:
                            field === "qtyYet" || field === "price"
                                ? (field === "qtyYet" ? value : r.qtyYet) *
                                (field === "price" ? value : r.price)
                                : r.total,
                    }
                    : r
            )
        );
    };

    const itemsSubtotal = itemRows.reduce((s, r) => s + r.total, 0);

    // ================= Table 2: GL Items =================
    const [glRows, setGlRows] = useState([
        {
            id: 1,
            account: "",
            name: "",
            costCenter: "",
            amount: 0,
            memo: "",
        },
    ]);

    const addGLRow = () => {
        setGlRows((p) => [
            ...p,
            {
                id: p.length + 1,
                account: "",
                name: "",
                costCenter: "",
                amount: 0,
                memo: "",
            },
        ]);
    };

    const resetGLRows = () => {
        setGlRows([
            {
                id: 1,
                account: "",
                name: "",
                costCenter: "",
                amount: 0,
                memo: "",
            },
        ]);
    };

    const updateGLRow = (id, field, value) => {
        setGlRows((p) =>
            p.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        );
    };

    const glSubtotal = glRows.reduce((s, r) => s + Number(r.amount), 0);

    const invoiceTotal = itemsSubtotal + glSubtotal;

    // ================= Submit Handlers =================
    const handleAddAllItems = () => {
        setItemRows((prev) =>
            prev.map((r) => {
                const remaining = Math.max(0, Number(r.qtyReceived) - Number(r.qtyInvoiced));
                return {
                    ...r,
                    included: remaining > 0,
                    qtyYet: remaining,
                    total: remaining * Number(r.price || 0),
                };
            })
        );
    };

    const handleUpdate = () => {
        navigate("/purchase/transactions/supplier-invoice");
    };

    const handleEnterInvoice = () => {
        navigate("/purchase/transactions/supplier-invoice");
    };

    const breadcrumbItems = [
        { title: "Banking & GL", href: "/bankingandgeneralledger/transactions" },
        { title: "Modify Purchase Invoice" },
    ];

    return (
        <FormPageLayout>
            {/* Header */}
            <Box
                sx={{
                    padding: 2,
                    boxShadow: 2,
                    borderRadius: 1,
                    display: "flex",
                    justifyContent: "space-between",
                }}
            >
                <Box>
                    <PageTitle title="Modify Purchase Invoice" />
                    <Breadcrumb breadcrumbs={breadcrumbItems} />
                </Box>

                <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate(-1)}
                >
                    Back
                </Button>
            </Box>
            {/* Form */}
            <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Grid container spacing={2}>
                    {/* Column 1 */}
                    <Grid item xs={12} md={4}>
                        <Stack spacing={2}>
                            <TextField
                                select
                                label="Supplier"
                                size="small"
                                value={supplier}
                                onChange={(e) => setSupplier(Number(e.target.value))}
                            >
                                {suppliers.map((s) => (
                                    <MenuItem key={s.supplier_id} value={s.supplier_id}>
                                        {s.supp_short_name}
                                    </MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                label="Date"
                                type="date"
                                size="small"
                                value={invoiceDate}
                                onChange={(e) => setInvoiceDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />

                            <TextField
                                label="Reference"
                                size="small"
                                value={reference}
                                InputProps={{ readOnly: true }}
                            />

                            <TextField
                                label="Supplier's Reference"
                                size="small"
                                value={supplierRef}
                                onChange={(e) => setSupplierRef(e.target.value)}
                            />
                        </Stack>
                    </Grid>

                    {/* Column 2 */}
                    <Grid item xs={12} md={4}>
                        <Stack spacing={2}>
                            <TextField
                                label="Due Date"
                                type="date"
                                size="small"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />

                            <TextField
                                label="Payment Terms"
                                size="small"
                                value={termsDesc}
                                InputProps={{ readOnly: true }}
                            />

                            <TextField
                                select
                                label="Cost Center"
                                size="small"
                                value={costCenter}
                                onChange={(e) => setCostCenter(Number(e.target.value))}
                            >
                                {costCenters.map((d) => (
                                    <MenuItem key={d.id} value={d.id}>
                                        {d.name}
                                    </MenuItem>
                                ))}
                            </TextField>

                        </Stack>
                    </Grid>

                    {/* Column 3 */}
                    <Grid item xs={12} md={4}>
                        <Stack spacing={2}>
                            <TextField
                                label="Tax Group"
                                size="small"
                                value={taxGroupDesc}
                                InputProps={{ readOnly: true }}
                            />

                            <FormattedNumberField
                                label="Current Credit"
                                size="small"
                                value={credit}
                                onChange={(e) => setCredit(Number(e.target.value))}
                            />

                        </Stack>
                    </Grid>
                </Grid>
            </Paper>
            {/* ======================== TABLE 1 ======================== */}
            <Box display="flex" justifyContent="center" position="relative" mb={2}>
                <Typography variant="h6">Items Received Yet to be Invoiced</Typography>
                <Button variant="contained" style={{ position: 'absolute', right: 0 }} onClick={handleAddAllItems}>
                    Add All Item
                </Button>
            </Box>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                        <TableRow>
                            <TableCell>Delivery</TableCell>
                            <TableCell>P.O.</TableCell>
                            <TableCell>Item</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Received On</TableCell>
                            <TableCell>Qty Received</TableCell>
                            <TableCell>Qty Invoiced</TableCell>
                            <TableCell>Qty Yet</TableCell>
                            <TableCell>Price Before Tax</TableCell>
                            <TableCell>Total</TableCell>
                            <TableCell align="center">Action</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {itemRows.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell>
                                    <TextField
                                        size="small"
                                        value={row.delivery}
                                        onChange={(e) =>
                                            updateItemRow(row.id, "delivery", e.target.value)
                                        }
                                    />
                                </TableCell>

                                <TableCell>
                                    <TextField
                                        size="small"
                                        value={row.po}
                                        onChange={(e) =>
                                            updateItemRow(row.id, "po", e.target.value)
                                        }
                                    />
                                </TableCell>

                                <TableCell>
                                    <TextField
                                        size="small"
                                        value={row.item}
                                        onChange={(e) =>
                                            updateItemRow(row.id, "item", e.target.value)
                                        }
                                    />
                                </TableCell>

                                <TableCell>
                                    <TextField
                                        size="small"
                                        value={row.description}
                                        onChange={(e) =>
                                            updateItemRow(row.id, "description", e.target.value)
                                        }
                                    />
                                </TableCell>

                                <TableCell>
                                    <TextField
                                        type="date"
                                        size="small"
                                        value={row.receivedOn}
                                        onChange={(e) =>
                                            updateItemRow(row.id, "receivedOn", e.target.value)
                                        }
                                    />
                                </TableCell>

                                <TableCell>
                                    <FormattedNumberField
                                        size="small"
                                        value={row.qtyReceived}
                                        onChange={(e) =>
                                            updateItemRow(row.id, "qtyReceived", Number(e.target.value))
                                        }
                                    />
                                </TableCell>

                                <TableCell>
                                    <FormattedNumberField
                                        size="small"
                                        value={row.qtyInvoiced}
                                        onChange={(e) =>
                                            updateItemRow(row.id, "qtyInvoiced", Number(e.target.value))
                                        }
                                    />
                                </TableCell>

                                <TableCell>
                                    <FormattedNumberField
                                        size="small"
                                        value={row.qtyYet}
                                        onChange={(e) =>
                                            updateItemRow(row.id, "qtyYet", Number(e.target.value))
                                        }
                                    />
                                </TableCell>

                                <TableCell>
                                    <FormattedNumberField
                                        size="small"
                                        value={row.price}
                                        onChange={(e) =>
                                            updateItemRow(row.id, "price", Number(e.target.value))
                                        }
                                    />
                                </TableCell>

                                <TableCell>{row.total.toFixed(2)}</TableCell>

                                <TableCell align="center">
                                    <Stack direction="row" spacing={1}>
                                        {row.id === itemRows.length && (
                                            <Button startIcon={<AddIcon />} onClick={addItemRow}>
                                                Add
                                            </Button>
                                        )}
                                        <Button
                                            color="error"
                                            startIcon={<DeleteIcon />}
                                            onClick={() => removeItemRow(row.id)}
                                        >
                                            Remove
                                        </Button>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>

                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={9} sx={{ fontWeight: 600 }}>
                                Total
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                {itemsSubtotal.toFixed(2)}
                            </TableCell>
                            <TableCell />
                        </TableRow>
                    </TableFooter>
                </Table>
            </TableContainer>
            {/* ======================== TABLE 2: GL ITEMS ======================== */}
            <Box display="flex" justifyContent="center" position="relative" mb={2}>
                <Typography variant="h6">GL Items for this Invoice</Typography>
                <Stack direction="row" spacing={1} style={{ position: 'absolute', right: 0 }}>
                    <TextField select label="Quick entry" size="small" sx={{ width: "150px" }}>
                        <MenuItem value="">Select</MenuItem>
                    </TextField>
                    <FormattedNumberField label="Amount" size="small" sx={{ width: "150px" }} />
                    <Button variant="contained">GO</Button>
                </Stack>
            </Box>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                        <TableRow>
                            <TableCell>Account</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Cost Center</TableCell>
                            <TableCell>Amount</TableCell>
                            <TableCell>Memo</TableCell>
                            <TableCell align="center">Action</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {glRows.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell>
                                    <TextField
                                        size="small"
                                        value={row.account}
                                        InputProps={{ readOnly: true }}
                                    />
                                </TableCell>

                                <TableCell>
                                    <TextField
                                        select
                                        size="small"
                                        value={row.account}
                                        onChange={(e) => {
                                            const selected = chartMasters.find(c => c.account_code === e.target.value);
                                            updateGLRow(row.id, "name", selected ? selected.account_name : "");
                                            updateGLRow(row.id, "account", e.target.value);
                                        }}
                                    >
                                        {(() => {
                                            // Group chart masters by account_type
                                            const groupedAccounts: { [key: string]: any[] } = {};
                                            chartMasters.forEach((acc) => {
                                                const type = acc.account_type || "Unknown";
                                                if (!groupedAccounts[type]) groupedAccounts[type] = [];
                                                groupedAccounts[type].push(acc);
                                            });

                                            // Create grouped menu items with headers
                                            return Object.entries(groupedAccounts).flatMap(([typeKey, accounts]) => {
                                                const typeText = accountTypeMap[Number(typeKey)] || "Unknown";
                                                return [
                                                    <ListSubheader key={`header-${typeKey}`}>{typeText}</ListSubheader>,
                                                    ...accounts.map((acc) => (
                                                        <MenuItem key={acc.account_code} value={acc.account_code}>
                                                            <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}>
                                                                {acc.account_code} - {acc.account_name}
                                                            </Stack>
                                                        </MenuItem>
                                                    )),
                                                ];
                                            });
                                        })()}
                                    </TextField>
                                </TableCell>

                                <TableCell>
                                    <TextField
                                        size="small"
                                        value={row.costCenter}
                                        onChange={(e) =>
                                            updateGLRow(row.id, "costCenter", e.target.value)
                                        }
                                    />
                                </TableCell>

                                <TableCell>
                                    <FormattedNumberField
                                        size="small"
                                        value={row.amount}
                                        onChange={(e) =>
                                            updateGLRow(row.id, "amount", Number(e.target.value))
                                        }
                                    />
                                </TableCell>

                                <TableCell>
                                    <TextField
                                        size="small"
                                        value={row.memo}
                                        onChange={(e) =>
                                            updateGLRow(row.id, "memo", e.target.value)
                                        }
                                    />
                                </TableCell>

                                <TableCell align="center">
                                    {row.id === glRows.length ? (
                                        <Stack direction="row" spacing={1}>
                                            <Button startIcon={<AddIcon />} onClick={addGLRow}>
                                                Add
                                            </Button>
                                            <Button variant="outlined" onClick={resetGLRows}>
                                                Reset
                                            </Button>
                                        </Stack>
                                    ) : (
                                        <Stack direction="row" spacing={1}>
                                            <Button variant="outlined">
                                                Edit
                                            </Button>
                                            <Button
                                                color="error"
                                                startIcon={<DeleteIcon />}
                                                onClick={() =>
                                                    setGlRows((p) => p.filter((x) => x.id !== row.id))
                                                }
                                            >
                                                Remove
                                            </Button>
                                        </Stack>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>

                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={4} sx={{ fontWeight: 600 }}>
                                Sub Total
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                {glSubtotal.toFixed(2)}
                            </TableCell>
                            <TableCell />
                        </TableRow>
                        <TableRow>
                            <TableCell colSpan={4} sx={{ fontWeight: 600 }}>
                                Tax
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                0.00
                            </TableCell>
                            <TableCell />
                        </TableRow>
                        <TableRow>
                            <TableCell colSpan={4} sx={{ fontWeight: 600 }}>
                                Invoice Total
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                {invoiceTotal.toFixed(2)}
                            </TableCell>
                            <TableCell>
                                <Button variant="outlined" size="small" onClick={handleUpdate}>
                                    Update
                                </Button>
                            </TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </TableContainer>
            {/* ================= Memo + Buttons ================= */}
            <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle1">Memo</Typography>
                <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                />

                <Stack direction="row" justifyContent="flex-end" spacing={2} mt={2}>
                    <Button disabled={!canEdit} variant="contained" onClick={handleEnterInvoice}>
                        Enter Invoice
                    </Button>
                </Stack>
            </Paper>
        </FormPageLayout>
    );
}