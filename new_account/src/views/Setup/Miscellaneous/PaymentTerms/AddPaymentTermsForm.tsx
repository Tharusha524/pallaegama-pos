import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  FormHelperText,
  useMediaQuery,
  useTheme,
  CircularProgress,
} from "@mui/material";
import theme from "../../../../theme";
import { createPaymentTerm } from "../../../../api/PaymentTerm/PaymentTermApi";
import { getPaymentTypes } from "../../../../api/PaymentType/PaymentTypeApi";
import ErrorModal from "../../../../components/ErrorModal";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

interface PaymentTermsFormData {
  termsDescription: string;
  paymentType: string; // store as string for Select compatibility
}

interface PaymentType {
  id: number;
  name: string;
}

export default function AddPaymentTermsForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Payment terms');
  const [formData, setFormData] = useState<PaymentTermsFormData>({
    termsDescription: "",
    paymentType: "",
  });

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<Partial<PaymentTermsFormData>>({});
  const [additionalDays, setAdditionalDays] = useState<string>("");
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  // Replace with actual IDs from your DB
  const AFTER_NO_OF_DAYS_ID = 3;
  const DAY_IN_FOLLOWING_MONTH_ID = 4;

  const handleAdditionalDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdditionalDays(e.target.value);
  };

  useEffect(() => {
    const fetchPaymentTypes = async () => {
      try {
        const types: PaymentType[] = await getPaymentTypes();
        setPaymentTypes(types);
      } catch (error) {
        console.error("Failed to fetch payment types", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPaymentTypes();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    setFormData({
      ...formData,
      paymentType: e.target.value,
    });
    setAdditionalDays(""); // Reset days when type changes
  };

  const validate = (): boolean => {
    const newErrors: Partial<PaymentTermsFormData> = {};

    if (!formData.termsDescription) newErrors.termsDescription = "Payment Description is required";
    if (!formData.paymentType) newErrors.paymentType = "Payment type is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate()) {
      try {
        const selectedPaymentTypeId = parseInt(formData.paymentType);

        const payload = {
          description: formData.termsDescription,
          payment_type: selectedPaymentTypeId,
          days_before_due:
            selectedPaymentTypeId === AFTER_NO_OF_DAYS_ID
              ? parseInt(additionalDays || "0")
              : 0,
          day_in_following_month:
            selectedPaymentTypeId === DAY_IN_FOLLOWING_MONTH_ID
              ? parseInt(additionalDays || "0")
              : 0,
          inactive: false,
        };

        await createPaymentTerm(payload);
        setOpen(true);
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to create payment term. Please try again."
        );
        setErrorOpen(true);
      }
    }
  };

  if (loading) return <CircularProgress sx={{ mt: 4 }} />;

  // Show days field only for specific types
  const showDaysField =
    parseInt(formData.paymentType) === AFTER_NO_OF_DAYS_ID ||
    parseInt(formData.paymentType) === DAY_IN_FOLLOWING_MONTH_ID;

  return (
    <FormPageLayout>
      <Paper
        sx={{
          p: theme.spacing(3),
          maxWidth: isMobile ? "100%" : "500px",
          width: "100%",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Payment Terms
        </Typography>

        <Stack spacing={2}>
          {/* Description */}
          <TextField
            label="Description"
            name="termsDescription"
            size="small"
            fullWidth
            value={formData.termsDescription}
            onChange={handleChange}
            error={!!errors.termsDescription}
            helperText={errors.termsDescription}
          />

          {/* Payment Type */}
          <FormControl fullWidth size="small" error={!!errors.paymentType}>
            <InputLabel>Payment Type</InputLabel>
            <Select
              name="paymentType"
              value={formData.paymentType}
              onChange={handleSelectChange}
              label="Payment Type"
            >
              {paymentTypes.map((type) => (
                <MenuItem key={type.id} value={type.id.toString()}>
                  {type.name}
                </MenuItem>
              ))}
            </Select>
            {errors.paymentType && (
              <FormHelperText>{errors.paymentType}</FormHelperText>
            )}
          </FormControl>

          {/* Days or Day in Following Month (only for selected types) */}
          {showDaysField && (
            <FormattedNumberField
              label={
                parseInt(formData.paymentType) === AFTER_NO_OF_DAYS_ID
                  ? "Days"
                  : "Day in Following Month"
              }
              name="additionalDays"
              size="small"
              fullWidth
              value={additionalDays}
              onChange={handleAdditionalDaysChange}
            />
          )}
        </Stack>

        {/* Action Buttons */}
        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            mt: 3,
            gap: isMobile ? 2 : 0,
          }}
        >
          <Button fullWidth={isMobile} variant="outlined" onClick={() => window.history.back()}>
            Back
          </Button>

          <Button disabled={!canEdit}
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            Add New
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Payment Term has been added successfully!"
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
