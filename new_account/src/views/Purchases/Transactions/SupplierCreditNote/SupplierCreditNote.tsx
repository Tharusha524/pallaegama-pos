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
    Alert,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";

import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSuppliers } from "../../../../api/Supplier/SupplierApi";
import { getCostCenters } from "../../../../api/CostCenter/CostCenterApi";
import { getTaxGroups } from "../../../../api/Tax/taxServices";
import { getPaymentTerms } from "../../../../api/PaymentTerm/PaymentTermApi";
import { getChartMasters } from "../../../../api/GLAccounts/ChartMasterApi";
import { getSysPrefs } from "../../../../api/OrganizationSettings/SysPrefsApi";
import { getQuickEntries, QuickEntry } from "../../../../api/QuickEntry/QuickEntryApi";
import { postSupplierCreditNote, getOpenGrnItems } from "../../../../api/Purchases/PurchasesApi";
import { getFiscalYears } from "../../../../api/FiscalYear/FiscalYearApi";
import { getCompanies } from "../../../../api/CompanySetup/CompanySetupApi";
import { createComment } from "../../../../api/Comments/CommentsApi";
import useCurrentUser from "../../../../hooks/useCurrentUser";
import { runTransactionSave } from "../../../../utils/transactionSave";
import { useMessageDialog } from "../../../../context/MessageDialogContext";
import { useSupplierCredit } from "../../../../hooks/useSupplierCredit";
import { useNextFiscalYearReference } from "../../../../hooks/useNextFiscalYearReference";
import SupplierCreditSummaryFields from "../../../../components/SupplierCreditSummaryFields";
import SupplierCurrencyField from "../../../../components/SupplierCurrencyField";
import CurrencyAmountInput from "../../../../components/CurrencyAmountInput";
import { resolveSupplierTransactionCurrencyCode } from "../../../../utils/relationId";
import { resolvePurchaseItemPrice } from "../../../../utils/resolvePurchaseItemPrice";
import { useHomeCurrency } from "../../../../hooks/useHomeCurrency";
import { useTransactionMoney } from "../../../../hooks/useTransactionMoney";
import { prefValue, chartByCodeMap } from "../../../../utils/glJournalLinesCore";
import { extractUserGlLines } from "../../../../utils/purchasesGlLines";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

export default function SupplierCreditNote() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Supplier credit notes');
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { state: navState } = useLocation();
    const { showError } = useMessageDialog();

    // ================= Form States =================
    const [supplier, setSupplier] = useState(0);
    const [dueDate, setDueDate] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [taxGroup, setTaxGroup] = useState(0);
    const [terms, setTerms] = useState(0);
    const [reference, setReference] = useState("");
    const [costCenter, setCostCenter] = useState(0);
    const [sourceInvoices, setSourceInvoices] = useState("");
    const [supplierRef, setSupplierRef] = useState("");
    const [memo, setMemo] = useState("");
    const [quickEntryId, setQuickEntryId] = useState("");
    const [quickEntryAmount, setQuickEntryAmount] = useState("");

    const [invoiceDateError, setInvoiceDateError] = useState("");

    // Date range filter for GRN items table
    const [receivedFromDate, setReceivedFromDate] = useState("");
    const [receivedToDate, setReceivedToDate] = useState("");

    // keep due date in sync with invoice date when due date is empty
    useEffect(() => {
        if (!dueDate && invoiceDate) {
            setDueDate(invoiceDate);
        }
    }, [invoiceDate, dueDate]);

    // Pre-fill from Supplier Transaction Inquiry ("Credit this")
    useEffect(() => {
        if (!navState) return;
        const sid = Number(
            navState.supplier ?? navState.supplierId ?? navState.supplier_id ?? 0
        );
        if (sid > 0) setSupplier(sid);
        const invoiceNo = navState.invoiceNo ?? navState.invoice_no;
        if (invoiceNo != null && String(invoiceNo) !== "") {
            setSourceInvoices(String(invoiceNo));
        }
        if (navState.supplierRef) setSupplierRef(String(navState.supplierRef));
        if (navState.date) {
            setInvoiceDate(String(navState.date).split("T")[0]);
            setDueDate(String(navState.date).split("T")[0]);
        }
    }, [navState]);

    // API Data
    const [suppliers, setSuppliers] = useState([]);
    const [costCenters, setCostCenters] = useState([]);
    const [taxGroups, setTaxGroups] = useState([]);
    const [termList, setTermList] = useState([]);
    const [chartMasters, setChartMasters] = useState([]);
    const [taxGroupDesc, setTaxGroupDesc] = useState("");
    const [termsDesc, setTermsDesc] = useState("");
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

    // Fiscal-year aware Reference (scoped to supplier credit notes trans_type 21)
    const { data: fiscalYears = [] } = useQuery({ queryKey: ["fiscalYears"], queryFn: getFiscalYears });
    const { data: companyData } = useQuery({ queryKey: ["company"], queryFn: getCompanies });
    const { data: sysPrefs = [] } = useQuery({ queryKey: ["sysPrefs"], queryFn: getSysPrefs });
    const { data: quickEntries = [] } = useQuery({
        queryKey: ["quickEntries"],
        queryFn: getQuickEntries,
    });

    const { reference: nextReference } = useNextFiscalYearReference(21, { asOfDate: invoiceDate });

    // Find selected fiscal year from company setup
    const selectedFiscalYear = useMemo(() => {
        if (!companyData || companyData.length === 0) return null;
        const company = companyData[0];
        return fiscalYears.find((fy: any) => fy.id === company.fiscal_year_id);
    }, [companyData, fiscalYears]);

    // Validate dates when fiscal year is selected
    useEffect(() => {
        if (selectedFiscalYear) {
            validateDate(invoiceDate, setInvoiceDateError);
        }
    }, [selectedFiscalYear]);

    useEffect(() => {
        if (nextReference) {
            setReference(nextReference);
        }
    }, [nextReference]);

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
            // default-select first supplier if none selected
            try {
                if ((!supplier || supplier === 0) && Array.isArray(s) && s.length > 0) {
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
                        grn_item_id: null,
                        po_detail_item: null,
                        po_item_detail: null,
                    }]);
                    return;
                }

                const openItems = await getOpenGrnItems({
                    supplier_id: Number(supplier),
                    invoiced_only: true,
                });
                const items = Array.isArray(openItems) ? openItems : [];

                const rows: any[] = [];
                for (const it of items) {
                    const grnId = it.grn_batch_id ?? it.batch_id ?? null;
                    if (!grnId) continue;
                    const qtyReceived = Number(it.qty_recd ?? 0) || 0;
                    const qtyInvoiced = Number(it.qty_invoiced ?? it.quantity_inv ?? 0) || 0;
                    const qtyYet = qtyInvoiced;
                    if (qtyInvoiced <= 0) continue;

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
                        po_item_detail: it.po_detail_item ?? null,
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
                    po_item_detail: null,
                }]);
            } catch (e) {
                console.error('Failed to load GRN data for supplier credit note:', e);
            }
        };
        loadGrnData();
    }, [supplier]);

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
            included: false,
            grn_item_id: null,
            po_detail_item: null,
            po_item_detail: null,
        },
    ]);

    // Filter itemRows by received date range
    const filteredItemRows = itemRows.filter((row) => {
        if (!receivedFromDate && !receivedToDate) return true;
        const rowDate = row.receivedOn;
        if (!rowDate) return true;
        if (receivedFromDate && rowDate < receivedFromDate) return false;
        if (receivedToDate && rowDate > receivedToDate) return false;
        return true;
    });

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
                included: false,
                grn_item_id: null,
                po_detail_item: null,
                po_item_detail: null,
            },
        ]);
    };

    const removeItemRow = (id) => {
        setItemRows((p) => p.filter((x) => x.id !== id));
    };

    const creditableQty = (r: { qtyInvoiced?: number }) =>
        Math.max(0, Number(r.qtyInvoiced) || 0);

    const updateItemRow = (id, field, value) => {
        setItemRows((p) =>
            p.map((r) => {
                if (r.id !== id) return r;
                const maxQty = creditableQty(r);
                const rawQtyYet =
                    field === "qtyYet" ? Number(value) : Number(r.qtyYet || 0);
                const qtyYet = Math.min(Math.max(0, rawQtyYet), maxQty);
                const price =
                    field === "price" ? Number(value) : Number(r.price || 0);
                const total =
                    field === "qtyYet" || field === "price"
                        ? qtyYet * price
                        : Number(r.total || 0);
                const included =
                    field === "qtyYet"
                        ? qtyYet > 0
                        : field === "price"
                          ? qtyYet > 0
                          : r.included;
                return {
                    ...r,
                    [field]: value,
                    qtyYet: field === "qtyYet" ? qtyYet : r.qtyYet,
                    price: field === "price" ? price : r.price,
                    total,
                    included,
                };
            })
        );
    };

    // subtotal includes only rows that have been 'added' (included === true)
    const itemsSubtotal = itemRows.reduce((s, r) => s + ((r.included ? Number(r.total || 0) : 0)), 0);

    const includeRow = (id) => {
        setItemRows((p) =>
            p.map((r) => {
                if (r.id !== id) return r;
                const qtyYet = creditableQty(r);
                return {
                    ...r,
                    included: qtyYet > 0,
                    qtyYet,
                    total: qtyYet * Number(r.price || 0),
                };
            })
        );
    };

    const cancelInclude = (id) => {
        setItemRows((p) => p.map((r) => r.id === id ? { ...r, included: false } : r));
    };

    const addAllItems = () => {
        setItemRows((p) =>
            p.map((r) => {
                if (!filteredItemRows.some((fr) => fr.id === r.id)) return r;
                const qtyYet = creditableQty(r);
                return {
                    ...r,
                    included: qtyYet > 0,
                    qtyYet,
                    total: qtyYet * Number(r.price || 0),
                };
            })
        );
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

    const creditNoteTotal = itemsSubtotal + glSubtotal;

    const accountLabel = (code: string) => {
        const chart = chartByCodeMap(chartMasters);
        return chart.get(String(code))?.account_name ?? String(code);
    };

    const buildGlRowsFromIncludedItems = (included: typeof itemRows) => {
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

        return [
            {
                id: 1,
                account: clearingCode,
                name: accountLabel(clearingCode),
                costCenter: costCenterLabel,
                amount: -netTotal,
                memo: "Reverse GRN clearing",
            },
            {
                id: 2,
                account: payableCode,
                name: accountLabel(payableCode),
                costCenter: "",
                amount: netTotal,
                memo: "Reverse accounts payable",
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
    };

    useEffect(() => {
        const crediting = itemRows.filter(
            (r) =>
                r.included &&
                Number(r.qtyYet) > 0 &&
                String(r.item || "").trim() !== ""
        );
        setGlRows(buildGlRowsFromIncludedItems(crediting));
    }, [itemRows, sysPrefs, chartMasters, costCenter, costCenters]);

    const applyQuickEntry = () => {
        const entry = (quickEntries as QuickEntry[]).find(
            (q) => String(q.id) === String(quickEntryId)
        );
        if (!entry?.destination_account) return;

        const amount = Number(quickEntryAmount || entry.default_base_amount || 0);
        if (!amount) return;

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
    const handleUpdate = () => {
        void handleEnterCreditNote();
    };

    const handleEnterCreditNote = async () => {
        try {
            const included = itemRows.filter((r: any) => r.included);
            const glLines = extractUserGlLines(glRows, sysPrefs as any[]);

            if ((!included || included.length === 0) && glLines.length === 0) {
                return alert('Select stock lines and/or add GL lines for the credit note');
            }

            // compute totals
            const subTotalIncluded = included.reduce((s: number, r: any) => s + Number(r.total || 0), 0);

            // resolve supplier
            const selectedSupplierObj = (suppliers || []).find((s: any) => Number(s.supplier_id ?? s.id ?? s.supplier) === Number(supplier));
            const supplierIdToSend = selectedSupplierObj ? Number(selectedSupplierObj.supplier_id ?? selectedSupplierObj.id ?? selectedSupplierObj.supplier) : null;
            if (!supplierIdToSend) return alert('Supplier not found');
            const taxIncludedForSupplier = Boolean(selectedSupplierObj?.tax_included ?? selectedSupplierObj?.taxIncluded ?? 0);

            const creditLines = included.map((r: any) => ({
                stock_id: String(r.item ?? ""),
                quantity: Number(r.qtyYet || 0),
                unit_price: Number(r.price || 0),
                grn_item_id: r.grn_item_id ?? r.id ?? undefined,
                po_detail_item_id: r.po_detail_item ?? r.po_item_detail ?? undefined,
                description: r.description || undefined,
            })).filter((l) => l.stock_id && l.quantity > 0);

            const sourceInvoiceNo = Number(String(sourceInvoices || "").trim());

            const saveResult = await runTransactionSave(() =>
                postSupplierCreditNote({
                    supplier_id: supplierIdToSend,
                    trans_date: invoiceDate || new Date().toISOString().split("T")[0],
                    due_date: dueDate || new Date().toISOString().split("T")[0],
                    reference: reference || undefined,
                    supp_reference: supplierRef || undefined,
                    tax_included: taxIncludedForSupplier,
                    comments: memo || undefined,
                    cost_center_id: Number(costCenter) || undefined,
                    source_invoice_trans_no:
                        Number.isFinite(sourceInvoiceNo) && sourceInvoiceNo > 0
                            ? sourceInvoiceNo
                            : undefined,
                    lines: creditLines.length > 0 ? creditLines : undefined,
                    gl_lines: glLines.length > 0 ? glLines : undefined,
                })
            );

            if (saveResult.ok === false) {
                showError(saveResult.message);
                return;
            }

            await queryClient.invalidateQueries({ queryKey: ["supplierAllocationInquiry"] });
            await queryClient.invalidateQueries({ queryKey: ["suppTrans"] });

            const createdTransNo = saveResult.data.trans_no;

            if (memo && memo.trim()) {
                try {
                    await createComment({ type: 21, id: createdTransNo, date_: invoiceDate, memo_: memo });
                } catch (e) {
                    console.warn('Failed to create comment for credit note supp_trans', createdTransNo, e);
                }
            }

            const successState: any = {
                location: undefined,
                reference: reference,
                date: invoiceDate,
                supplier: supplierIdToSend,
                supplierRef: supplierRef,
                creditNoteDate: invoiceDate,
                dueDate: dueDate,
                trans_type: 21,
                trans_no: createdTransNo,
                items: included.map((r: any) => ({
                    delivery: r.delivery,
                    item: r.item,
                    description: r.description || "",
                    quantity: Number(r.qtyYet || 0),
                    price: Number(r.price || 0),
                    lineValue: Number(r.total || (r.qtyYet * r.price) || 0),
                })),
                subtotal: itemsSubtotal,
                totalCreditNote: creditNoteTotal,
            };

            navigate('/purchase/transactions/supplier-credit-notes/success', { state: successState });
        } catch (err) {
            console.error('Failed to enter credit note', err);
            alert('Failed to enter credit note. See console for details.');
        }
    };

    const breadcrumbItems = [
        { title: "Purchases", href: "/purchases" },
        { title: "Supplier Credit Note" },
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
                    <PageTitle title="Supplier Credit Note" />
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
                                label="Source Invoices:"
                                size="small"
                                value={sourceInvoices}
                                onChange={(e) => setSourceInvoices(e.target.value)}
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
                                documentTotal={creditNoteTotal}
                                isLoading={supplierCreditLoading}
                                currencyCode={currencyCode}
                            />

                        </Stack>
                    </Grid>
                </Grid>
            </Paper>
            {/* ======================== TABLE 1 ======================== */}
            <Box mb={2}>
                <Typography variant="h6" textAlign="center">Delivery Item Selected For Adding To A Supplier Credit Note</Typography>
                <Stack direction="row" spacing={1} justifyContent="flex-end" mt={1} alignItems="center">
                    <TextField
                        label="Received between"
                        type="date"
                        size="small"
                        value={receivedFromDate}
                        onChange={(e) => setReceivedFromDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                    <Typography variant="body1">and</Typography>
                    <TextField
                        type="date"
                        size="small"
                        value={receivedToDate}
                        onChange={(e) => setReceivedToDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                    <Button variant="contained" onClick={addAllItems}>
                        Add All Item
                    </Button>
                </Stack>
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
                            <TableCell>Qty Yet To Credit</TableCell>
                            <TableCell>Price Before Tax</TableCell>
                            <TableCell>Total</TableCell>
                            <TableCell align="center">Action</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {filteredItemRows.map((row) => (
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
                                            <Button startIcon={<AddIcon />} onClick={() => includeRow(row.id)}>
                                                Add
                                            </Button>
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
                <Typography variant="h6">GL Items for this Credit Note</Typography>
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
            <Alert severity="info" sx={{ mb: 1 }}>
                GRN clearing and accounts payable lines are filled automatically when you
                enter a quantity to credit above, click <strong>Add</strong>, or use{" "}
                <strong>Add All Items</strong>.
            </Alert>
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
                        {glRows.map((row) => {
                            const isAutoGl =
                                row.memo === "Reverse GRN clearing" ||
                                row.memo === "Reverse accounts payable";
                            return (
                            <TableRow key={row.id}>
                                <TableCell>
                                    <TextField
                                        size="small"
                                        value={row.account}
                                        InputProps={{ readOnly: isAutoGl }}
                                    />
                                </TableCell>

                                <TableCell>
                                    {isAutoGl ? (
                                        <TextField
                                            size="small"
                                            value={row.name}
                                            InputProps={{ readOnly: true }}
                                        />
                                    ) : (
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
                                    )}
                                </TableCell>

                                <TableCell>
                                    <TextField
                                        size="small"
                                        value={row.costCenter}
                                        onChange={(e) =>
                                            updateGLRow(row.id, "costCenter", e.target.value)
                                        }
                                        InputProps={{ readOnly: isAutoGl }}
                                    />
                                </TableCell>

                                <TableCell>
                                    <FormattedNumberField
                                        size="small"
                                        value={row.amount}
                                        onChange={(e) =>
                                            updateGLRow(row.id, "amount", Number(e.target.value))
                                        }
                                        InputProps={{ readOnly: isAutoGl }}
                                    />
                                </TableCell>

                                <TableCell>
                                    <TextField
                                        size="small"
                                        value={row.memo}
                                        onChange={(e) =>
                                            updateGLRow(row.id, "memo", e.target.value)
                                        }
                                        InputProps={{ readOnly: isAutoGl }}
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
                                    ) : isAutoGl ? (
                                        <Typography variant="caption" color="text.secondary">
                                            Auto
                                        </Typography>
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
                            );
                        })}
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
                                Credit Note Total
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                                {formatMoney(creditNoteTotal)}
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
                    <Button variant="contained" onClick={handleEnterCreditNote} disabled={!!invoiceDateError || !canEdit}>
                        Enter Credit Note
                    </Button>
                </Stack>
            </Paper>
        </FormPageLayout>
    );
}
