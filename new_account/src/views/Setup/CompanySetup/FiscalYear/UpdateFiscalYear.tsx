import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import {
    Box,
    Stack,
    Typography,
    Button,
    Paper,
    Divider,
    TextField,
    MenuItem,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { getFiscalYear, updateFiscalYear } from "../../../../api/FiscalYear/FiscalYearApi";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal"
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";
interface FiscalYearFormData {
    fiscalYearFrom: string;
    fiscalYearTo: string;
    isClosed: string;
}

interface Props {
    id: string;
}

export default function UpdateFiscalYear() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Fiscal years maintenance');
    const [open, setOpen] = useState(false);
    const [errorOpen, setErrorOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const queryClient = useQueryClient();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const {
        control,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
    } = useForm<FiscalYearFormData>({
        defaultValues: {
            fiscalYearFrom: "",
            fiscalYearTo: "",
            isClosed: "0",
        },
    });

    const fiscalYearFrom = watch("fiscalYearFrom");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await getFiscalYear(id);
                reset({
                    fiscalYearFrom: data.fiscal_year_from,
                    fiscalYearTo: data.fiscal_year_to,
                    isClosed: data.closed ? "1" : "0",
                });
            } catch (err) {
                setErrorMessage(
                    err?.response?.data?.message ||
                    "Failed to load Fiscal year Please try again."
                );
                setErrorOpen(true);
                // alert("Error fetching fiscal year data: " + JSON.stringify(err));
            }
        };
        fetchData();
    }, [id, reset]);

    const onSubmit = async (data: FiscalYearFormData) => {
        try {
            const payload = {
                fiscal_year_from: data.fiscalYearFrom,
                fiscal_year_to: data.fiscalYearTo,
                closed: Number(data.isClosed),
            };

            const updated = await updateFiscalYear(id, payload);
            console.log("Fiscal Year updated:", updated);
            queryClient.invalidateQueries({ queryKey: ["fiscalYears"] });
            queryClient.refetchQueries({ queryKey: ["fiscalYears"] });
            setOpen(true);
        } catch (err: any) {
            setErrorMessage(
                err?.response?.data?.message ||
                "Failed to update fiscal year Please try again."
            );
            setErrorOpen(true);
        }
    };

    return (
        <FormPageLayout>
            <Paper
                sx={{
                    p: theme.spacing(3),
                    width: "100%",
                    maxWidth: isMobile ? "100%" : "600px",
                    boxShadow: 2,
                    borderRadius: 2,
                }}
            >
                <Typography variant="h6" sx={{ mb: 2, textAlign: isMobile ? "center" : "left" }}>
                    Fiscal Year Setup
                </Typography>

                <Stack spacing={3}>
                    <Divider />

                    <Controller
                        name="fiscalYearFrom"
                        control={control}
                        rules={{ required: "Fiscal Year Begin is required" }}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                id="fiscalYearFrom"
                                label="Fiscal Year Begin"
                                type="date"
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                                error={!!errors.fiscalYearFrom}
                                helperText={errors.fiscalYearFrom?.message}
                            />
                        )}
                    />

                    <Controller
                        name="fiscalYearTo"
                        control={control}
                        rules={{
                            required: "Fiscal Year End is required",
                            validate: (value) =>
                                !fiscalYearFrom || value >= fiscalYearFrom
                                    ? true
                                    : "Fiscal Year End must be after Begin",
                        }}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                id="fiscalYearTo"
                                label="Fiscal Year End"
                                type="date"
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                                error={!!errors.fiscalYearTo}
                                helperText={errors.fiscalYearTo?.message}
                            />
                        )}
                    />

                    {/* Is Closed dropdown */}
                    <Controller
                        name="isClosed"
                        control={control}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                id="isClosed"
                                select
                                label="Is Closed"
                                SelectProps={{ native: false }}
                                fullWidth
                                size="small"
                            >
                                <MenuItem value={"0"}>No</MenuItem>
                                <MenuItem value={"1"}>Yes</MenuItem>
                            </TextField>
                        )}
                    />
                </Stack>

                <Box
                    sx={{
                        display: "flex",
                        flexDirection: isMobile ? "column" : "row",
                        justifyContent: "space-between",
                        gap: 2,
                        mt: 3,
                    }}
                >
                    <Button
                        fullWidth={isMobile}
                        onClick={() => navigate("/setup/companysetup/fiscal-years")}
                        variant="outlined"
                    >
                        Back
                    </Button>

                    <Button disabled={!canEdit}
                        fullWidth={isMobile}
                        variant="contained"
                        sx={{ backgroundColor: "var(--pallet-blue)" }}
                        onClick={handleSubmit(onSubmit)}
                    >
                        Update
                    </Button>
                </Box>
            </Paper>
            <UpdateConfirmationModal
                open={open}
                title="Success"
                content="Fiscal year has been updated successfully!"
                handleClose={() => setOpen(false)}
                onSuccess={() => navigate("/setup/companysetup/fiscal-years")}
            />
            <ErrorModal
                open={errorOpen}
                onClose={() => setErrorOpen(false)}
                message={errorMessage}
            />
        </FormPageLayout>
    );
}
