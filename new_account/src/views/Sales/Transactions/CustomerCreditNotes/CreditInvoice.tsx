import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect, useMemo } from "react";
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
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// ===== API Imports =====
import { getCustomers } from "../../../../api/Customer/AddCustomerApi";
import { getBranches } from "../../../../api/CustomerBranch/CustomerBranchApi";
import { getSalesTypes } from "../../../../api/SalesMaintenance/salesService";
import { getShippingCompanies } from "../../../../api/ShippingCompany/ShippingCompanyApi";
// import { getCostCenters } from "../../../../api/CostCenter/CostCenterApi";
import { getItems, getItemById } from "../../../../api/Item/ItemApi";
import { getItemUnits } from "../../../../api/ItemUnit/ItemUnitApi";
import { getItemCategories } from "../../../../api/ItemCategories/ItemCategoriesApi";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import { getSalesPricing } from "../../../../api/SalesPricing/SalesPricingApi";
import { getTaxTypes } from "../../../../api/Tax/taxServices";
import { getTaxGroupItemsByGroupId } from "../../../../api/Tax/TaxGroupItemApi";
import { createSalesCreditNote } from "../../../../api/SalesCreditNote/SalesCreditNoteApi";
import { getDebtorTrans } from "../../../../api/DebtorTrans/DebtorTransApi";
import { getDebtorTransDetails } from "../../../../api/DebtorTrans/DebtorTransDetailsApi";
import { runTransactionSave } from "../../../../utils/transactionSave";
import auditTrailApi from "../../../../api/AuditTrail/AuditTrailApi";
import { getFiscalYears } from "../../../../api/FiscalYear/FiscalYearApi";
import { getCompanies } from "../../../../api/CompanySetup/CompanySetupApi";
import useCurrentUser from "../../../../hooks/useCurrentUser";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

export default function CreditInvoice() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Direct sales invoice entry');
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();

   // console.log('CreditInvoice component mounted or updated', { state: location.state });

    // ===== Form fields =====
    const [customer, setCustomer] = useState("");
    const [branch, setBranch] = useState("");
    const [reference, setReference] = useState("");
    const [salesType, setSalesType] = useState("");
    const [shippingCompany, setShippingCompany] = useState("");
    const [discount, setDiscount] = useState(0);
    const [creditNoteDate, setCreditNoteDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [creditingInvoice, setCreditingInvoice] = useState("");
    const [invoiceDate, setInvoiceDate] = useState("");
    const [costCenter, setCostCenter] = useState("");
    const [creditNoteType, setCreditNoteType] = useState("");
    const [returnLocation, setReturnLocation] = useState("");
    const [memo, setMemo] = useState("");

    const [originalTransNo, setOriginalTransNo] = useState<string | null>(null);
    const [dateError, setDateError] = useState("");

    // ===== Fetch master data =====
    const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: getCustomers });
    const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => getBranches() });
    const { data: salesTypes = [] } = useQuery({ queryKey: ["salesTypes"], queryFn: getSalesTypes });
    const { data: shippingCompanies = [] } = useQuery({ queryKey: ["shippingCompanies"], queryFn: getShippingCompanies });
    //   const { data: costCenters = [] } = useQuery({ queryKey: ["costCenters"], queryFn: getCostCenters });
    const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: getItems });
    const { data: itemUnits = [] } = useQuery({ queryKey: ["itemUnits"], queryFn: getItemUnits });
    const { data: categories = [] } = useQuery({ queryKey: ["itemCategories"], queryFn: () => getItemCategories() });
    const { data: locations = [] } = useQuery({ queryKey: ["locations"], queryFn: getInventoryLocations });
    const { data: salesPricing = [] } = useQuery({ queryKey: ["salesPricing"], queryFn: getSalesPricing });
    const { data: taxTypes = [] } = useQuery({ queryKey: ["taxTypes"], queryFn: getTaxTypes });
    const { data: debtorTrans = [] } = useQuery({ queryKey: ["debtorTrans"], queryFn: getDebtorTrans });
    const { data: debtorTransDetails = [] } = useQuery({ queryKey: ["debtorTransDetails"], queryFn: getDebtorTransDetails });
    const { data: fiscalYears = [] } = useQuery({ queryKey: ["fiscalYears"], queryFn: getFiscalYears });
    const { data: companyData } = useQuery({ queryKey: ["company"], queryFn: getCompanies });
    const { user } = useCurrentUser();

    // Find selected fiscal year from company setup
    const selectedFiscalYear = useMemo(() => {
        if (!companyData || companyData.length === 0) return null;
        const company = companyData[0];
        return fiscalYears.find((fy: any) => fy.id === company.fiscal_year_id);
    }, [companyData, fiscalYears]);

    // Validate date is within fiscal year
    const validateDate = (selectedDate: string) => {
        if (!selectedFiscalYear) {
            setDateError("No fiscal year selected from company setup");
            return false;
        }

        if (selectedFiscalYear.closed) {
            setDateError("The fiscal year is closed for further data entry.");
            return false;
        }

        const selected = new Date(selectedDate);
        const from = new Date(selectedFiscalYear.fiscal_year_from);
        const to = new Date(selectedFiscalYear.fiscal_year_to);

        if (selected < from || selected > to) {
            setDateError("The entered date is out of fiscal year.");
            return false;
        }

        setDateError("");
        return true;
    };

    // Validate date when fiscal year changes
    useEffect(() => {
        if (selectedFiscalYear) {
            validateDate(creditNoteDate);
        }
    }, [selectedFiscalYear]);

    // Handle date change with validation
    const handleDateChange = (value: string) => {
        setCreditNoteDate(value);
        validateDate(value);
    };

    // Extract data from navigation state
    useEffect(() => {
     //   console.log('useEffect for location.state running', location.state);
        if (location.state) {
            const state = location.state as any;
            if (state.trans_no) {
                setOriginalTransNo(state.trans_no);
                setCreditingInvoice(state.trans_no);
            }
            if (state.date) setInvoiceDate(state.date);
            if (state.debtor_no) setCustomer(String(state.debtor_no));
            if (state.branch_code) setBranch(String(state.branch_code));
        }
    }, [location.state]);

    // ===== Tax-related state =====
    const [taxGroupItems, setTaxGroupItems] = useState<any[]>([]);
    const [rows, setRows] = useState([
        {
            id: 1,
            itemCode: "",
            description: "",
            quantity: 0,
            unit: "",
            price: 0,
            creditQuantity: 0,
            discount: 0,
            total: 0,
            selectedItemId: null as string | number | null,
            material_cost: 0,
            remainingQuantity: 0,
            srcId: null as number | null,
        },
    ]);

    const handleAddRow = () => {
        setRows((prev) => [
            ...prev,
            {
                id: prev.length + 1,
                itemCode: "",
                description: "",
                quantity: 0,
                unit: "",
                price: 0,
                creditQuantity: 0,
                discount: 0,
                total: 0,
                selectedItemId: null,
                material_cost: 0,
                remainingQuantity: 0,
                srcId: null,
            },
        ]);
    };

    const handleRemoveRow = (id: number) => {
        setRows((prev) => prev.filter((r) => r.id !== id));
    };

    const handleChange = (id: number, field: string, value: any) => {
        setRows((prev) =>
            prev.map((r) =>
                r.id === id
                    ? {
                        ...r,
                        [field]: field === "creditQuantity" ? Math.min(Math.max(0, Number(value)), r.remainingQuantity) :
                                field === "price" ? Math.max(0, Number(value)) :
                                field === "discount" ? Math.min(100, Math.max(0, Number(value))) :
                                value,
                        total:
                            field === "creditQuantity" ||
                                field === "price" ||
                                field === "discount"
                                ? (field === "creditQuantity" ? Math.min(Math.max(0, Number(value)), r.remainingQuantity) : r.creditQuantity) *
                                (field === "price" ? Math.max(0, Number(value)) : r.price) *
                                (1 - (field === "discount" ? Math.min(100, Math.max(0, Number(value))) : r.discount) / 100)
                                : r.total,
                    }
                    : r
            )
        );
    };

    // ===== Auto-generate reference =====
    useEffect(() => {
        const fiscalYear = new Date().getFullYear();
        if (debtorTrans.length === 0) {
            setReference(`001/${fiscalYear}`);
            return;
        }
        const refsForType = debtorTrans
            .filter((d: any) => d.trans_type === 11)
            .map((d: any) => d.reference)
            .filter((ref: string) => ref && typeof ref === 'string');
        const numbers = refsForType.map((ref: string) => {
            const parts = ref.split('/');
            if (parts.length === 2 && parts[1] === fiscalYear.toString()) {
                const num = parseInt(parts[0], 10);
                return isNaN(num) ? 0 : num;
            }
            return 0;
        });
        const maxNum = Math.max(...numbers, 0);
        const nextNum = maxNum + 1;
        setReference(`${nextNum.toString().padStart(3, '0')}/${fiscalYear}`);
    }, [debtorTrans]);

    // Set branch from debtorTrans if not set
    useEffect(() => {
     //   console.log('useEffect for branch from debtorTrans', { branch, originalTransNo, debtorTransLength: debtorTrans.length });
        if (!branch && originalTransNo && debtorTrans.length > 0) {
            const originalTrans = debtorTrans.find((t: any) => String(t.trans_no) === String(originalTransNo) && t.trans_type === 10);
        //    console.log('originalTrans', originalTrans);
            if (originalTrans && originalTrans.branch_code) {
         //       console.log('setting branch from debtorTrans:', originalTrans.branch_code);
                setBranch(String(originalTrans.branch_code));
            }
        }
    }, [branch, originalTransNo, debtorTrans]);

    // Set sales type from debtorTrans if not set
    useEffect(() => {
        if (!salesType && originalTransNo && debtorTrans.length > 0) {
            const originalTrans = debtorTrans.find((t: any) => String(t.trans_no) === String(originalTransNo) && t.trans_type === 10);
            if (originalTrans && originalTrans.tpe) {
                setSalesType(String(originalTrans.tpe));
            }
        }
    }, [salesType, originalTransNo, debtorTrans]);

    // Populate rows from original invoice details
    useEffect(() => {
        if (originalTransNo && debtorTransDetails.length > 0) {
            const filteredDetails = debtorTransDetails.filter((d: any) => String(d.debtor_trans_no) === String(originalTransNo) && d.debtor_trans_type === 10);
            if (filteredDetails.length > 0) {
                const newRows = filteredDetails.map((detail: any, index: number) => {
                    const item = items.find((i: any) => i.stock_id === detail.stock_id);
                    const unitData = itemUnits.find((u: any) => u.id === item?.units);
                    // Find all credit notes that reference this original invoice detail
                    const sumCredits = debtorTransDetails
                        .filter((d: any) => d.debtor_trans_type === 11 && d.src_id === detail.id)
                        .reduce((sum, d) => sum + Number(d.quantity || 0), 0);
                    const remainingQuantity = Number(detail.quantity) - sumCredits;
                    return {
                        id: index + 1,
                        itemCode: detail.stock_id,
                        description: detail.description,
                        quantity: detail.quantity, // original invoiced quantity
                        unit: unitData?.abbr || item?.units || "",
                        price: detail.unit_price,
                        creditQuantity: 0,
                        discount: detail.discount_percent || 0,
                        total: 0,
                        selectedItemId: detail.stock_id,
                        material_cost: detail.standard_cost || 0,
                        remainingQuantity,
                        srcId: detail.id ?? null,
                    };
                });
                setRows(newRows);
            }
        }
    }, [originalTransNo, debtorTransDetails, items, itemUnits]);

    // Update discount when customer changes (skip when crediting an existing invoice)
    useEffect(() => {
        if (originalTransNo) return;
        if (customer) {
            const selectedCustomer = customers.find((c: any) => String(c.debtor_no) === String(customer));
            if (selectedCustomer) {
                setDiscount(selectedCustomer.discount || 0);
                setRows((prev) => prev.map((r) => ({ ...r, discount: selectedCustomer.discount || 0 })));
            }
        } else {
            setDiscount(0);
            setRows((prev) => prev.map((r) => ({ ...r, discount: 0 })));
        }
    }, [customer, customers, originalTransNo]);

    // Update prices when sales type changes (skip when crediting an existing invoice)
    useEffect(() => {
        if (originalTransNo) return;
        if (salesType && salesPricing.length > 0) {
            setRows((prev) =>
                prev.map((r) => {
                    if (r.selectedItemId) {
                        const pricing = salesPricing.find(
                            (p: any) => p.stock_id === r.selectedItemId && p.sales_type_id === salesType
                        );
                        const newPrice = pricing ? pricing.price : r.price;
                        return {
                            ...r,
                            price: newPrice,
                            total: r.creditQuantity * newPrice * (1 - r.discount / 100),
                        };
                    }
                    return r;
                })
            );
        }
    }, [salesType, salesPricing, originalTransNo]);

    useEffect(() => {
        if (branch) {
            const selectedBranch = branches.find((b: any) => String(b.branch_code) === String(branch) && String(b.debtor_no) === String(customer));
            if (selectedBranch && selectedBranch.tax_group) {
                getTaxGroupItemsByGroupId(selectedBranch.tax_group)
                    .then((items) => setTaxGroupItems(items))
                    .catch((err) => console.error(err));
            } else {
                setTaxGroupItems([]);
            }
        } else {
            setTaxGroupItems([]);
        }
    }, [branch, branches, customer]);

    const subTotal = rows.reduce((sum, r) => sum + r.total, 0);

    const selectedCustomerObj = useMemo(() => customers.find((c: any) => String(c.debtor_no) === String(customer)), [customers, customer]);
    const customerDisplayName = selectedCustomerObj ? selectedCustomerObj.name : (customer || "");
    const currencyDisplay = selectedCustomerObj?.curr_code ?? "";
    const selectedBranchObj = useMemo(() => {
        const found = branches.find((b: any) => String(b.branch_code) === String(branch) && String(b.debtor_no) === String(customer));
      //  console.log('selectedBranchObj debug:', { branch, customer, branches: branches.length, found });
        return found;
    }, [branches, branch, customer]);
    const branchDisplayName = selectedBranchObj
        ? selectedBranchObj.br_name
        : (branch || "");
  //  console.log('branchDisplayName:', branchDisplayName, 'selectedBranchObj:', selectedBranchObj);

    // Calculate taxes if taxIncl is true
    const selectedPriceList = useMemo(() => {
        return salesTypes.find((st: any) => String(st.id) === String(salesType));
    }, [salesType, salesTypes]);

    // Determine tax inclusion setting - use original invoice's setting if available, otherwise use selected price list
    const effectiveTaxIncluded = useMemo(() => {
        if (originalTransNo && debtorTrans.length > 0) {
            const originalTrans = debtorTrans.find((t: any) => String(t.trans_no) === String(originalTransNo) && t.trans_type === 10);
            if (originalTrans) {
                return originalTrans.tax_included === 1;
            }
        }
        return selectedPriceList?.taxIncl || false;
    }, [originalTransNo, debtorTrans, selectedPriceList]);

    const taxCalculations = useMemo(() => {
        if (taxGroupItems.length === 0) {
            return [];
        }

        // Calculate tax amounts for each tax type
        return taxGroupItems.map((item: any) => {
            const taxTypeData = taxTypes.find((t: any) => t.id === item.tax_type_id);
            const taxRate = taxTypeData?.default_rate || 0;
            const taxName = taxTypeData?.description || "Tax";

            let taxAmount = 0;
            if (effectiveTaxIncluded) {
                // For prices that include tax, we need to extract the tax amount
                // Tax amount = subtotal - (subtotal / (1 + rate/100))
                taxAmount = subTotal - (subTotal / (1 + taxRate / 100));
            } else {
                // For prices that don't include tax, calculate tax on subtotal
                // Tax amount = subtotal * (rate/100)
                taxAmount = subTotal * (taxRate / 100);
            }

            return {
                name: taxName,
                rate: taxRate,
                amount: taxAmount,
            };
        });
    }, [selectedPriceList, taxGroupItems, taxTypes, subTotal]);

    const totalTaxAmount = taxCalculations.reduce((sum, tax) => sum + tax.amount, 0);

    const hasValidRows = rows.some(
        (r) => r.selectedItemId && r.creditQuantity > 0 && r.remainingQuantity > 0
    );

    const handleProcessCreditNote = async () => {
        if (!customer) {
            alert("Please select a customer.");
            return;
        }
        if (!branch) {
            alert("Branch is required. Please navigate from Customer Transaction Inquiry to pre-populate the branch.");
            return;
        }
        if (dateError) {
            alert("Please correct the date error before processing.");
            return;
        }
        if (!originalTransNo) {
            alert("Original invoice not found.");
            return;
        }
        if (!creditNoteType) {
            alert("Please select credit note type.");
            return;
        }
        if (creditNoteType === "Return" && !returnLocation) {
            alert("Please select return location.");
            return;
        }
        if (!hasValidRows) {
            alert("Please enter a credit quantity greater than 0 for at least one item.");
            return;
        }

        const saveResult = await runTransactionSave(async () => {
            const result = await createSalesCreditNote({
                debtor_no: Number(customer),
                branch_code: Number(branch),
                tran_date: creditNoteDate,
                order_type: salesType ? Number(salesType) : 0,
                ship_via: shippingCompany ? Number(shippingCompany) : undefined,
                from_stk_loc: creditNoteType === "Return" ? returnLocation : undefined,
                source_invoice_trans_no: Number(originalTransNo),
                comments: memo || undefined,
                reference: reference || undefined,
                lines: rows
                    .filter((r) => r.selectedItemId && r.creditQuantity > 0)
                    .map((r) => ({
                        stock_id: r.itemCode,
                        quantity: r.creditQuantity,
                        unit_price: r.price,
                        discount_percent: r.discount,
                        description: r.description,
                        src_id: r.srcId ?? undefined,
                    })),
            });

            return {
                trans_no: result.trans_no,
                reference: result.reference ?? reference,
                trans_type: 11,
                date: creditNoteDate,
            };
        });

        if (saveResult.ok === false) {
            alert(saveResult.message || "Failed to process credit note.");
            return;
        }

        queryClient.invalidateQueries({ queryKey: ["debtorTrans"] });
        queryClient.invalidateQueries({ queryKey: ["debtorTransDetails"] });
        queryClient.invalidateQueries({ queryKey: ["custAllocations"] });
        navigate("/sales/transactions/credit-invoice/success", { state: saveResult.data });
    };

    const breadcrumbItems = [
        { title: "Transactions", href: "/sales/transactions/" },
        { title: "Credit all or part of an Invoice" },
    ];

    return (
        <FormPageLayout>
            {/* Header */}
            <Box
                sx={{
                    padding: theme.spacing(2),
                    boxShadow: 2,
                    borderRadius: 1,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <Box>
                    <PageTitle title="Credit all or part of an Invoice" />
                    <Breadcrumb breadcrumbs={breadcrumbItems} />
                </Box>

                <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
                    Back
                </Button>
            </Box>
            {/* Form fields */}
            <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={3}>
                        <Stack spacing={2}>
                            <TextField
                                fullWidth
                                label="Customer"
                                value={customerDisplayName}
                                size="small"
                                InputProps={{ readOnly: true }}
                            />
                            <TextField label="Reference" fullWidth size="small" value={reference} InputProps={{ readOnly: true }} />
                        </Stack>
                    </Grid>

                    <Grid item xs={12} sm={3}>
                        <Stack spacing={2}>
                            <TextField
                                fullWidth
                                label="Branch"
                                value={branchDisplayName}
                                size="small"
                                InputProps={{ readOnly: true }}
                            />
                            <TextField
                                fullWidth
                                label="Crediting Invoice"
                                value={creditingInvoice}
                                size="small"
                                onChange={(e) => setCreditingInvoice(e.target.value)}
                            />
                        </Stack>
                    </Grid>

                    <Grid item xs={12} sm={3}>
                        <Stack spacing={2}>
                            <TextField label="Currency" fullWidth size="small" value={currencyDisplay} InputProps={{ readOnly: true }} />
                            <TextField
                                select
                                fullWidth
                                label="Shipping Company"
                                value={shippingCompany}
                                onChange={(e) => setShippingCompany(e.target.value)}
                                size="small"
                            >
                                {shippingCompanies.map((sc: any) => (
                                    <MenuItem key={sc.shipper_id} value={sc.shipper_id}>
                                        {sc.shipper_name}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                    </Grid>

                    <Grid item xs={12} sm={3}>
                        <Stack spacing={2}>
                            <TextField
                                label="Invoice Date"
                                type="date"
                                fullWidth
                                size="small"
                                value={invoiceDate}
                                disabled
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                label="Credit Note Date"
                                type="date"
                                fullWidth
                                size="small"
                                value={creditNoteDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{
                                    min: selectedFiscalYear ? new Date(selectedFiscalYear.fiscal_year_from).toISOString().split('T')[0] : undefined,
                                    max: selectedFiscalYear ? new Date(selectedFiscalYear.fiscal_year_to).toISOString().split('T')[0] : undefined,
                                }}
                                error={!!dateError}
                                helperText={dateError}
                            />
                        </Stack>
                    </Grid>
                </Grid>
            </Paper>
            {/* Items Table */}
            <Typography variant="subtitle1" sx={{ mb: 2, textAlign: "center" }}>
                Customer Credit Note Items
            </Typography>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
                        <TableRow>
                            <TableCell>No</TableCell>
                            <TableCell>Item Code</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Invoiced Quantity</TableCell>
                            <TableCell>Remaining</TableCell>
                            <TableCell>Unit</TableCell>
                            <TableCell>Price</TableCell>
                            <TableCell>Credit Quantity</TableCell>
                            <TableCell>Discount (%)</TableCell>
                            <TableCell>Total</TableCell>
                            <TableCell>Action</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {rows.map((row, i) => (
                            <TableRow key={row.id}>
                                <TableCell>{i + 1}</TableCell>
                                <TableCell>
                                    <TextField
                                        size="small"
                                        value={row.itemCode}
                                        InputProps={{ readOnly: true }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <TextField
                                        size="small"
                                        value={row.description}
                                        InputProps={{ readOnly: true }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <FormattedNumberField
                                        size="small"
                                        value={row.quantity}
                                        InputProps={{ readOnly: true }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <FormattedNumberField
                                        size="small"
                                        value={row.remainingQuantity}
                                        InputProps={{ readOnly: true }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <TextField size="small" value={row.unit} InputProps={{ readOnly: true }} />
                                </TableCell>
                                <TableCell>
                                    <FormattedNumberField
                                        size="small"
                                        value={row.price}
                                        InputProps={{ readOnly: true }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <FormattedNumberField
                                        size="small"
                                        value={row.creditQuantity ?? 0}
                                        disabled={row.remainingQuantity <= 0}
                                        onChange={(e) => handleChange(row.id, "creditQuantity", Number(e.target.value))}
                                        inputProps={{ min: 0, max: row.remainingQuantity }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <FormattedNumberField size="small" value={row.discount} InputProps={{ readOnly: true }} />
                                </TableCell>
                                <TableCell>{row.total.toFixed(2)}</TableCell>
                                <TableCell />
                            </TableRow>
                        ))}
                    </TableBody>

                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={9} sx={{ fontWeight: 600 }}>
                                Sub-total
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{subTotal.toFixed(2)}</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                        {taxCalculations.map((tax, index) => (
                            <TableRow key={index}>
                                <TableCell colSpan={9} sx={{ fontWeight: 600 }}>
                                    {tax.name} ({tax.rate}%)
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{tax.amount.toFixed(2)}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        ))}
                        <TableRow>
                            <TableCell colSpan={9} sx={{ fontWeight: 600 }}>
                                Total
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{(subTotal + (effectiveTaxIncluded ? 0 : totalTaxAmount)).toFixed(2)}</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </TableContainer>
            {/* Credit Note Type + Memo Section */}
            <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            select
                            fullWidth
                            label="Credit Note Type"
                            value={creditNoteType}
                            onChange={(e) => setCreditNoteType(e.target.value)}
                            size="small"
                        >
                            <MenuItem value="Return">Items Returned to Inventory Location</MenuItem>
                            <MenuItem value="Allowance">Items Written Off</MenuItem>
                        </TextField>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <TextField
                            select
                            fullWidth
                            label="Items Returned To Location"
                            value={returnLocation}
                            onChange={(e) => setReturnLocation(e.target.value)}
                            size="small"
                        >
                            {locations.map((loc: any) => (
                                <MenuItem key={loc.loc_code} value={loc.loc_code}>
                                    {loc.location_name}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>

                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            multiline
                            rows={2}
                            label="Memo"
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                        />
                    </Grid>
                </Grid>

                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2, gap: 2 }}>
                    <Button variant="outlined" onClick={() => navigate(-1)}>
                        Update
                    </Button>
                    <Button variant="contained" color="primary" onClick={handleProcessCreditNote} disabled={!!dateError || !canEdit}>
                        Process Credit Note
                    </Button>
                </Box>
            </Paper>
        </FormPageLayout>
    );
}
