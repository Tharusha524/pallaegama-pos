import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
    Alert,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";

import { useNavigate, useLocation } from "react-router-dom";
import { getSuppliers } from "../../../../api/Supplier/SupplierApi";
import { getCostCenters } from "../../../../api/CostCenter/CostCenterApi";
import { getTaxGroups } from "../../../../api/Tax/taxServices";
import { getPaymentTerms } from "../../../../api/PaymentTerm/PaymentTermApi";
import { getFiscalYears } from "../../../../api/FiscalYear/FiscalYearApi";
import { getCompanies } from "../../../../api/CompanySetup/CompanySetupApi";
import { postSupplierInvoiceFromGrn, getOpenGrnItems } from "../../../../api/Purchases/PurchasesApi";
import { runTransactionSave } from "../../../../utils/transactionSave";
import { useMessageDialog } from "../../../../context/MessageDialogContext";
import { getChartMasters } from "../../../../api/GLAccounts/ChartMasterApi";
import { getSysPrefs } from "../../../../api/OrganizationSettings/SysPrefsApi";
import { getQuickEntries, QuickEntry } from "../../../../api/QuickEntry/QuickEntryApi";
import auditTrailApi from "../../../../api/AuditTrail/AuditTrailApi";
import useCurrentUser from "../../../../hooks/useCurrentUser";
import { createComment } from "../../../../api/Comments/CommentsApi";
import { prefValue, chartByCodeMap } from "../../../../utils/glJournalLinesCore";
import { extractUserGlLines } from "../../../../utils/purchasesGlLines";
import { useSupplierCredit } from "../../../../hooks/useSupplierCredit";
import SupplierCreditSummaryFields from "../../../../components/SupplierCreditSummaryFields";
import SupplierCurrencyField from "../../../../components/SupplierCurrencyField";
import CurrencyAmountInput from "../../../../components/CurrencyAmountInput";
import { resolveSupplierTransactionCurrencyCode } from "../../../../utils/relationId";
import { resolvePurchaseItemPrice } from "../../../../utils/resolvePurchaseItemPrice";
import { useHomeCurrency } from "../../../../hooks/useHomeCurrency";
import { useTransactionMoney } from "../../../../hooks/useTransactionMoney";
import { getSuppTrans } from "../../../../api/SuppTrans/SuppTransApi";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

export default function SupplierInvoice() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Supplier invoices');
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { state: locationState } = useLocation();
    const grnNav = (locationState ?? {}) as {
        supplierId?: number | string;
        grnBatchId?: number | string;
        trans_no?: number | string;
        suppliersReference?: string;
        deliveryDate?: string;
        date?: string;
        purchaseOrderRef?: number | string;
        orderNo?: number | string;
        reference?: string;
        deliverIntoLocation?: string;
        deliveryAddress?: string;
        returnToAllocation?: { transNo: number; transType: number };
    };
    const focusGrnBatchId = useMemo(() => {
        const id = grnNav.grnBatchId ?? grnNav.trans_no;
        return id != null && id !== "" ? Number(id) : null;
    }, [grnNav.grnBatchId, grnNav.trans_no]);

    const { showError } = useMessageDialog();

    type ItemRow = {
        id: number;
        delivery: string;
        po: string;
        item: string;
        description: string;
        receivedOn: string;
        qtyReceived: number;
        qtyInvoiced: number;
        qtyYet: number;
        price: number;
        total: number;
        included: boolean;
        grn_item_id?: number | null;
        po_detail_item?: number | null;
        po_item_detail?: number | null;
    };

    // ================= Form States =================
    const [supplier, setSupplier] = useState(() => {
        const id = Number(grnNav.supplierId ?? 0);
        return id > 0 ? id : 0;
    });
    const [dueDate, setDueDate] = useState(() => {
        const d = grnNav.deliveryDate ?? grnNav.date;
        return d ? String(d).split("T")[0] : "";
    });
    const [invoiceDate, setInvoiceDate] = useState(() => {
        const d = grnNav.deliveryDate ?? grnNav.date;
        return d
            ? String(d).split("T")[0]
            : new Date().toISOString().split("T")[0];
    });
    const [taxGroup, setTaxGroup] = useState(0);
    const [terms, setTerms] = useState(0);
    const [reference, setReference] = useState("");
    const [costCenter, setCostCenter] = useState(0);
    const [supplierRef, setSupplierRef] = useState(grnNav.suppliersReference ?? "");
    const [memo, setMemo] = useState("");

    const [invoiceDateError, setInvoiceDateError] = useState("");
    const [grnLoading, setGrnLoading] = useState(false);
    const [deliveryFullyInvoiced, setDeliveryFullyInvoiced] = useState(false);

    // API Data
    const [suppliers, setSuppliers] = useState([]);
    const [costCenters, setCostCenters] = useState([]);
    const [taxGroups, setTaxGroups] = useState([]);
    const [termList, setTermList] = useState([]);
    const [chartMasters, setChartMasters] = useState([]);
    const [taxGroupDesc, setTaxGroupDesc] = useState("");
    const [termsDesc, setTermsDesc] = useState("");
    const [quickEntryId, setQuickEntryId] = useState("");
    const [quickEntryAmount, setQuickEntryAmount] = useState("");
    const { user } = useCurrentUser();

    const { summary: supplierCreditSummary, isLoading: supplierCreditLoading } =
        useSupplierCredit(supplier || null, suppliers);

    const selectedSupplier = useMemo(
        () =>
            (suppliers || []).find(
                (s: any) => Number(s.supplier_id ?? s.id) === Number(supplier)
            ),
        [suppliers, supplier]
    );
    const { code: homeCurrencyCode } = useHomeCurrency();
    const currencyCode = resolveSupplierTransactionCurrencyCode(
        selectedSupplier,
        homeCurrencyCode
    );
    const { formatMoney } = useTransactionMoney(currencyCode);

    const { data: sysPrefs = [] } = useQuery({ queryKey: ["sysPrefs"], queryFn: getSysPrefs });
    const { data: inventoryLocations = [] } = useQuery({
        queryKey: ["inventoryLocations"],
        queryFn: getInventoryLocations,
        enabled: focusGrnBatchId != null,
    });
    const { data: quickEntries = [] } = useQuery({
        queryKey: ["quickEntries"],
        queryFn: getQuickEntries,
    });

    const grnDeliverySummary = useMemo(() => {
        if (focusGrnBatchId == null) return null;
        const supplierRow = (suppliers || []).find(
            (s: any) => Number(s.supplier_id ?? s.id) === Number(grnNav.supplierId ?? supplier)
        );
        const locCode = grnNav.deliverIntoLocation ?? "";
        const locRow = (inventoryLocations || []).find(
            (l: any) => String(l.loc_code) === String(locCode)
        );
        return {
            reference: grnNav.reference ?? "",
            deliveryDate: grnNav.deliveryDate ?? grnNav.date ?? "",
            supplierName: supplierRow?.supp_name ?? "",
            locationName: locRow?.location_name ?? locCode,
            suppliersReference: grnNav.suppliersReference ?? "",
            purchaseOrder: grnNav.purchaseOrderRef ?? grnNav.orderNo ?? "",
            deliveryAddress: grnNav.deliveryAddress ?? grnNav.deliverIntoLocation ?? "",
        };
    }, [focusGrnBatchId, grnNav, suppliers, supplier, inventoryLocations]);

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

    // Fiscal-year aware Reference (scoped to supplier invoices trans_type 20)
    const { data: fiscalYears = [] } = useQuery({ queryKey: ["fiscalYears"], queryFn: getFiscalYears });
    const { data: companyData } = useQuery({ queryKey: ["company"], queryFn: getCompanies });

    // Find selected fiscal year from company setup
    const selectedFiscalYear = useMemo(() => {
        if (!companyData || companyData.length === 0) return null;
        const company = companyData[0];
        return fiscalYears.find((fy: any) => fy.id === company.fiscal_year_id);
    }, [companyData, fiscalYears]);

    // Validate date is within fiscal year
    const validateDate = (selectedDate: string, setError: (error: string) => void) => {
        if (!selectedFiscalYear) {
            setError("No fiscal year selected from company setup");
            return false;
        }

        if (selectedFiscalYear.closed) {
            setError("The fiscal year is closed for further data entry.");
            return false;
        }

        const selected = new Date(selectedDate);
        const from = new Date(selectedFiscalYear.fiscal_year_from);
        const to = new Date(selectedFiscalYear.fiscal_year_to);

        if (selected < from || selected > to) {
            setError("The entered date is out of fiscal year.");
            return false;
        }

        setError("");
        return true;
    };

    // Validate dates when fiscal year is selected
    useEffect(() => {
        if (selectedFiscalYear) {
            validateDate(invoiceDate, setInvoiceDateError);
        }
    }, [selectedFiscalYear]);

    useEffect(() => {
        (async () => {
            try {
                // Determine year: prefer fiscal year start if available, otherwise use current calendar year
                const year = selectedFiscalYear
                    ? new Date(selectedFiscalYear.fiscal_year_from).getFullYear()
                    : new Date().getFullYear();

                // Determine fiscal year label
                let yearLabel = String(year);
                if (selectedFiscalYear) {
                    const fromYear = new Date(selectedFiscalYear.fiscal_year_from).getFullYear();
                    const toYear = new Date(selectedFiscalYear.fiscal_year_to).getFullYear();
                    yearLabel = selectedFiscalYear.fiscal_year || (fromYear === toYear ? String(fromYear) : `${fromYear}-${toYear}`);
                }

                // compute next sequential number for trans_type 20 within this fiscal year
                let nextNum = 1;
                try {
                    const allSupp = await getSuppTrans();
                    if (Array.isArray(allSupp) && allSupp.length > 0) {
                        const yearPattern = `/${yearLabel}`;
                        const matchingRefs = allSupp
                            .filter((t: any) => Number(t.trans_type ?? t.type ?? 0) === 20)
                            .map((s: any) => s.reference ?? s.supp_reference ?? '')
                            .filter((ref: string) => String(ref).endsWith(yearPattern))
                            .map((ref: string) => {
                                const parts = String(ref).split('/');
                                if (parts.length >= 2) {
                                    const numPart = parts[0];
                                    const parsed = parseInt(numPart, 10);
                                    return isNaN(parsed) ? 0 : parsed;
                                }
                                return 0;
                            })
                            .filter((n: number) => n > 0);

                        if (matchingRefs.length > 0) {
                            const maxRef = Math.max(...matchingRefs);
                            nextNum = maxRef + 1;
                        }
                    }
                } catch (e) {
                    console.warn('Failed to fetch supplier transactions for reference generation', e);
                }

                setReference(`${nextNum.toString().padStart(3, '0')}/${yearLabel}`);
            } catch (err) {
                console.warn('Failed to generate supplier invoice reference', err);
            }
        })();
    }, [selectedFiscalYear]);

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
            // default-select first supplier only when not opened from a GRN receipt
            try {
                const fromGrn = Number(grnNav.supplierId ?? 0) > 0;
                if (!fromGrn && (!supplier || supplier === 0) && Array.isArray(s) && s.length > 0) {
                    const first = s[0];
                    const firstId = first?.supplier_id ?? first?.id ?? null;
                    if (firstId != null) setSupplier(Number(firstId));
                }
            } catch (err) {
                console.warn('Failed to default select supplier', err);
            }
        };
        load();
    }, []);

    // Update payment terms and tax group when supplier changes
    useEffect(() => {
            const find = suppliers.find((x) => Number(x.supplier_id ?? x.id ?? x.supplier) === Number(supplier));
            if (find) {
                // supplier.tax_group may be an id or an object with {id, description}
                let supplierTaxGroupId: any = find.tax_group ?? find.taxGroup ?? find.taxgroup ?? find.tax_group_id ?? null;
                const supplierPaymentTerms = find.payment_terms ?? find.paymentTerms ?? find.terms ?? null;

                // If tax_group is an object, extract id and description
                let supplierTaxGroupDesc = "";
                if (supplierTaxGroupId && typeof supplierTaxGroupId === 'object') {
                    supplierTaxGroupDesc = supplierTaxGroupId.description ?? supplierTaxGroupId.desc ?? "";
                    supplierTaxGroupId = supplierTaxGroupId.id ?? null;
                }

                setTaxGroup(Number(supplierTaxGroupId) || 0);
                setTerms(Number(supplierPaymentTerms) || 0);

                // normalize taxGroups which may be an array, an object with `data`, or a single object
                const tgCandidates = Array.isArray(taxGroups)
                    ? taxGroups
                    : (taxGroups && Array.isArray((taxGroups as any).data))
                        ? (taxGroups as any).data
                        : taxGroups
                            ? [taxGroups]
                            : [];

                if (!supplierTaxGroupDesc) {
                    const tg = (tgCandidates || []).find((t: any) => Number(t.id) === Number(supplierTaxGroupId));
                    supplierTaxGroupDesc = tg ? (tg.description ?? tg.desc ?? '') : "";
                }
                setTaxGroupDesc(supplierTaxGroupDesc);

                const ptCandidates = Array.isArray(termList) ? termList : ((termList && Array.isArray((termList as any).data)) ? (termList as any).data : termList ? [termList] : []);
                const pt = (ptCandidates || []).find((t: any) => t.terms_indicator === supplierPaymentTerms || t.id === supplierPaymentTerms);
                setTermsDesc(pt ? pt.description : "");
            } else {
                setTaxGroup(0);
                setTerms(0);
                setTaxGroupDesc("");
                setTermsDesc("");
            }
    }, [supplier, suppliers, taxGroups, termList]);

    // Load GRN batches and items for the selected supplier and populate itemRows
    useEffect(() => {
        const loadGrnData = async () => {
            setGrnLoading(true);
            setDeliveryFullyInvoiced(false);
            try {
                if (!supplier) {
                    setItemRows([{
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
                        included: false,
                    }]);
                    return;
                }

                const openItems = await getOpenGrnItems({
                    supplier_id: Number(supplier),
                    ...(focusGrnBatchId != null ? { grn_batch_id: focusGrnBatchId } : {}),
                });
                const items = Array.isArray(openItems) ? openItems : [];

                if (focusGrnBatchId != null) {
                    setDeliveryFullyInvoiced(items.length === 0);
                }

                const rows: any[] = [];
                for (const it of items) {
                    const grnId = it.grn_batch_id ?? it.batch_id ?? null;
                    if (!grnId) continue;
                    const qtyReceived = Number(it.qty_recd ?? 0) || 0;
                    const qtyInvoiced = Number(it.quantity_inv ?? 0) || 0;
                    const qtyYet = Number(it.qty_open ?? qtyReceived - qtyInvoiced) || 0;
                    if (qtyYet <= 0) continue;

                    let price = Number(it.unit_price ?? 0) || 0;
                    try {
                        const itemCode = String(it.item_code ?? "");
                        if (itemCode && Number(supplier)) {
                            const resolved = await resolvePurchaseItemPrice(
                                Number(supplier),
                                itemCode
                            );
                            price = resolved.price;
                        }
                    } catch {
                        /* keep fallback price */
                    }
                    rows.push({
                        id: `${grnId}-${it.grn_item_id ?? it.id ?? Math.random()}`,
                        delivery: grnId,
                        po: it.purch_order_no ?? it.po_reference ?? "",
                        item: it.item_code ?? "",
                        description: it.description ?? "",
                        receivedOn: it.delivery_date ?? "",
                        qtyReceived: qtyReceived,
                        qtyInvoiced: qtyInvoiced,
                        qtyYet: qtyYet,
                        price: price,
                        total: Number((qtyYet * price) || 0),
                        included: false,
                        grn_item_id: it.grn_item_id ?? it.id ?? null,
                        po_detail_item: it.po_detail_item ?? null,
                    });
                }

                if (rows.length > 0) setItemRows(rows);
                else setItemRows([{
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
                    included: false,
                    grn_item_id: null,
                    po_detail_item: null,
                }]);
            } catch (e) {
                console.error('Failed to load GRN data for supplier invoice:', e);
            } finally {
                setGrnLoading(false);
            }
        };
        loadGrnData();
    }, [supplier, focusGrnBatchId]);

    // ================= Table 1: Items Yet To Invoice =================
    const [itemRows, setItemRows] = useState<ItemRow[]>([
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
            included: false,
            grn_item_id: null,
            po_detail_item: null,
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
                included: true,
                grn_item_id: null,
                po_detail_item: null,
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

    // subtotal includes only rows that have been 'added' (included === true)
    const itemsSubtotal = itemRows.reduce((s, r) => s + ((r.included ? Number(r.total || 0) : 0)), 0);

    const includeRow = (id) => {
        setItemRows((p) => {
            const next = p.map((r) => {
                if (r.id !== id) return r;
                const remaining = Math.max(
                    0,
                    Number(r.qtyReceived) - Number(r.qtyInvoiced)
                );
                const qtyYet = remaining > 0 ? remaining : Number(r.qtyYet || 0);
                return {
                    ...r,
                    included: true,
                    qtyYet,
                    total: qtyYet * Number(r.price || 0),
                };
            });
            if (!glLocked) syncGlFromItems(next);
            return next;
        });
    };

    const cancelInclude = (id) => {
        setItemRows((p) => {
            const next = p.map((r) => (r.id === id ? { ...r, included: false } : r));
            if (!glLocked) syncGlFromItems(next);
            return next;
        });
    };

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
    const [glLocked, setGlLocked] = useState(false);

    const syncGlFromItems = (rows: ItemRow[]) => {
        const included = rows.filter((r) => r.included);
        setGlRows(buildGlRowsFromIncludedItems(included));
    };

    const addGLRow = () => {
        setGlLocked(true);
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
        setGlLocked(true);
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
        setGlLocked(true);
        setGlRows((p) =>
            p.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        );
    };

    const glSubtotal = glRows.reduce((s, r) => s + Number(r.amount), 0);

    const invoiceTotal = itemsSubtotal + glSubtotal;

    const accountLabel = (code: string) => {
        const chart = chartByCodeMap(chartMasters);
        return chart.get(String(code))?.account_name ?? String(code);
    };

    const buildGlRowsFromIncludedItems = (included: ItemRow[]) => {
        const netTotal = included.reduce((s, r) => s + Number(r.total || 0), 0);
        if (netTotal <= 0) {
            return [
                {
                    id: 1,
                    account: "",
                    name: "",
                    costCenter: "",
                    amount: 0,
                    memo: "",
                },
            ];
        }

        const clearingCode = prefValue(sysPrefs as any[], "grnClearingAccount", "2201");
        const payableCode = prefValue(sysPrefs as any[], "payableAccount", "1500");
        const costCenterLabel =
            costCenters.find((d: any) => Number(d.id) === Number(costCenter))?.name ??
            costCenters.find((d: any) => Number(d.id) === Number(costCenter))?.description ??
            String(costCenter || "");

        const rows = [
            {
                id: 1,
                account: clearingCode,
                name: accountLabel(clearingCode),
                costCenter: costCenterLabel,
                amount: netTotal,
                memo: "Clear GRN clearing",
            },
            {
                id: 2,
                account: payableCode,
                name: accountLabel(payableCode),
                costCenter: "",
                amount: -netTotal,
                memo: "Accounts payable",
            },
            {
                id: 3,
                account: "",
                name: "",
                costCenter: "",
                amount: 0,
                memo: "",
            },
        ];
        return rows;
    };

    const handleUpdate = () => {
        setGlLocked(false);
        syncGlFromItems(itemRows);
    };

    const applyQuickEntry = () => {
        const entry = (quickEntries as QuickEntry[]).find(
            (q) => String(q.id) === String(quickEntryId)
        );
        if (!entry?.destination_account) return;

        const amount = Number(quickEntryAmount || entry.default_base_amount || 0);
        if (!amount) return;

        setGlLocked(true);
        setGlRows((prev) => {
            const withoutTrailing = prev.filter((r) => r.account !== "" || r.amount !== 0);
            const nextId = withoutTrailing.length + 1;
            return [
                ...withoutTrailing,
                {
                    id: nextId,
                    account: entry.destination_account,
                    name: accountLabel(entry.destination_account),
                    costCenter: "",
                    amount,
                    memo: entry.description || entry.name || "",
                },
                {
                    id: nextId + 1,
                    account: "",
                    name: "",
                    costCenter: "",
                    amount: 0,
                    memo: "",
                },
            ];
        });
        setQuickEntryAmount("");
    };

    // ================= Submit Handlers =================
    const handleAddAllItems = () => {
        setItemRows((prev) => {
            const next = prev.map((r) => {
                const remaining = Math.max(0, Number(r.qtyReceived) - Number(r.qtyInvoiced));
                return {
                    ...r,
                    included: remaining > 0,
                    qtyYet: remaining,
                    total: remaining * Number(r.price || 0),
                };
            });
            if (!glLocked) syncGlFromItems(next);
            return next;
        });
    };

    const handleEnterInvoice = async () => {
        try {
            if (grnLoading) {
                showError("GRN lines are still loading. Please wait and try again.");
                return;
            }

            const included = itemRows.filter((r: any) => r.included);
            if (!included || included.length === 0) {
                if (deliveryFullyInvoiced) {
                    showError(
                        "This delivery has already been fully invoiced. Open Supplier Transactions to view the existing invoice."
                    );
                } else {
                    showError("No items selected to invoice");
                }
                return;
            }

            const missingGrnRef = included.filter(
                (r: any) => !r.grn_item_id || Number(r.grn_item_id) <= 0
            );
            if (missingGrnRef.length > 0) {
                showError(
                    "One or more lines are missing a GRN item reference. Refresh the page and try again."
                );
                return;
            }

            // compute totals
            const subTotalIncluded = included.reduce((s: number, r: any) => s + Number(r.total || 0), 0);

            // resolve supplier
            const selectedSupplierObj = (suppliers || []).find((s: any) => Number(s.supplier_id ?? s.id ?? s.supplier) === Number(supplier));
            const supplierIdToSend = selectedSupplierObj ? Number(selectedSupplierObj.supplier_id ?? selectedSupplierObj.id ?? selectedSupplierObj.supplier) : null;
            if (!supplierIdToSend) return alert('Supplier not found');
            const taxIncludedForSupplier = Boolean(selectedSupplierObj?.tax_included ?? selectedSupplierObj?.taxIncluded ?? 0);

            const invoiceLines = included
                .map((r: any) => {
                    const remaining = Math.max(
                        0,
                        Number(r.qtyReceived) - Number(r.qtyInvoiced)
                    );
                    const quantity = Math.min(Number(r.qtyYet || 0), remaining);
                    return {
                        grn_item_id: Number(r.grn_item_id),
                        quantity,
                    };
                })
                .filter((l) => l.grn_item_id > 0 && l.quantity > 0);

            if (invoiceLines.length === 0) {
                showError(
                    "No uninvoiced quantity remains on the selected lines. This delivery may already be invoiced."
                );
                return;
            }

            const glLines = extractUserGlLines(glRows, sysPrefs as any[]);

            const saveResult = await runTransactionSave(() =>
                postSupplierInvoiceFromGrn({
                    supplier_id: supplierIdToSend,
                    reference: reference || undefined,
                    supp_reference: supplierRef || undefined,
                    trans_date: invoiceDate || new Date().toISOString().split("T")[0],
                    due_date: dueDate || invoiceDate || new Date().toISOString().split("T")[0],
                    tax_included: taxIncludedForSupplier,
                    comments: memo || undefined,
                    cost_center_id: Number(costCenter) || undefined,
                    lines: invoiceLines,
                    gl_lines: glLines.length > 0 ? glLines : undefined,
                })
            );

            if (saveResult.ok === false) {
                showError(saveResult.message);
                return;
            }

            const createdTransNo = saveResult.data.trans_no;

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["grnBatches"] }),
                queryClient.invalidateQueries({ queryKey: ["grnItems"] }),
                queryClient.invalidateQueries({ queryKey: ["purchOrderDetails"] }),
            ]);

            try {
                await createComment({ type: 20, id: createdTransNo, date_: invoiceDate, memo_: memo || "" });
            } catch (e) {
                console.warn('Failed to create comment for supp_trans', createdTransNo, e);
            }

            // finished - navigate to success page with created invoice summary
            const successState: any = {
                location: undefined,
                reference: reference,
                date: invoiceDate,
                supplier: supplierIdToSend,
                supplierRef: supplierRef,
                invoiceDate: invoiceDate,
                dueDate: dueDate,
                trans_type: 20,
                trans_no: createdTransNo,
                orderNo: included[0]?.po ?? null,
                items: included.map((r: any) => ({
                    delivery: r.delivery,
                    item: r.item,
                    description: r.description || "",
                    quantity: Number(r.qtyYet || 0),
                    price: Number(r.price || 0),
                    lineValue: Number(r.total || (r.qtyYet * r.price) || 0),
                })),
                subtotal: itemsSubtotal,
                totalInvoice: invoiceTotal,
                returnToAllocation: grnNav.returnToAllocation,
            };

            navigate('/purchase/transactions/supplier-invoice/success', { state: successState });
        } catch (err) {
            console.error('Failed to enter invoice', err);
            alert('Failed to enter invoice. See console for details.');
        }
    };

    const breadcrumbItems = [
        { title: "Purchases", href: "/purchases" },
        { title: "Supplier Invoice" },
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
                    <PageTitle title="Supplier Invoice" />
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
            {grnDeliverySummary ? (
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>
                        Purchase Order Delivery
                    </Typography>
                    <Grid container spacing={1}>
                        <Grid item xs={12} md={6}>
                            <Typography variant="body2">
                                <strong>Reference:</strong> {grnDeliverySummary.reference || "-"}
                            </Typography>
                            <Typography variant="body2">
                                <strong>Delivery Date:</strong>{" "}
                                {grnDeliverySummary.deliveryDate
                                    ? String(grnDeliverySummary.deliveryDate).split("T")[0]
                                    : "-"}
                            </Typography>
                            <Typography variant="body2">
                                <strong>Supplier:</strong> {grnDeliverySummary.supplierName || "-"}
                            </Typography>
                            <Typography variant="body2">
                                <strong>Delivery Into Location:</strong>{" "}
                                {grnDeliverySummary.locationName || "-"}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="body2">
                                <strong>Supplier&apos;s Reference:</strong>{" "}
                                {grnDeliverySummary.suppliersReference || "-"}
                            </Typography>
                            <Typography variant="body2">
                                <strong>For Purchase Order:</strong>{" "}
                                {grnDeliverySummary.purchaseOrder || "-"}
                            </Typography>
                            <Typography variant="body2">
                                <strong>Delivery Address:</strong>{" "}
                                {grnDeliverySummary.deliveryAddress || "-"}
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>
            ) : null}
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
                                        {s.supp_name}
                                    </MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                label="Date"
                                type="date"
                                size="small"
                                value={invoiceDate}
                                onChange={(e) => { setInvoiceDate(e.target.value); validateDate(e.target.value, setInvoiceDateError); }}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ min: selectedFiscalYear ? new Date(selectedFiscalYear.fiscal_year_from).toISOString().split('T')[0] : undefined, max: selectedFiscalYear ? new Date(selectedFiscalYear.fiscal_year_to).toISOString().split('T')[0] : undefined, }}
                                error={!!invoiceDateError}
                                helperText={invoiceDateError}
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
                            <SupplierCurrencyField supplier={selectedSupplier} />
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

                            <SupplierCreditSummaryFields
                                summary={supplierCreditSummary}
                                documentTotal={invoiceTotal}
                                isLoading={supplierCreditLoading}
                                currencyCode={currencyCode}
                            />

                        </Stack>
                    </Grid>
                </Grid>
            </Paper>
            {focusGrnBatchId != null ? (
                <Alert severity="info">
                    Showing uninvoiced lines for delivery #{focusGrnBatchId}
                    {grnNav.reference ? ` (reference ${grnNav.reference})` : ""}.
                </Alert>
            ) : null}
            {deliveryFullyInvoiced ? (
                <Alert severity="warning">
                    This delivery has already been fully invoiced. Check Purchases → Supplier
                    Transactions to view the invoice, or receive new goods before invoicing again.
                </Alert>
            ) : null}
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
                                <TableCell>{row.delivery}</TableCell>

                                <TableCell>{row.po}</TableCell>

                                <TableCell>{row.item}</TableCell>

                                <TableCell>{row.description}</TableCell>

                                <TableCell>{row.receivedOn}</TableCell>

                                <TableCell>{row.qtyReceived}</TableCell>

                                <TableCell>{row.qtyInvoiced}</TableCell>

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
                                    <CurrencyAmountInput
                                        size="small"
                                        value={row.price}
                                        currencyCode={currencyCode}
                                        onChange={(v) =>
                                            updateItemRow(row.id, "price", v)
                                        }
                                    />
                                </TableCell>

                                <TableCell>{formatMoney(Number(row.total || 0))}</TableCell>

                                <TableCell align="center">
                                    <Stack direction="row" spacing={1}>
                                        {!row.included ? (
                                            <>
                                                <Button startIcon={<AddIcon />} onClick={() => includeRow(row.id)}>
                                                    Add
                                                </Button>
                                                <Button
                                                    color="error"
                                                    startIcon={<DeleteIcon />}
                                                    disabled
                                                >
                                                    Remove
                                                </Button>
                                            </>
                                        ) : (
                                            <Button variant="outlined" onClick={() => cancelInclude(row.id)}>
                                                Cancel
                                            </Button>
                                        )}
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
                                {formatMoney(itemsSubtotal)}
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
                    <TextField
                        select
                        label="Quick entry"
                        size="small"
                        sx={{ width: 180 }}
                        value={quickEntryId}
                        onChange={(e) => setQuickEntryId(e.target.value)}
                    >
                        <MenuItem value="">Select</MenuItem>
                        {(quickEntries as QuickEntry[]).map((entry) => (
                            <MenuItem key={entry.id} value={String(entry.id)}>
                                {entry.name}
                            </MenuItem>
                        ))}
                    </TextField>
                    <FormattedNumberField
                        label="Amount"
                        size="small"
                        sx={{ width: 150 }}
                        value={quickEntryAmount}
                        onChange={(e) => setQuickEntryAmount(e.target.value)}
                    />
                    <Button variant="contained" onClick={applyQuickEntry} disabled={!quickEntryId}>
                        GO
                    </Button>
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
                                {formatMoney(glSubtotal)}
                            </TableCell>
                            <TableCell />
                        </TableRow>
                        <TableRow>
                            <TableCell colSpan={4} sx={{ fontWeight: 600 }}>
                                Invoice Total
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                {formatMoney(invoiceTotal)}
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
                    <Button
                        variant="contained"
                        onClick={handleEnterInvoice}
                        disabled={!!invoiceDateError || grnLoading || deliveryFullyInvoiced || !canEdit}
                    >
                        Enter Invoice
                    </Button>
                </Stack>
            </Paper>
        </FormPageLayout>
    );
}
