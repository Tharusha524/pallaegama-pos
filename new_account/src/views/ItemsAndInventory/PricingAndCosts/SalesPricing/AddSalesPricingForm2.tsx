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
import theme from "../../../../theme";
import { getCurrencies } from "../../../../api/Currency/currencyApi";
import { getSalesTypes } from "../../../../api/SalesMaintenance/salesService";
import { createSalesPricing, getSalesPricingByStockId } from "../../../../api/SalesPricing/SalesPricingApi";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

interface SalesPricingFormData {
  stock_id: string;
  currency_id: number | "";
  sales_type_id: number | "";
  price: string;
}

// Separate type for errors
interface SalesPricingFormErrors {
  stock_id?: string;
  currency_id?: string;
  sales_type_id?: string;
  price?: string;
}

// Type returned from APIs
interface Currency {
  id: number;
  currency_abbreviation: string;
}

interface SalesType {
  id?: number;
  typeName?: string;
}

export default function AddSalesPricingForm2() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales prices edition');
  const { itemId } = useParams<{ itemId: string }>();
  const [formData, setFormData] = useState<SalesPricingFormData>({
    stock_id: itemId || "",
    currency_id: "",
    sales_type_id: "",
    price: "",
  });
  const [errors, setErrors] = useState<SalesPricingFormErrors>({});
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [salesTypes, setSalesTypes] = useState<SalesType[]>([]);

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const navigate = useNavigate();

  // Fetch currencies and sales types
  useEffect(() => {
    const fetchData = async () => {
      try {
        const currenciesRes: Currency[] = await getCurrencies();
        const salesTypesRes: SalesType[] = await getSalesTypes();

        // Ensure id and typeName are not optional
        setCurrencies(currenciesRes.map(c => ({ id: c.id, currency_abbreviation: c.currency_abbreviation })));
        setSalesTypes(salesTypesRes.map(s => ({ id: s.id!, typeName: s.typeName! })));
      } catch (error) {
        setErrorMessage("Failed to fetch currencies or sales types. Please try again.");
        setErrorOpen(true);
        console.error("Failed to fetch currencies or sales types", error);
      }
    };
    fetchData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleSelectChange = (e: SelectChangeEvent<number>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: Number(value) });
    // Clear errors for the changed field and the combination error
    setErrors({ ...errors, [name]: "", sales_type_id: name === "currency_id" || name === "sales_type_id" ? "" : errors.sales_type_id });
  };

  const validate = () => {
    const newErrors: SalesPricingFormErrors = {};
    if (!formData.stock_id) newErrors.stock_id = "Stock ID is required";
    if (!formData.currency_id) newErrors.currency_id = "Currency is required";
    if (!formData.sales_type_id) newErrors.sales_type_id = "Sales Type is required";
    if (!formData.price) newErrors.price = "Price is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      // Determine stock id (prefer route param if available)
      const stockId = String(formData.stock_id || itemId || "");
      // Check for existing sales pricing for this specific item (stock_id)
      const existingPricings = await getSalesPricingByStockId(stockId);
      const duplicate = existingPricings.some((pricing: any) =>
        String(pricing.stock_id ?? pricing.stockId ?? pricing.stock) === stockId &&
        Number(pricing.currency_id) === Number(formData.currency_id) &&
        Number(pricing.sales_type_id) === Number(formData.sales_type_id)
      );
      if (duplicate) {
        setErrors({ ...errors, sales_type_id: "A sales pricing with this currency and sales type already exists for this item." });
        return;
      }

      await createSalesPricing({
        stock_id: formData.stock_id,
        currency_id: formData.currency_id,
        sales_type_id: formData.sales_type_id,
        price: Number(formData.price),
      });
      //alert("Sales Pricing added successfully!");
      setOpen(true);
      //navigate("/itemsandinventory/pricingandcosts/sales-pricing/");
    } catch (error) {
      console.error("API Error:", error);
     // alert("Failed to add Sales Pricing");
      setErrorMessage("Failed to add Sales Pricing. Please try again.");
      setErrorOpen(true);
    }
  };

  return (
    <Stack alignItems="center" sx={{ mt: 4, px: isMobile ? 2 : 0 }}>
      <Paper sx={{ p: theme.spacing(3), maxWidth: "500px", width: "100%", boxShadow: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Add Sales Pricing
        </Typography>

        <Stack spacing={2}>
          <FormControl size="small" fullWidth error={!!errors.currency_id}>
            <InputLabel>Currency</InputLabel>
            <Select
              name="currency_id"
              value={formData.currency_id}
              onChange={handleSelectChange}
              label="Currency"
            >
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
            <Select
              name="sales_type_id"
              value={formData.sales_type_id}
              onChange={handleSelectChange}
              label="Sales Type"
            >
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
          <Button onClick={() => navigate("/itemsandinventory/pricingandcosts/sales-pricing")}>
            Back
          </Button>

          <Button disabled={!canEdit}
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            Add Pricing
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="The new price has been added!"
        addFunc={async () => { }}
        handleClose={() => setOpen(false)}
        onSuccess={() => navigate("/itemsandinventory/pricingandcosts/sales-pricing/")}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </Stack>
  );
}
