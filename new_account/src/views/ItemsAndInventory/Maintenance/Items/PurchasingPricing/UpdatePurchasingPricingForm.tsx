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
import { getPurchDataById, updatePurchData } from "../../../../../api/PurchasingPricing/PurchasingPricingApi";
import { getSuppliers } from "../../../../../api/Supplier/SupplierApi";
import UpdateConfirmationModal from "../../../../../components/UpdateConfirmationModal"
import ErrorModal from "../../../../../components/ErrorModal";
import FormattedNumberField from "../../../../../components/FormattedNumberField";
import { useAuth } from "../../../../../context/AuthContext";

interface PurchasingPricingFormData {
  supplier_id: number | "";
  price: string;
  suppliers_uom: string;
  conversion_factor: string;
  supplier_description: string;
}

interface PurchasingPricingErrors {
  price?: string;
  suppliers_uom?: string;
  conversion_factor?: string;
  supplier_description?: string;
}

interface Supplier {
  supplier_id: number;
  supp_name: string;
}

export default function UpdatePurchasingPricingForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Purchase price changes');
  const { supplierId, stockId } = useParams<{ supplierId: string; stockId: string }>();
  const [formData, setFormData] = useState<PurchasingPricingFormData>({
    supplier_id: "",
    price: "",
    suppliers_uom: "",
    conversion_factor: "",
    supplier_description: "",
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const [errors, setErrors] = useState<PurchasingPricingErrors>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const suppliersRes = await getSuppliers();
        setSuppliers(suppliersRes);
      } catch (error) {
        setErrorMessage("Failed to fetch suppliers. Please try again.");
        setErrorOpen(true);
        console.error("Failed to fetch suppliers", error);
      }
    };
    fetchSuppliers();
  }, []);

  // Fetch existing purchasing pricing data
  useEffect(() => {
    if (!supplierId || !stockId) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const pricingRes = await getPurchDataById(Number(supplierId), stockId);
        setFormData({
          supplier_id: pricingRes.supplier_id || "",
          price: pricingRes.price?.toString() || "",
          suppliers_uom: pricingRes.suppliers_uom || "",
          conversion_factor: pricingRes.conversion_factor?.toString() || "",
          supplier_description: pricingRes.supplier_description || "",
        });
      } catch (error) {
        setErrorMessage("Failed to fetch purchasing pricing data. Please try again.");
        setErrorOpen(true);
        console.error("Failed to fetch purchasing pricing data", error);
       // alert("Failed to fetch purchasing pricing data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [supplierId, stockId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    if (name === "supplier_id") {
      setFormData({ ...formData, [name]: value === "" ? "" : Number(value) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const newErrors: PurchasingPricingErrors = {};
    if (!formData.price) newErrors.price = "Price is required";
    if (!formData.suppliers_uom) newErrors.suppliers_uom = "Supplier UOM is required";
    if (!formData.conversion_factor) newErrors.conversion_factor = "Conversion factor is required";
    if (!formData.supplier_description) newErrors.supplier_description = "Supplier code/description is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !supplierId || !stockId) return;

    try {
      await updatePurchData(Number(supplierId), stockId, {
        supplier_id: Number(supplierId),
        stock_id: stockId,
        price: Number(formData.price),
        suppliers_uom: formData.suppliers_uom,
        conversion_factor: Number(formData.conversion_factor),
        supplier_description: formData.supplier_description,
      });
      setOpen(true);
      // navigate("/itemsandinventory/maintenance/items/", {
      //   state: { tab: 2, selectedItem: stockId }
      // });
    } catch (error) {
      console.error("API Error:", error);
      setErrorMessage("Failed to update Purchasing Pricing. Please try again.");
      setErrorOpen(true);
     //alert("Failed to update Purchasing Pricing");
    }
  };

  return (
    <FormPageLayout>
      <Paper
        sx={{
          p: theme.spacing(3),
          maxWidth: "500px",
          width: "100%",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Update Purchasing Pricing
        </Typography>

        <Stack spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel>Supplier</InputLabel>
            <Select
              name="supplier_id"
              value={formData.supplier_id.toString()}
              onChange={handleSelectChange}
              label="Supplier"
              disabled
            >
              {suppliers.map((supplier) => (
                <MenuItem key={supplier.supplier_id} value={supplier.supplier_id}>
                  {supplier.supp_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Price */}
          <FormattedNumberField
            label="Price"
            name="price"
            size="small"
            fullWidth
            value={formData.price}
            onChange={handleInputChange}
            error={!!errors.price}
            helperText={errors.price}
          />

          {/* Supplier UOM */}
          <TextField
            label="Supplier Units of Measure"
            name="suppliers_uom"
            size="small"
            fullWidth
            value={formData.suppliers_uom}
            onChange={handleInputChange}
            error={!!errors.suppliers_uom}
            helperText={errors.suppliers_uom}
            disabled={loading}
          />

          {/* Conversion Factor */}
          <FormattedNumberField
            label="Conversion Factor (to our UOM)"
            name="conversion_factor"
            size="small"
            fullWidth
            value={formData.conversion_factor}
            onChange={handleInputChange}
            error={!!errors.conversion_factor}
            helperText={errors.conversion_factor}
            disabled={loading}
          />

          {/* Supplier Code / Description */}
          <TextField
            label="Supplier's Code or Description"
            name="supplier_description"
            size="small"
            fullWidth
            value={formData.supplier_description}
            onChange={handleInputChange}
            error={!!errors.supplier_description}
            helperText={errors.supplier_description}
            disabled={loading}
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
          <Button onClick={() => navigate("/itemsandinventory/maintenance/items/", {
            state: { tab: 2, selectedItem: stockId }
          })}>
            Back
          </Button>

          <Button
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
            disabled={!canEdit}
          >
            Update
          </Button>
        </Box>
      </Paper>
      <UpdateConfirmationModal
        open={open}
        title="Success"
        content="Supplier purchasing data has been updated!"
        handleClose={() => setOpen(false)}
        onSuccess={() => navigate("/itemsandinventory/maintenance/items/", {
          state: { tab: 2, selectedItem: stockId }
        })}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        message={errorMessage}
      />
    </FormPageLayout>
  );
}
