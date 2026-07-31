import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState } from "react";
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
  FormHelperText,
  SelectChangeEvent,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import theme from "../../../../theme";
import { createItemUnit } from "../../../../api/ItemUnit/ItemUnitApi";
import AddedConfirmationModal from "../../../../components/AddedConfirmationModal";
import ErrorModal from "../../../../components/ErrorModal";
import { useAuth } from "../../../../context/AuthContext";

interface UnitsOfMeasureFormData {
  unitAbbreviation: string;
  descriptionName: string;
  decimalPlaces: string;
}

export default function AddUnitsOfMeasureForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Units of measure');
  const [open, setOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState<UnitsOfMeasureFormData>({
    unitAbbreviation: "",
    descriptionName: "",
    decimalPlaces: "",
  });

  const [errors, setErrors] = useState<Partial<UnitsOfMeasureFormData>>({});

  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const validate = () => {
    const newErrors: Partial<UnitsOfMeasureFormData> = {};

    if (!formData.unitAbbreviation) newErrors.unitAbbreviation = "Unit Abbreviation is required";
    if (!formData.descriptionName) newErrors.descriptionName = "Description Name is required";
    if (!formData.decimalPlaces) newErrors.decimalPlaces = "Please select decimal places";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate()) {
      try {
        const payload = {
          abbr: formData.unitAbbreviation,
          name: formData.descriptionName,
          decimals: Number(formData.decimalPlaces),
        };

        await createItemUnit(payload);
        setOpen(true);
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error?.response?.data?.message ||
          "Failed to add item unit Please try again."
        );
        setErrorOpen(true);
      }
    }
  };

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
        <Typography variant="h6" sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}>
          Units of Measure Setup
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Unit Abbreviation"
            name="unitAbbreviation"
            size="small"
            fullWidth
            value={formData.unitAbbreviation}
            onChange={handleInputChange}
            error={!!errors.unitAbbreviation}
            helperText={errors.unitAbbreviation || " "}
          />

          <TextField
            label="Description Name"
            name="descriptionName"
            size="small"
            fullWidth
            value={formData.descriptionName}
            onChange={handleInputChange}
            error={!!errors.descriptionName}
            helperText={errors.descriptionName || " "}
          />

          <FormControl size="small" fullWidth error={!!errors.decimalPlaces}>
            <InputLabel>Decimal Places</InputLabel>
            <Select
              name="decimalPlaces"
              value={formData.decimalPlaces}
              onChange={handleSelectChange}
              label="Decimal Places"
            >
              <MenuItem value="0">0</MenuItem>
              <MenuItem value="1">1</MenuItem>
              <MenuItem value="2">2</MenuItem>
              <MenuItem value="3">3</MenuItem>
              <MenuItem value="4">4</MenuItem>
              <MenuItem value="5">5</MenuItem>
              <MenuItem value="6">6</MenuItem>
            </Select>
            <FormHelperText>{errors.decimalPlaces || " "}</FormHelperText>
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
          <Button onClick={() => window.history.back()}>Back</Button>

          <Button disabled={!canEdit}
            variant="contained"
            fullWidth={isMobile}
            sx={{ backgroundColor: "var(--pallet-blue)" }}
            onClick={handleSubmit}
          >
            Add Unit
          </Button>
        </Box>
      </Paper>
      <AddedConfirmationModal
        open={open}
        title="Success"
        content="Unit of Measure has been added successfully!"
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
