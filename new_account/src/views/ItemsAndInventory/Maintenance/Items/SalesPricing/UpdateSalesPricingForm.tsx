import { FormPageLayout } from "../../../../../components/Layout/FormPageLayout";
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
  SelectChangeEvent,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import theme from "../../../../../theme";
import { getCurrencies } from "../../../../../api/Currency/currencyApi";
import { getSalesTypes } from "../../../../../api/SalesMaintenance/salesService";
import { getSalesPricingById, updateSalesPricing, getSalesPricingByStockId } from "../../../../../api/SalesPricing/SalesPricingApi";
import UpdateConfirmationModal from "../../../../../components/UpdateConfirmationModal"
import ErrorModal from "../../../../../components/ErrorModal";
import FormattedNumberField from "../../../../../components/FormattedNumberField";
import { useAuth } from "../../../../../context/AuthContext";

interface SalesPricingFormData {
  currency_id: number | "";
  sales_type_id: number | "";
  price: string;
}

interface Currency { id: number; currency_abbreviation: string; }
interface SalesType { id: number; typeName: string; }

export default function UpdateSalesPricingForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales prices edition');
  const { id } = useParams<{ id: string }>();
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState<SalesPricingFormData>({
    currency_id: "",
    sales_type_id: "",
    price: "",
  });
  const [stockId, setStockId] = useState<number | "">("");
  const [errors, setErrors] = useState<{
    currency_id?: string;
    sales_type_id?: string;
    price?: string;
  }>({});
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [salesTypes, setSalesTypes] = useState<SalesType[]>([]);

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const navigate = useNavigate();

  // Fetch currencies and sales types
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [currenciesRes, salesTypesRes] = await Promise.all([getCurrencies(), getSalesTypes()]);
        setCurrencies(currenciesRes.map(c => ({ id: c.id!, currency_abbreviation: c.currency_abbreviation! })));
        setSalesTypes(salesTypesRes.map(s => ({ id: s.id!, typeName: s.typeName! })));
      } catch (error) {
        setErrorMessage("Failed to fetch currencies or sales types. Please try again.");
        setErrorOpen(true);
        console.error("Failed to fetch currencies or sales types", error);
      }
    };
    fetchOptions();
  }, []);

  // Fetch existing pricing
  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const pricingRes = await getSalesPricingById(id);
        setFormData({
          currency_id: pricingRes.currency_id || pricingRes.currency?.id || "",
          sales_type_id: pricingRes.sales_type_id || pricingRes.sales_type?.id || "",
          price: pricingRes.price?.toString() || "",
        });
        setStockId(pricingRes.stock_id || "");
      } catch (error) {
        console.error("Failed to fetch data", error);
        setErrorMessage("Failed to fetch sales pricing data. Please try again.");
        setErrorOpen(true); 
      }
    };
    fetchData();
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  // MUI Select always returns string, so cast to number
  const handleSelectChange = async (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    const newValue = value === "" ? "" : Number(value);
    setFormData({ ...formData, [name]: newValue });
    setErrors({ ...errors, [name]: "" });

    // If changing sales_type_id, check if it already exists and auto-fill price
    if (name === "sales_type_id" && newValue && stockId) {
      try {
        const existingPricings = await getSalesPricingByStockId(stockId);
        const existingPricing = existingPricings.find(
          (p: any) => p.sales_type_id === newValue && p.currency_id === formData.currency_id && p.id !== Number(id)
        );
        if (existingPricing) {
          setFormData(prev => ({ ...prev, price: existingPricing.price.toString() }));
        }
      } catch (error) {
        setErrorMessage("Failed to fetch existing pricings. Please try again.");
        setErrorOpen(true);
      }
    }
  };

  const validate = () => {
    const newErrors: { currency_id?: string; sales_type_id?: string; price?: string } = {};
    if (!formData.currency_id) newErrors.currency_id = "Currency is required";
    if (!formData.sales_type_id) newErrors.sales_type_id = "Sales Type is required";
    if (!formData.price) newErrors.price = "Price is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


  const handleSubmit = async () => {
    if (!validate() || !id) return;

    try {
      await updateSalesPricing(id, {
        stock_id: stockId,
        currency_id: formData.currency_id,
        sales_type_id: formData.sales_type_id,
        price: Number(formData.price),
      });
      setOpen(true);
    //  navigate("/itemsandinventory/maintenance/items/");
    } catch (error) {
      console.error("API Error:", error);
      setErrorMessage("Failed to update Sales Pricing. Please try again.");
      setErrorOpen(true);
    }
  };

  return (
    <FormPageLayout>
      <Paper sx={{ p: theme.spacing(3), maxWidth: "500px", width: "100%", boxShadow: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Update Sales Pricing
        </Typography>

        <Stack spacing={2}>
          <FormControl size="small" fullWidth error={!!errors.currency_id}>
            <InputLabel>Currency</InputLabel>
            <Select name="currency_id" value={formData.currency_id.toString()} onChange={handleSelectChange} label="Currency">
              {currencies.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.currency_abbreviation}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.currency_id}</FormHelperText>
          </FormControl>

          <FormControl size="small" fullWidth error={!!errors.sales_type_id}>
            <InputLabel>Sales Type</InputLabel>
            <Select name="sales_type_id" value={formData.sales_type_id.toString()} onChange={handleSelectChange} label="Sales Type">
              {salesTypes.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.typeName}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.sales_type_id}</FormHelperText>
          </FormControl>

          <FormattedNumberField
            label="Price (per each)"
            name="price"
            size="small"
            fullWidth
            value={formData.price}
            onChange={handleInputChange}
            error={!!errors.price}
            helperText={errors.price}
          />
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
          <Button onClick={() => navigate("/itemsandinventory/maintenance/items/")}>Back</Button>
          <Button disabled={!canEdit} variant="contained" fullWidth={isMobile} sx={{ backgroundColor: "var(--pallet-blue)" }} onClick={handleSubmit}>
            Update
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="This price has been updated!"
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
