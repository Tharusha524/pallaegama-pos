import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { getPaymentTerm, updatePaymentTerm } from "../../../../api/PaymentTerm/PaymentTermApi";
import { getPaymentTypes } from "../../../../api/PaymentType/PaymentTypeApi";
import ErrorModal from "../../../../components/ErrorModal";
import UpdateConfirmationModal from "../../../../components/UpdateConfirmationModal";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

interface PaymentTermsFormData {
  termsDescription: string;
  paymentType: string; // store as text value
}

interface PaymentType {
  id: number;
  name: string;
}

export default function UpdatePaymentTermsForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Payment terms');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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

  const AFTER_NO_OF_DAYS_ID = 3;
  const DAY_IN_FOLLOWING_MONTH_ID = 4;

  const handleAdditionalDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdditionalDays(e.target.value);
  };

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
    setAdditionalDays(""); // reset days when type changes
  };

  const validate = (): boolean => {
    const newErrors: Partial<PaymentTermsFormData> = {};
    if (!formData.termsDescription) newErrors.termsDescription = "Payment Description is required";
    if (!formData.paymentType) newErrors.paymentType = "Payment type is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate() && id) {
      try {
        // Convert paymentType text back to ID
        const selectedPaymentType = paymentTypes.find((pt) => pt.name === formData.paymentType);
        if (!selectedPaymentType) throw new Error("Invalid payment type selected");

        const payload = {
          description: formData.termsDescription,
          payment_type: selectedPaymentType.id,
          days_before_due:
            selectedPaymentType.id === AFTER_NO_OF_DAYS_ID ? parseInt(additionalDays || "0") : 0,
          day_in_following_month:
            selectedPaymentType.id === DAY_IN_FOLLOWING_MONTH_ID ? parseInt(additionalDays || "0") : 0,
          inactive: false,
        };

        await updatePaymentTerm(Number(id), payload);
        setOpen(true);
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to update Payment Term Please try again."
        );
        setErrorOpen(true);
      }
    }
  };

  useEffect(() => {
    const fetchPaymentTypes = async () => {
      try {
        const types: PaymentType[] = await getPaymentTypes();
        setPaymentTypes(types);
        return types;
      } catch (error) {
        console.error("Failed to fetch payment types", error);
        return [];
      }
    };

    const fetchPaymentTerm = async () => {
      if (!id) return;
      try {
        const types = await fetchPaymentTypes();
        const term = await getPaymentTerm(Number(id));

        // Map ID to name
        const paymentTypeObj = types.find((pt) => pt.id === term.payment_type);

        setFormData({
          termsDescription: term.description,
          paymentType: paymentTypeObj ? paymentTypeObj.name : "",
        });

        if (term.payment_type === AFTER_NO_OF_DAYS_ID) setAdditionalDays(term.days_before_due?.toString() || "");
        if (term.payment_type === DAY_IN_FOLLOWING_MONTH_ID) setAdditionalDays(term.day_in_following_month?.toString() || "");
      } catch (error) {
        console.error("Failed to fetch payment term", error);
        alert("Payment term not found");
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentTerm();
  }, [id, navigate]);

  if (loading) return <CircularProgress sx={{ mt: 4 }} />;

  const showDaysField =
    paymentTypes.find((pt) => pt.name === formData.paymentType)?.id === AFTER_NO_OF_DAYS_ID ||
    paymentTypes.find((pt) => pt.name === formData.paymentType)?.id === DAY_IN_FOLLOWING_MONTH_ID;

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

          <FormControl fullWidth size="small" error={!!errors.paymentType}>
            <InputLabel>Payment Type</InputLabel>
            <Select
              name="paymentType"
              value={formData.paymentType}
              onChange={handleSelectChange}
              label="Payment Type"
            >
              {paymentTypes.map((type) => (
                <MenuItem key={type.id} value={type.name}>
                  {type.name}
                </MenuItem>
              ))}
            </Select>
            {errors.paymentType && <FormHelperText>{errors.paymentType}</FormHelperText>}
          </FormControl>

          {showDaysField && (
            <FormattedNumberField
              label={
                paymentTypes.find((pt) => pt.name === formData.paymentType)?.id === AFTER_NO_OF_DAYS_ID
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

        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            mt: 3,
            gap: isMobile ? 2 : 0,
          }}
        >
          <Button fullWidth={isMobile} variant="outlined" onClick={() => navigate(-1)}>
            Back
          </Button>

          <Button disabled={!canEdit}
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            Update
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Payment Term has been updated successfully!"
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
