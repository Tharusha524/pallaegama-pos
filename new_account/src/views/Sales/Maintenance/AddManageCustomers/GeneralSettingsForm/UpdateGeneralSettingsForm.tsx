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
    Grid,
    Button,
    Divider,
    FormHelperText,
} from "@mui/material";
import theme from "../../../../../theme";
import { getCustomer, getCustomers, updateCustomer, deleteCustomer } from "../../../../../api/Customer/AddCustomerApi";
import { useNavigate, useParams } from "react-router";
import { getCurrencies } from "../../../../../api/Currency/currencyApi";
import { getSalesTypes } from "../../../../../api/SalesMaintenance/salesService";
import { getCreditStatusSetups } from "../../../../../api/CreditStatusSetup/CreditStatusSetupApi";
import ErrorModal from "../../../../../components/ErrorModal";
import UpdateConfirmationModal from "../../../../../components/UpdateConfirmationModal";
import DeleteConfirmationModal from "../../../../../components/DeleteConfirmationModal";
import { getPaymentTerms } from "../../../../../api/PaymentTerm/PaymentTermApi";
import CostCenterSelect from "../../../../../components/CostCenterSelect";
import { getFriendlyApiErrorMessage } from "../../../../../utils/apiErrorMessage";
import FormattedNumberField from "../../../../../components/FormattedNumberField";
import { useAuth } from "../../../../../context/AuthContext";

interface GeneralSettingsFormProps {
    customerId?: string | number;
    onCustomerDeleted?: () => void;
}

interface Currency {
    id: number;
    currency_abbreviation: string;
    currency_name: string;
}

interface SalesType {
    id: number;
    typeName: string;
}

interface CreditStatusSetup {
    id: number;
    reason_description: string;
}

interface PaymentTerm {
    terms_indicator: number;
    description: string; // or whatever the display field is
}

/** Backend eager-loads relations on the same snake_case key, returning an object instead of the FK id. */
const resolveRelationId = (value: unknown): string => {
    if (value == null || value === "") return "";
    if (typeof value === "object" && value !== null && "id" in value) {
        const id = (value as { id?: number | string }).id;
        return id != null ? String(id) : "";
    }
    return String(value);
};

export default function UpdateGeneralSettingsForm({ customerId, onCustomerDeleted }: GeneralSettingsFormProps) {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales customer and branches changes');
    const { id } = useParams(); // get id from route if not passed as prop
    const customerIdToUse = customerId || id;
    const deletedRef = useRef(false);

    const [formData, setFormData] = useState({
        customerName: "",
        customerShortName: "",
        address: "",
        gstNumber: "",
        currency: "",
        salesType: "",
        phone: "",
        secondaryPhone: "",
        email: "",
        bankAccount: "",
        salesPerson: "",
        discountPercent: "",
        promptPaymentDiscount: "",
        creditLimit: "",
        paymentTerms: "",
        creditStatus: "",
        costCenter: "",
        generalNotes: "",
        defaultInventoryLocation: "",
        defaultShippingCompany: "",
        salesArea: "",
        taxGroup: "",
        status: "",
    });

    const [open, setOpen] = useState(false);
    const [openDeleteModal, setOpenDeleteModal] = useState(false);
    const [errorOpen, setErrorOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [customers, setCustomers] = useState<any[]>([]); // store customers
    const [selectedCustomer, setSelectedCustomer] = useState<string>("");

    // States for dropdown data
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [salesTypes, setSalesTypes] = useState<SalesType[]>([]);
    const [creditStatusSetups, setCreditStatusSetups] = useState<CreditStatusSetup[]>([]);
    const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);

    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;

        const fetchAllData = async () => {
            try {
                const [currRes, salesApiRes, creditApiRes, paymentRes] = await Promise.all([
                    getCurrencies(),
                    getSalesTypes(),
                    getCreditStatusSetups(),
                    getPaymentTerms(),
                ]);

                if (cancelled || deletedRef.current) return;

                // Map API responses to local interfaces
                const mappedCurrencies = (currRes as Currency[]) || [];
                const mappedSalesTypes = (salesApiRes as any[]).map((item: any) => ({
                    id: item.id,
                    typeName: item.typeName
                })) || [];
                const mappedCreditStatuses = (creditApiRes as any[])
                    .filter((item: any) => !item.inactive || Number(item.inactive) === 0)
                    .map((item: any) => ({
                        id: item.id,
                        reason_description: item.reason_description,
                    })) || [];

                const mappedPaymentTerms = (paymentRes as any[]).map((item: any) => ({
                    terms_indicator: item.terms_indicator,
                    description: item.description
                })) || [];
                setPaymentTerms(mappedPaymentTerms);

                setCurrencies(mappedCurrencies);
                setSalesTypes(mappedSalesTypes);
                setCreditStatusSetups(mappedCreditStatuses);

                // If editing, fetch customer and map IDs to names using API responses
                if (customerIdToUse) {
                    const customerRes = await getCustomer(customerIdToUse);
                    if (cancelled || deletedRef.current) return;

                    if (customerRes) {
                        // Resolve sales_type to a display name. The backend can return several shapes
                        // (an ID number/string, a nested object, or already the name). Try multiple strategies.
                        let salesTypeName = "";
                        const stVal = customerRes.sales_type;
                        if (stVal != null) {
                            if (typeof stVal === "object") {
                                salesTypeName = stVal.typeName || stVal.type_name || stVal.name || "";
                            } else {
                                const key = String(stVal);
                                // Try mapped sales types first (normalized)
                                const foundMapped = mappedSalesTypes.find((s: any) => String(s.id) === key || String(s.typeName) === key || String((s as any).type_name) === key);
                                if (foundMapped) salesTypeName = foundMapped.typeName || (foundMapped as any).type_name || "";
                                else {
                                    // Fallback to raw API response
                                    const foundRaw = (salesApiRes || []).find((s: any) => String(s.id) === key || String(s.typeName) === key || String(s.type_name) === key || String(s.name) === key);
                                    if (foundRaw) salesTypeName = foundRaw.typeName || (foundRaw as any).type_name || (foundRaw as any).name || "";
                                }
                            }
                        }
                        if (!salesTypeName) {
                            // helpful debug when a customer has an unexpected sales_type value
                            // eslint-disable-next-line no-console
                            console.warn("Sales type not resolved for customer", customerIdToUse, "value:", customerRes.sales_type, "available:", mappedSalesTypes);
                        }

                        const creditStatusId = resolveRelationId(
                            customerRes.credit_status ?? customerRes.creditStatus
                        );

                        // Currency uses abbreviation directly
                        const currencyCode = customerRes.curr_code || mappedCurrencies[0]?.currency_abbreviation || "";

                        setFormData({
                            customerName: customerRes.name || "",
                            customerShortName: customerRes.debtor_ref || "",
                            address: customerRes.address || "",
                            gstNumber: customerRes.gst || "",
                            currency: currencyCode,
                            salesType: salesTypeName,
                            phone: customerRes.phone || "",
                            secondaryPhone: customerRes.phone2 || "",
                            email: customerRes.email || "",
                            bankAccount: customerRes.bank_account || "",
                            salesPerson: customerRes.sales_person || "",
                            discountPercent: customerRes.discount || "",
                            promptPaymentDiscount: customerRes.pymt_discount || "",
                            creditLimit: customerRes.credit_limit || "",
                            paymentTerms: resolveRelationId(
                                customerRes.payment_terms ?? customerRes.paymentTerm
                            ),
                            creditStatus: creditStatusId,
                            costCenter: customerRes.cost_center_id || "",
                            generalNotes: customerRes.notes || "",
                            defaultInventoryLocation: customerRes.default_inventory_location || "",
                            defaultShippingCompany: customerRes.default_shipping_company || "",
                            salesArea: customerRes.sales_area || "",
                            taxGroup: customerRes.tax_group || "",
                            status: customerRes.inactive ? "Inactive" : "Active",
                        });
                    }
                }
            } catch (error) {
                if (cancelled || deletedRef.current) return;

                console.error("Error fetching data:", error);
                setErrorMessage(
                    "Failed to load data"
                );
                setErrorOpen(true);
                // alert("Failed to load data.");
            }
        };

        fetchAllData();

        return () => {
            cancelled = true;
        };
    }, [customerIdToUse]);

    const handleChange = (field: string, value: string) => {
        setFormData({ ...formData, [field]: value });
        if (errors[field]) {
            setErrors({ ...errors, [field]: "" });
        }
    };

    const validate = () => {
        let newErrors: { [key: string]: string } = {};

        // Name & Address
        if (!formData.customerName.trim())
            newErrors.customerName = "Customer Name is required";
        if (!formData.customerShortName.trim())
            newErrors.customerShortName = "Customer Short Name is required";
        if (!formData.address.trim())
            newErrors.address = "Address is required";

        // Currency & Sales Type
        if (!formData.currency) newErrors.currency = "Currency is required";
        if (!formData.salesType) newErrors.salesType = "Sales Type is required";

        // Contact (optional)
        // if (!formData.phone.trim()) newErrors.phone = "Phone is required";
        // else if (!/^\d{10,15}$/.test(formData.phone))
        //     newErrors.phone = "Phone must be 10–15 digits";

        // if (formData.secondaryPhone && !/^\d{10,15}$/.test(formData.secondaryPhone))
        //     newErrors.secondaryPhone = "Secondary Phone must be 10–15 digits";

        // if (!formData.email.trim()) newErrors.email = "Email is required";
        // else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
        //     newErrors.email = "Enter a valid email";

        // // Bank
        // if (!formData.bankAccount.trim())
        //     newErrors.bankAccount = "Bank Account Number is required";
        // else if (!/^\d+$/.test(formData.bankAccount))
        //     newErrors.bankAccount = "Bank Account must be numeric";

        // if (!formData.salesPerson)
        //     newErrors.salesPerson = "Sales Person is required";

        // Sales fields
        if (formData.discountPercent && isNaN(Number(formData.discountPercent)))
            newErrors.discountPercent = "Discount must be a number";

        if (
            formData.promptPaymentDiscount &&
            isNaN(Number(formData.promptPaymentDiscount))
        )
            newErrors.promptPaymentDiscount =
                "Prompt Payment Discount must be a number";

        if (formData.creditLimit && isNaN(Number(formData.creditLimit)))
            newErrors.creditLimit = "Credit Limit must be a number";

        if (!formData.paymentTerms)
            newErrors.paymentTerms = "Payment Terms are required";

        if (!formData.creditStatus)
            newErrors.creditStatus = "Credit Status is required";

        // Branch settings (optional except inventory location if needed elsewhere)

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleUpdate = async () => {
        if (!customerIdToUse) return;
        if (!validate()) {
            setErrorMessage(
                "Please fix validation errors before submitting"
            );
            setErrorOpen(true);
            // alert("Please fix validation errors before submitting.");
            return;
        }

        try {
            // Map form names back to IDs for backend expectations
            const salesTypeId = salesTypes.find(st => st.typeName === formData.salesType)?.id;

            const payload = {
                name: formData.customerName,
                debtor_ref: formData.customerShortName,
                address: formData.address,
                gst: formData.gstNumber,
                curr_code: formData.currency,
                sales_type: salesTypeId,
                phone: formData.phone,
                phone2: formData.secondaryPhone,
                email: formData.email,
                bank_account: formData.bankAccount,
                sales_person: formData.salesPerson,
                discount: formData.discountPercent,
                pymt_discount: formData.promptPaymentDiscount,
                credit_limit: formData.creditLimit,
                payment_terms: formData.paymentTerms ? Number(formData.paymentTerms) : null,
                credit_status: formData.creditStatus ? Number(formData.creditStatus) : null,
                notes: formData.generalNotes,
                default_inventory_location: formData.defaultInventoryLocation,
                default_shipping_company: formData.defaultShippingCompany,
                sales_area: formData.salesArea,
                tax_group: formData.taxGroup,
                inactive: formData.status === "Inactive",
            };

            await updateCustomer(customerIdToUse, payload);
            setOpen(true);
            navigate("/sales/maintenance/add-and-manage-customers");
        } catch (error) {
            console.error("Error updating customer:", error);
            setErrorMessage(
                getFriendlyApiErrorMessage(error) || "Failed to update customer. Please try again."
            );
            setErrorOpen(true);
        }
    };

    const handleDelete = () => {
        setOpenDeleteModal(true);
    };

    const confirmDelete = async (): Promise<void> => {
        if (!customerIdToUse) return;

        try {
            deletedRef.current = true;
            await deleteCustomer(customerIdToUse);
        } catch (error) {
            deletedRef.current = false;
            console.error("Error deleting customer:", error);
            setErrorMessage(
                getFriendlyApiErrorMessage(error) || "Failed to delete customer. Please try again."
            );
            setErrorOpen(true);
            throw error;
        }
    };

    const handleDeleteSuccess = () => {
        if (onCustomerDeleted) {
            onCustomerDeleted();
            return;
        }

        navigate("/sales/maintenance/add-and-manage-customers", { replace: true });
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
                <Typography
                    variant="h5"
                    sx={{ mb: theme.spacing(3), textAlign: "center" }}
                >
                    Update General Settings
                </Typography>

                <Grid container spacing={4}>
                    {/* Left Column */}
                    <Grid item xs={12} md={6}>
                        <Stack spacing={3}>
                            <Typography variant="subtitle1">Name and Address</Typography>
                            <Divider />
                            <TextField
                                label="Customer Name"
                                value={formData.customerName}
                                onChange={(e) => handleChange("customerName", e.target.value)}
                                fullWidth
                                size="small"
                                error={!!errors.customerName}
                                helperText={errors.customerName || " "}
                            />
                            <TextField
                                label="Customer Short Name"
                                value={formData.customerShortName}
                                onChange={(e) => handleChange("customerShortName", e.target.value)}
                                fullWidth
                                size="small"
                                error={!!errors.customerShortName}
                                helperText={errors.customerShortName || " "}
                            />
                            <TextField
                                label="Address"
                                value={formData.address}
                                onChange={(e) => handleChange("address", e.target.value)}
                                fullWidth
                                size="small"
                                multiline
                                rows={2}
                                error={!!errors.address}
                                helperText={errors.address || " "}
                            />
                            <TextField
                                label="GST Number"
                                value={formData.gstNumber}
                                onChange={(e) => handleChange("gstNumber", e.target.value)}
                                fullWidth
                                size="small"
                                error={!!errors.gstNumber}
                                helperText={errors.gstNumber || " "}
                            />
                            <FormControl fullWidth size="small" error={!!errors.currency}>
                                <InputLabel>Currency</InputLabel>
                                <Select
                                    value={formData.currency || ''}
                                    onChange={(e) => handleChange("currency", e.target.value)}
                                    label="Currency"
                                >
                                    {currencies.map((currency) => (
                                        <MenuItem key={currency.id} value={currency.currency_abbreviation}>
                                            {currency.currency_abbreviation}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <FormHelperText>{errors.currency || " "}</FormHelperText>
                            </FormControl>
                            <FormControl fullWidth size="small" error={!!errors.salesType}>
                                <InputLabel>Sales Type / Price List</InputLabel>
                                <Select
                                    value={formData.salesType || ''}
                                    onChange={(e) => handleChange("salesType", e.target.value)}
                                    label="Sales Type / Price List"
                                >
                                    {salesTypes.map((salesType) => (
                                        <MenuItem key={salesType.id} value={salesType.typeName}>
                                            {salesType.typeName}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <FormHelperText>{errors.salesType || " "}</FormHelperText>
                            </FormControl>
                            <FormControl fullWidth size="small" error={!!errors.status}>
                                <InputLabel>Customer Status</InputLabel>
                                <Select
                                    value={formData.status || ''}
                                    onChange={(e) => handleChange("status", e.target.value)}
                                    label="Customer Status"
                                >
                                    <MenuItem value="Active">Active</MenuItem>
                                    <MenuItem value="Inactive">Inactive</MenuItem>
                                </Select>
                                <FormHelperText>{errors.status || " "}</FormHelperText>
                            </FormControl>
                        </Stack>
                    </Grid>

                    {/* Right Column */}
                    <Grid item xs={12} md={6}>
                        <Stack spacing={3}>
                            <Typography variant="subtitle1">Sales</Typography>
                            <Divider />
                            <TextField
                                label="Discount Percent"
                                value={formData.discountPercent}
                                onChange={(e) => handleChange("discountPercent", e.target.value)}
                                fullWidth
                                size="small"
                                error={!!errors.discountPercent}
                                helperText={errors.discountPercent || " "}
                            />
                            <TextField
                                label="Prompt Payment Discount Percent"
                                value={formData.promptPaymentDiscount}
                                onChange={(e) =>
                                    handleChange("promptPaymentDiscount", e.target.value)
                                }
                                fullWidth
                                size="small"
                                error={!!errors.promptPaymentDiscount}
                                helperText={errors.promptPaymentDiscount || " "}
                            />
                            <FormattedNumberField
                                label="Credit Limit"
                                value={formData.creditLimit}
                                onChange={(e) => handleChange("creditLimit", e.target.value)}
                                fullWidth
                                size="small"
                                error={!!errors.creditLimit}
                                helperText={errors.creditLimit || " "}
                            />
                            <FormControl fullWidth size="small" error={!!errors.paymentTerms}>
                                <InputLabel>Payment Terms</InputLabel>
                                <Select
                                    value={formData.paymentTerms || ''}
                                    onChange={(e) => handleChange("paymentTerms", e.target.value)}
                                    label="Payment Terms"
                                >
                                    {paymentTerms.map((pt) => (
                                        <MenuItem key={pt.terms_indicator} value={String(pt.terms_indicator)}>
                                            {pt.description}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <FormHelperText>{errors.paymentTerms || " "}</FormHelperText>
                            </FormControl>

                            <FormControl fullWidth size="small" error={!!errors.creditStatus}>
                                <InputLabel id="update-credit-status-label">Credit Status</InputLabel>
                                <Select
                                    labelId="update-credit-status-label"
                                    value={formData.creditStatus || ""}
                                    onChange={(e) => handleChange("creditStatus", e.target.value)}
                                    label="Credit Status"
                                    displayEmpty
                                    renderValue={(selected) => {
                                        if (!selected) return "";
                                        const match = creditStatusSetups.find(
                                            (item) => String(item.id) === String(selected)
                                        );
                                        return match?.reason_description ?? "";
                                    }}
                                >
                                    {creditStatusSetups.map((creditStatus) => (
                                        <MenuItem key={creditStatus.id} value={String(creditStatus.id)}>
                                            {creditStatus.reason_description}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <FormHelperText>{errors.creditStatus || " "}</FormHelperText>
                            </FormControl>
                            <CostCenterSelect
                                label="CostCenter 1"
                                value={formData.costCenter || ""}
                                onChange={(v) => handleChange("costCenter", v)}
                                costCenterType={1}
                                error={!!errors.costCenter}
                                helperText={errors.costCenter || " "}
                            />
                            {/* Customer Branches */}
                            <Box>
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                                    <Typography variant="subtitle2">Customer Branches</Typography>
                                    <Button
                                        variant="text"
                                        size="small"
                                        onClick={() => navigate("/sales/maintenance/customer-branches")}
                                        sx={{ textTransform: "none" }}
                                    >
                                        Add or Edit
                                    </Button>
                                </Box>
                            </Box>

                            <TextField
                                label="General Notes"
                                value={formData.generalNotes}
                                onChange={(e) => handleChange("generalNotes", e.target.value)}
                                fullWidth
                                size="small"
                                multiline
                                rows={3}
                                error={!!errors.generalNotes}
                                helperText={errors.generalNotes || " "}
                            />

                        </Stack>
                    </Grid>
                </Grid>

                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mt: theme.spacing(4),
                        flexDirection: { xs: "column", sm: "row" },
                        gap: theme.spacing(2),
                    }}
                >
                    <Button variant="outlined" onClick={() => window.history.back()}>
                        Back
                    </Button>
                    <Button
                        variant="contained"
                        sx={{ backgroundColor: theme.palette.primary.main }}
                        onClick={handleUpdate}
                    >
                        Update Customer
                    </Button>
                    <Button disabled={!canEdit} variant="contained" color="error" onClick={handleDelete}>
                        Delete Customer
                    </Button>
                </Box>
            </Box>
            <DeleteConfirmationModal
                open={openDeleteModal}
                title="Delete Customer"
                content={
                    <Typography>
                        Are you sure you want to delete{" "}
                        <strong>{formData.customerName || "this customer"}</strong>? This action
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
                content="Customer has been updated successfully!"
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