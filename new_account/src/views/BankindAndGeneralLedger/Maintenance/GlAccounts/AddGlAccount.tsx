import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
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
    Paper,
    FormHelperText,
    useTheme,
    useMediaQuery,
    CircularProgress,
    ListSubheader,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { SelectChangeEvent } from "@mui/material";
import { getChartTypes } from "../../../../api/GLAccounts/ChartTypeApi";
import { getAccountTags } from "../../../../api/AccountTag/AccountTagsApi";
import { getChartMasters, createChartMaster } from "../../../../api/GLAccounts/ChartMasterApi";
import theme from "../../../../theme";
import ErrorModal from "../../../../components/ErrorModal";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import { useAuth } from "../../../../context/AuthContext";

interface GlAccountFormData {
    accountCode: string;
    accountCode2: string;
    accountName: string;
    accountGroup: string;
    accountTags: string;
    accountStatus: string;
}

interface ChartMaster {
    account_code: string;
    account_code2: string;
    account_name: string;
    account_type: string;
}

interface ChartType {
    id: string;
    name: string;
}

interface AccountTag {
    id: string;
    name: string;
}

export default function AddGlAccount() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('GL accounts edition');
    const [open, setOpen] = useState(false);
    const [errorOpen, setErrorOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const [formData, setFormData] = useState<GlAccountFormData>({
        accountCode: "",
        accountCode2: "",
        accountName: "",
        accountGroup: "",
        accountTags: "",
        accountStatus: "",
    });

    const [errors, setErrors] = useState<Partial<GlAccountFormData>>({});
    const [groups, setGroups] = useState<ChartType[]>([]);
    const [tags, setTags] = useState<AccountTag[]>([]);
    const [chartAccounts, setChartAccounts] = useState<ChartMaster[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOption, setSelectedOption] = useState("new");

    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDropdownData = async () => {
            try {
                setLoading(true);
                const [groupData, tagData, chartMasterData] = await Promise.all([
                    getChartTypes(),
                    getAccountTags(),
                    getChartMasters(),
                ]);
                setGroups(groupData);
                setTags(tagData);
                setChartAccounts(chartMasterData);
            } catch (error) {
                console.error("Failed to load dropdown data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDropdownData();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        setErrors({ ...errors, [name]: "" });
    };

    const handleSelectChange = (e: SelectChangeEvent<string>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        setErrors({ ...errors, [name]: "" });
    };

    const validate = () => {
        const newErrors: Partial<GlAccountFormData> = {};
        if (!formData.accountCode) newErrors.accountCode = "Account Code is required";
        if (!formData.accountCode2) newErrors.accountCode2 = "Account Code 2 is required";
        if (!formData.accountName) newErrors.accountName = "Account Name is required";
        if (!formData.accountGroup) newErrors.accountGroup = "Account Group is required";
        if (!formData.accountStatus) newErrors.accountStatus = "Account Status is required";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        const payload = {
            account_code: formData.accountCode.trim(),
            account_code2: formData.accountCode2.trim(),
            account_name: formData.accountName.trim(),
            account_type: formData.accountGroup,
            inactive: formData.accountStatus === "inactive" ? 1 : 0,
        };

        try {
            await createChartMaster(payload);
            setOpen(true);

            setFormData({
                accountCode: "",
                accountCode2: "",
                accountName: "",
                accountGroup: "",
                accountTags: "",
                accountStatus: "",
            });

            const updatedChartAccounts = await getChartMasters();
            setChartAccounts(updatedChartAccounts);
        } catch (error: any) {
            setErrorMessage(
                error?.response?.data?.message ||
                "Failed to save GL Account."
            );
            setErrorOpen(true);
            console.error("Failed to save GL Account:", error);
        }
    };

    if (loading) {
        return (
            <Stack alignItems="center" justifyContent="center" sx={{ mt: 10 }}>
                <CircularProgress />
                <Typography sx={{ mt: 2 }}>Loading data...</Typography>
            </Stack>
        );
    }

    // Group chart accounts by backend GL Account Group names
    const groupedAccounts = chartAccounts.reduce((acc, account) => {
        const matchedGroup = groups.find(g => String(g.id) === String(account.account_type));
        const typeText = matchedGroup ? matchedGroup.name : "Unknown Group";
        
        if (!acc[typeText]) acc[typeText] = [];
        acc[typeText].push(account);
        return acc;
    }, {} as Record<string, ChartMaster[]>);

    return (
        <FormPageLayout>
            <Paper
                sx={{
                    p: theme.spacing(3),
                    maxWidth: "600px",
                    width: "100%",
                    boxShadow: 2,
                    borderRadius: 2,
                }}
            >
                {/* Dropdown for Add / Update */}
                <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                    <InputLabel>Select Account</InputLabel>
                    <Select
                        value={selectedOption}
                        onChange={(e) => setSelectedOption(e.target.value)}
                        label="Select Account"
                    >
                        <MenuItem value="new">New Account</MenuItem>

                        {Object.entries(groupedAccounts).map(([typeText, accounts]) => (
                            <React.Fragment key={typeText}>
                                <ListSubheader>{typeText}</ListSubheader>
                                {accounts.map((acc) => (
                                    <MenuItem
                                        key={acc.account_code}
                                        value={acc.account_code}
                                        onClick={() =>
                                            navigate(
                                                `/bankingandgeneralledger/maintenance/update-gl-account/${acc.account_code}`
                                            )
                                        }
                                    >
                                        {acc.account_code} - {acc.account_name}
                                    </MenuItem>
                                ))}
                            </React.Fragment>
                        ))}
                    </Select>
                </FormControl>

                {selectedOption === "new" && (
                    <>
                        <Typography
                            variant="h6"
                            sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}
                        >
                            Add GL Account
                        </Typography>

                        <Stack spacing={2}>
                            <TextField
                                label="Account Code"
                                name="accountCode"
                                size="small"
                                fullWidth
                                value={formData.accountCode}
                                onChange={handleInputChange}
                                error={!!errors.accountCode}
                                helperText={errors.accountCode}
                            />
                            <TextField
                                label="Account Code 2"
                                name="accountCode2"
                                size="small"
                                fullWidth
                                value={formData.accountCode2}
                                onChange={handleInputChange}
                                error={!!errors.accountCode2}
                                helperText={errors.accountCode2}
                            />
                            <TextField
                                label="Account Name"
                                name="accountName"
                                size="small"
                                fullWidth
                                value={formData.accountName}
                                onChange={handleInputChange}
                                error={!!errors.accountName}
                                helperText={errors.accountName}
                            />

                            {/* Account Group */}
                            <FormControl size="small" fullWidth error={!!errors.accountGroup}>
                                <InputLabel>Account Group</InputLabel>
                                <Select
                                    name="accountGroup"
                                    value={formData.accountGroup}
                                    onChange={handleSelectChange}
                                    label="Account Group"
                                >
                                    {groups.map((group) => (
                                        <MenuItem key={group.id} value={group.id}>
                                            {group.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <FormHelperText>{errors.accountGroup}</FormHelperText>
                            </FormControl>

                            {/* Account Tags */}
                            <FormControl size="small" fullWidth>
                                <InputLabel>Account Tags</InputLabel>
                                <Select
                                    name="accountTags"
                                    value={formData.accountTags}
                                    onChange={handleSelectChange}
                                    label="Account Tags"
                                >
                                    {tags.map((tag) => (
                                        <MenuItem key={tag.id} value={tag.id}>
                                            {tag.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {/* Account Status */}
                            <FormControl size="small" fullWidth error={!!errors.accountStatus}>
                                <InputLabel>Account Status</InputLabel>
                                <Select
                                    name="accountStatus"
                                    value={formData.accountStatus}
                                    onChange={handleSelectChange}
                                    label="Account Status"
                                >
                                    <MenuItem value="active">Active</MenuItem>
                                    <MenuItem value="inactive">Inactive</MenuItem>
                                </Select>
                                <FormHelperText>{errors.accountStatus}</FormHelperText>
                            </FormControl>
                        </Stack>

                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                mt: 3,
                                flexDirection: isMobile ? "column" : "row",
                                gap: isMobile ? 2 : 0,
                            }}
                        >
                            <Button onClick={() => navigate("/bankingandgeneralledger/maintenance/")}>
                                Back
                            </Button>

                            <Button disabled={!canEdit}
                                variant="contained"
                                fullWidth={isMobile}
                                sx={{ backgroundColor: "var(--pallet-blue)" }}
                                onClick={handleSubmit}
                            >
                                Add GL Account
                            </Button>
                        </Box>
                    </>
                )}
            </Paper>
            <AddedConfirmationModal
                open={open}
                title="Success"
                content="GL Account has been added successfully!"
                addFunc={async () => { }}
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
