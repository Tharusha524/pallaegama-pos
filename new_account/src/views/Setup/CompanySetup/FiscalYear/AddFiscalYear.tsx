import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import { createFiscalYear } from "../../../../api/FiscalYear/FiscalYearApi";
import { useNavigate } from "react-router";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

interface FiscalYearFormData {
    fiscalYearFrom: string;
    fiscalYearTo: string;
    isClosed: string;
}

export default function AddFiscalYear() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Fiscal years maintenance');
    const [open, setOpen] = useState(false);
    const [errorOpen, setErrorOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const {
        control,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<FiscalYearFormData>({
        defaultValues: {
            fiscalYearFrom: "",
            fiscalYearTo: "",
            isClosed: "0",
        },
    });

    const fiscalYearFrom = watch("fiscalYearFrom");

    const onSubmit = async (data: FiscalYearFormData) => {
        try {
            const response = await createFiscalYear({
                fiscal_year_from: data.fiscalYearFrom,
                fiscal_year_to: data.fiscalYearTo,
                closed: Number(data.isClosed),
            });
            // Refresh react-query cache if you have a list
            queryClient.invalidateQueries({ queryKey: ["fiscalYears"] });
            queryClient.refetchQueries({ queryKey: ["fiscalYears"] });

            setOpen(true);

        } catch (err: any) {
            setErrorMessage(
                err?.response?.data?.message ||
                "Failed to add Fiscal year Please try again."
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
                        Add New
                    </Button>
                </Box>
            </Paper>
            <AddedConfirmationModal
                open={open}
                title="Success"
                content="Fiscal Year has been added successfully!"
                addFunc={async () => { }}
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