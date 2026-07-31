import { FormPageLayout } from "../../../../../components/Layout/FormPageLayout";
import React, { useEffect, useRef, useState } from "react";
import {
    Box,
    Stack,
    Typography,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Divider,
    Checkbox,
    FormControlLabel,
    Grid,
    FormHelperText,
    ListSubheader,
} from "@mui/material";
import theme from "../../../../../theme";
import {
    getSuppliers,
    getSupplierById,
    updateSupplier,
    deleteSupplier,
} from "../../../../../api/Supplier/SupplierApi";
import { useNavigate, useParams } from "react-router";
import { getChartMasters } from "../../../../../api/GLAccounts/ChartMasterApi";
import { getCurrencies, Currency } from "../../../../../api/Currency/currencyApi";
import { getTaxGroups, TaxGroup } from "../../../../../api/Tax/taxServices";
import DeleteConfirmationModal from "../../../../../components/DeleteConfirmationModal";
import UpdateConfirmationModal from "../../../../../components/UpdateConfirmationModal";
import ErrorModal from "../../../../../components/ErrorModal";
import { getPaymentTerms } from "../../../../../api/PaymentTerm/PaymentTermApi";
import CostCenterSelect from "../../../../../components/CostCenterSelect";
import { getFriendlyApiErrorMessage } from "../../../../../utils/apiErrorMessage";
import FormattedNumberField from "../../../../../components/FormattedNumberField";
import { useAuth } from "../../../../../context/AuthContext";

interface UpdateSupplierGeneralSettingProps {
    supplierId?: string | number;
    onSupplierDeleted?: () => void;
}

export default function UpdateSupplierGeneralSettingsForm({
    supplierId,
    onSupplierDeleted,
}: UpdateSupplierGeneralSettingProps) {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Suppliers changes');
    const deletedRef = useRef(false);
    const [formData, setFormData] = useState({
        supplierName: "",
        supplierShortName: "",
        gstNumber: "",
        website: "",
        supplierCurrency: "",
        taxGroup: "",
        ourCustomerNo: "",
        bankAccount: "",
        creditLimit: "",
        paymentTerms: "",
        pricesIncludeTax: false,
        accountsPayable: "",
        purchaseAccount: "",
        purchaseDiscountAccount: "",
        costCenter: "",
        documentLanguage: "",
        mailingAddress: "",
        physicalAddress: "",
        generalNotes: "",
        status: "",
    });

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

    const [chartMasters, setChartMasters] = useState<any[]>([]);
    useEffect(() => {
        getChartMasters().then(setChartMasters);
    }, []);

    const [currencies, setCurrencies] = useState<Currency[]>([]);
    useEffect(() => {
        getCurrencies().then(setCurrencies);
    }, []);

    const [TaxGroups, setTaxGroups] = useState<TaxGroup[]>([]);
    useEffect(() => {
        getTaxGroups().then(setTaxGroups);
    }, [])

    const [paymentTerms, setPaymentTerms] = useState<{ terms_indicator: number, description: string }[]>([]);
    useEffect(() => {
        async function fetchPaymentTerms() {
            const res = await getPaymentTerms(); // your API call
            setPaymentTerms(res);
        }
        fetchPaymentTerms();
    }, []);

    const [open, setOpen] = useState(false);
    const [errorOpen, setErrorOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [openDeleteModal, setOpenDeleteModal] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const navigate = useNavigate();
    const { id } = useParams(); // id from route
    const supplierIdToUse = supplierId || id;
    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const res = await getSuppliers();
                setSuppliers(res || []);
            } catch (err) {
                setErrorMessage(
                    err?.response?.data?.message ||
                    "Failed to fetch supplier Please try again."
                );
                setErrorOpen(true);
                console.error("Failed to fetch suppliers", err);
            }
        };
        fetchSuppliers();
    }, []);

    //  Load supplier data when editing
    useEffect(() => {
        if (!supplierIdToUse) return;

        let cancelled = false;

        const fetchSupplier = async () => {
            try {
                const res = await getSupplierById(supplierIdToUse);
                if (cancelled || deletedRef.current) return;

                if (res) {
                    setFormData({
                        supplierName: res.supp_name || "",
                        supplierShortName: res.supp_short_name || "",
                        gstNumber: res.gst_no || "",
                        website: res.website || "",
                        supplierCurrency: res.curr_code || "",
                        taxGroup: res.tax_group || "",
                        ourCustomerNo: res.supp_account_no || "",
                        bankAccount: res.bank_account || "",
                        creditLimit: res.credit_limit || "",
                        paymentTerms: res.payment_terms || "",
                        pricesIncludeTax: res.tax_included || false,
                        accountsPayable: res.payable_account || "",
                        purchaseAccount: res.purchase_account || "",
                        purchaseDiscountAccount: res.payment_discount_account || "",
                        costCenter: res.cost_center_id || "",
                        documentLanguage: res.document_language || "",
                        mailingAddress: res.mail_address || "",
                        physicalAddress: res.bill_address || "",
                        generalNotes: res.notes || "",
                        status: res.inactive ? "1" : "0",
                    });
                    setSelectedCustomer(res.id);
                }
            } catch (err) {
                if (cancelled || deletedRef.current) return;

                setErrorMessage(
                    getFriendlyApiErrorMessage(err) || "Failed to fetch supplier. Please try again."
                );
                setErrorOpen(true);
                console.error("Failed to fetch supplier details", err);
            }
        };

        fetchSupplier();

        return () => {
            cancelled = true;
        };
    }, [supplierIdToUse]);

    const handleChange = (field: string, value: string | boolean) => {
        setFormData({ ...formData, [field]: value });
        setErrors({ ...errors, [field]: "" });
    };

    //  Update supplier
    const handleUpdate = async () => {
        if (!supplierIdToUse) return;
        try {
            const payload = {
                supp_name: formData.supplierName || null,
                supp_short_name: formData.supplierShortName || null,
                gst_no: formData.gstNumber || "",
                website: formData.website || "",
                curr_code: formData.supplierCurrency || null,
                tax_group: formData.taxGroup || null,
                supp_account_no: formData.ourCustomerNo || "",
                bank_account: formData.bankAccount || "",
                credit_limit: formData.creditLimit ? Number(formData.creditLimit) : 0,
                payment_terms: formData.paymentTerms || null,
                tax_included: formData.pricesIncludeTax ? 1 : 0,
                payable_account: formData.accountsPayable || null,
                purchase_account: formData.purchaseAccount || null,
                payment_discount_account: formData.purchaseDiscountAccount || null,
                cost_center_id: Number(formData.costCenter) || 0,
                cost_center2_id: 0,
                mail_address: formData.mailingAddress || "",
                bill_address: formData.physicalAddress || formData.mailingAddress || "",
                notes: formData.generalNotes || "",
                inactive: formData.status === "1",
            };

            console.log("Update payload:", payload);

            await updateSupplier(supplierIdToUse, payload);
            setOpen(true);

        } catch (error: any) {
            setErrorMessage(
                getFriendlyApiErrorMessage(error) || "Failed to update supplier. Please try again."
            );
            setErrorOpen(true);
            console.error("Error updating supplier:", error);
        }
    };

    //  Delete supplier
    const handleDelete = () => {
        setOpenDeleteModal(true);
    };
    const confirmDelete = async (): Promise<void> => {
        if (!supplierIdToUse) return;

        try {
            deletedRef.current = true;
            await deleteSupplier(supplierIdToUse);
        } catch (error: any) {
            deletedRef.current = false;
            setErrorMessage(
                getFriendlyApiErrorMessage(error) || "Failed to delete supplier. Please try again."
            );
            setErrorOpen(true);
            console.error("Error deleting supplier:", error);
            throw error;
        }
    };

    const handleDeleteSuccess = () => {
        if (onSupplierDeleted) {
            onSupplierDeleted();
            return;
        }

        navigate("/purchase/maintenance/suppliers", { replace: true });
    };


    return (
        <FormPageLayout>
            <Box
                sx={{
                    width: "100%",
                    maxWidth: "1200px",
                    p: theme.spacing(3),
                    boxShadow: theme.shadows[2],
                    borderRadius: theme.shape.borderRadius,
                    backgroundColor: theme.palette.background.paper,
                }}
            >
                <Typography variant="h5" sx={{ mb: theme.spacing(3), textAlign: "center" }}>
                    Update Supplier Setup
                </Typography>

                <Grid container spacing={4}>
                    {/* Basic Data */}
                    <Grid item xs={12} md={6}>
                        <Stack spacing={2}>
                            <Typography variant="subtitle1">Basic Data</Typography>
                            <Divider />
                            <TextField
                                label="Supplier Name"
                                value={formData.supplierName}
                                onChange={(e) => handleChange("supplierName", e.target.value)}
                                size="small"
                                fullWidth
                                error={!!errors.supplierName}
                                helperText={errors.supplierName}
                            />
                            <TextField
                                label="Supplier Short Name"
                                value={formData.supplierShortName}
                                onChange={(e) => handleChange("supplierShortName", e.target.value)}
                                size="small"
                                fullWidth
                                error={!!errors.supplierShortName}
                                helperText={errors.supplierShortName}
                            />
                            <TextField
                                label="GST Number"
                                value={formData.gstNumber}
                                onChange={(e) => handleChange("gstNumber", e.target.value)}
                                size="small"
                                fullWidth
                                error={!!errors.gstNumber}
                                helperText={errors.gstNumber}
                            />
                            <TextField
                                label="Website"
                                value={formData.website}
                                onChange={(e) => handleChange("website", e.target.value)}
                                size="small"
                                fullWidth
                                error={!!errors.website}
                                helperText={errors.website}
                            />
                            <FormControl size="small" fullWidth error={!!errors.supplierCurrency}>
                                <InputLabel>Supplier Currency</InputLabel>
                                <Select
                                    value={formData.supplierCurrency}
                                    onChange={(e) => handleChange("supplierCurrency", e.target.value)}
                                >
                                    {currencies.map((currency) => (
                                        <MenuItem
                                            key={currency.id}
                                            value={currency.currency_abbreviation}
                                        >
                                            {currency.currency_name}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <Typography variant="caption" color="error">{errors.supplierCurrency}</Typography>
                            </FormControl>
                            <FormControl size="small" fullWidth error={!!errors.taxGroup}>
                                <InputLabel>Tax Group</InputLabel>
                                <Select
                                    value={formData.taxGroup}
                                    onChange={(e) => handleChange("taxGroup", e.target.value)}
                                >
                                    {TaxGroups.map((TaxGroup) => (
                                        <MenuItem
                                            key={TaxGroup.id}
                                            value={TaxGroup.id}
                                        >
                                            {TaxGroup.description}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <Typography variant="caption" color="error">{errors.taxGroup}</Typography>
                            </FormControl>
                            <TextField
                                label="Our Customer No."
                                value={formData.ourCustomerNo}
                                onChange={(e) => handleChange("ourCustomerNo", e.target.value)}
                                size="small"
                                fullWidth
                                error={!!errors.ourCustomerNo}
                                helperText={errors.ourCustomerNo}
                            />
                        </Stack>
                    </Grid>

                    {/* Purchasing */}
                    <Grid item xs={12} md={6}>
                        <Stack spacing={2}>
                            <Typography variant="subtitle1">Purchasing</Typography>
                            <Divider />

                            <TextField
                                label="Bank Name/ Account"
                                value={formData.bankAccount}
                                onChange={(e) => handleChange("bankAccount", e.target.value)}
                                size="small"
                                fullWidth
                                error={!!errors.bankAccount}
                                helperText={errors.bankAccount}
                            />
                            <FormattedNumberField
                                label="Credit Limit"
                                value={formData.creditLimit}
                                onChange={(e) => handleChange("creditLimit", e.target.value)}
                                size="small"
                                fullWidth
                                error={!!errors.creditLimit}
                                helperText={errors.creditLimit}
                            />
                            <FormControl size="small" fullWidth error={!!errors.paymentTerms}>
                                <InputLabel>Payment Terms</InputLabel>
                                <Select
                                    value={formData.paymentTerms}
                                    onChange={(e) => handleChange("paymentTerms", e.target.value)}
                                >
                                    {paymentTerms.map(term => (
                                        <MenuItem key={term.terms_indicator} value={term.terms_indicator}>
                                            {term.description}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <Typography variant="caption" color="error">{errors.paymentTerms}</Typography>
                            </FormControl>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={formData.pricesIncludeTax}
                                        onChange={(e) => handleChange("pricesIncludeTax", e.target.checked)}
                                    />
                                }
                                label="Prices Contain Tax Include"
                            />
                        </Stack>
                    </Grid>

                    {/* Accounts */}
                    <Grid item xs={12} md={6}>
                        <Stack spacing={2}>
                            <Typography variant="subtitle1">Accounts</Typography>
                            <Divider />
                            <FormControl size="small" fullWidth error={!!errors.accountsPayable}>
                                <InputLabel>Accounts Payable Account</InputLabel>
                                <Select
                                    value={formData.accountsPayable}
                                    onChange={(e) => handleChange("accountsPayable", e.target.value)}
                                >
                                    {Object.entries(
                                        chartMasters.reduce((acc: any, account) => {
                                            const type = account.account_type || "Unknown";
                                            if (!acc[type]) acc[type] = [];
                                            acc[type].push(account);
                                            return acc;
                                        }, {})
                                    ).flatMap(([type, accounts]: any) => [
                                        <ListSubheader key={`header-${type}`}>
                                            {accountTypeMap[Number(type)] || "Unknown"}
                                        </ListSubheader>,
                                        ...accounts.map((acc: any) => (
                                            <MenuItem key={acc.account_code} value={acc.account_code}>
                                                <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}>
                                                    {acc.account_code} - {acc.account_name}
                                                </Stack>
                                            </MenuItem>
                                        )),
                                    ])}
                                </Select>
                                <Typography variant="caption" color="error">{errors.accountsPayable}</Typography>
                            </FormControl>
                            <FormControl size="small" fullWidth error={!!errors.purchaseAccount}>
                                <InputLabel>Purchase Account</InputLabel>
                                <Select
                                    value={formData.purchaseAccount}
                                    onChange={(e) => handleChange("purchaseAccount", e.target.value)}
                                >
                                    {Object.entries(
                                        chartMasters.reduce((acc: any, account) => {
                                            const type = account.account_type || "Unknown";
                                            if (!acc[type]) acc[type] = [];
                                            acc[type].push(account);
                                            return acc;
                                        }, {})
                                    ).flatMap(([type, accounts]: any) => [
                                        <ListSubheader key={`header-${type}`}>
                                            {accountTypeMap[Number(type)] || "Unknown"}
                                        </ListSubheader>,
                                        ...accounts.map((acc: any) => (
                                            <MenuItem key={acc.account_code} value={acc.account_code}>
                                                <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}>
                                                    {acc.account_code} - {acc.account_name}
                                                </Stack>
                                            </MenuItem>
                                        )),
                                    ])}
                                </Select>
                                <Typography variant="caption" color="error">{errors.purchaseAccount}</Typography>
                            </FormControl>
                            <FormControl size="small" fullWidth error={!!errors.purchaseDiscountAccount}>
                                <InputLabel>Purchase Discount Account</InputLabel>
                                <Select
                                    value={formData.purchaseDiscountAccount}
                                    onChange={(e) => handleChange("purchaseDiscountAccount", e.target.value)}
                                >
                                    {Object.entries(
                                        chartMasters.reduce((acc: any, account) => {
                                            const type = account.account_type || "Unknown";
                                            if (!acc[type]) acc[type] = [];
                                            acc[type].push(account);
                                            return acc;
                                        }, {})
                                    ).flatMap(([type, accounts]: any) => [
                                        <ListSubheader key={`header-${type}`}>
                                            {accountTypeMap[Number(type)] || "Unknown"}
                                        </ListSubheader>,
                                        ...accounts.map((acc: any) => (
                                            <MenuItem key={acc.account_code} value={acc.account_code}>
                                                <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}>
                                                    {acc.account_code} - {acc.account_name}
                                                </Stack>
                                            </MenuItem>
                                        )),
                                    ])}
                                </Select>
                                <Typography variant="caption" color="error">{errors.purchaseDiscountAccount}</Typography>
                            </FormControl>
                        </Stack>
                    </Grid>

                    {/* Addresses */}
                    <Grid item xs={12} md={6}>
                        <Stack spacing={2}>
                            <Typography variant="subtitle1">Addresses</Typography>
                            <Divider />
                            <CostCenterSelect
                                label="CostCenter 1"
                                value={formData.costCenter || ""}
                                onChange={(v) => handleChange("costCenter", v)}
                                costCenterType={1}
                                error={!!errors.costCenter}
                                helperText={errors.costCenter || " "}
                            />
                            <TextField
                                label="Mailing Address"
                                value={formData.mailingAddress}
                                onChange={(e) => handleChange("mailingAddress", e.target.value)}
                                size="small"
                                fullWidth
                                multiline
                                rows={2}
                                error={!!errors.mailingAddress}
                                helperText={errors.mailingAddress}
                            />
                            <TextField
                                label="Physical Address"
                                value={formData.physicalAddress}
                                onChange={(e) => handleChange("physicalAddress", e.target.value)}
                                size="small"
                                fullWidth
                                multiline
                                rows={2}
                                error={!!errors.physicalAddress}
                                helperText={errors.physicalAddress}
                            />
                        </Stack>
                    </Grid>

                    {/* General */}
                    <Grid item xs={12} md={6}>
                        <Stack spacing={2}>
                            <Typography variant="subtitle1">General</Typography>
                            <Divider />
                            <TextField
                                label="General Notes"
                                value={formData.generalNotes}
                                onChange={(e) => handleChange("generalNotes", e.target.value)}
                                size="small"
                                fullWidth
                                multiline
                                rows={3}
                                error={!!errors.generalNotes}
                                helperText={errors.generalNotes}
                            />
                            <FormControl fullWidth size="small" error={!!errors.status}>
                                <InputLabel>Supplier Status</InputLabel>
                                <Select
                                    value={formData.status || ''}
                                    onChange={(e) => handleChange("status", e.target.value)}
                                    label="Customer Status"
                                >
                                    <MenuItem value="0">Active</MenuItem>
                                    <MenuItem value="1">Inactive</MenuItem>
                                </Select>
                                <FormHelperText>{errors.status || " "}</FormHelperText>
                            </FormControl>
                        </Stack>

                    </Grid>
                </Grid>

                {/* Action Buttons */}
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mt: theme.spacing(4),
                        flexDirection: { xs: "column", sm: "row" },
                        gap: theme.spacing(2),
                    }}
                >
                    <Button
                        variant="outlined"
                        onClick={() => window.history.back()}
                        sx={{ width: { xs: "100%", sm: 150 } }}
                    >
                        Back
                    </Button>

                    <Button
                        variant="contained"
                        sx={{
                            backgroundColor: theme.palette.primary.main,
                            width: { xs: "100%", sm: 150 }
                        }}
                        onClick={handleUpdate}
                    >
                        Update Supplier
                    </Button>

                    <Button disabled={!canEdit}
                        variant="contained"
                        color="error"
                        sx={{ width: { xs: "100%", sm: 150 } }}
                        onClick={handleDelete}
                    >
                        Delete Supplier
                    </Button>
                </Box>
            </Box>
            <DeleteConfirmationModal
                open={openDeleteModal}
                title="Delete Supplier"
                content={
                    <Typography>
                        Are you sure you want to delete{" "}
                        <strong>{formData.supplierName || "this supplier"}</strong>? This action
                        cannot be undone.
                    </Typography>
                }
                handleClose={() => setOpenDeleteModal(false)}
                handleReject={() => setOpenDeleteModal(false)}
                deleteFunc={confirmDelete}
                onSuccess={handleDeleteSuccess}
            />
            <UpdateConfirmationModal
                open={open}
                title="Success"
                content="Supplier has been updated successfully!"
                handleClose={() => setOpen(false)}
                onSuccess={() => window.history.back()}
            />
            <ErrorModal
                open={errorOpen}
                onClose={() => setErrorOpen(false)}
                message={errorMessage}
            />
        </FormPageLayout>
    );
}