import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSnackbar } from "notistack";
import { getPrinter, updatePrinter } from "../../../../api/Printer/PrinterApi";
import { useAuth } from "../../../../context/AuthContext";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Paper,
  useTheme,
  useMediaQuery,
} from "@mui/material";

interface UpdatePrintersData {
  printerName: string;
  printerDescription: string;
  hostOrIp: string;
  port: string;
  printerQueue: string;
  timeout: string;
}

export default function UpdatePrintersForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Printers configuration');
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState<UpdatePrintersData>({
    printerName: "",
    printerDescription: "",
    hostOrIp: "",
    port: "",
    printerQueue: "",
    timeout: "",
  });

  const [errors, setErrors] = useState<Partial<UpdatePrintersData>>({});
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    const newErrors: Partial<UpdatePrintersData> = {};
    if (!formData.printerName.trim())
      newErrors.printerName = "Printer Name is required";
    if (!formData.printerDescription.trim())
      newErrors.printerDescription = "Printer Description is required";
    if (!formData.hostOrIp.trim())
      newErrors.hostOrIp = "Host name or IP is required";
    if (!formData.port.trim()) newErrors.port = "Port is required";
    if (!formData.printerQueue.trim())
      newErrors.printerQueue = "Printer Queue is required";
    if (!formData.timeout.trim())
      newErrors.timeout = "Timeout is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (!id) return;
    getPrinter(Number(id)).then((p) => {
      setFormData({
        printerName: p.name ?? "",
        printerDescription: p.description ?? "",
        hostOrIp: p.host ?? "",
        port: p.port ?? "",
        printerQueue: p.queue ?? "",
        timeout: String(p.timeout ?? 30),
      });
    });
  }, [id]);

  const handleSubmit = async () => {
    if (!validate() || !id) return;
    try {
      await updatePrinter(Number(id), {
        name: formData.printerName,
        description: formData.printerDescription,
        host: formData.hostOrIp,
        port: formData.port,
        queue: formData.printerQueue,
        timeout: Number(formData.timeout) || 30,
      });
      enqueueSnackbar("Printer updated.", { variant: "success" });
      navigate("/setup/miscellaneous/printers");
    } catch {
      enqueueSnackbar("Failed to update printer.", { variant: "error" });
    }
  };

  return (
    <FormPageLayout>
      <Paper
        sx={{
          p: 3,
          maxWidth: "600px",
          width: "100%",
          boxShadow: 2,
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}
        >
          Update Printer
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Printer Name"
            name="printerName"
            size="small"
            fullWidth
            value={formData.printerName}
            onChange={handleInputChange}
            error={!!errors.printerName}
            helperText={errors.printerName}
          />

          <TextField
            label="Printer Description"
            name="printerDescription"
            size="small"
            fullWidth
            value={formData.printerDescription}
            onChange={handleInputChange}
            error={!!errors.printerDescription}
            helperText={errors.printerDescription}
          />

          <TextField
            label="Host Name or IP"
            name="hostOrIp"
            size="small"
            fullWidth
            value={formData.hostOrIp}
            onChange={handleInputChange}
            error={!!errors.hostOrIp}
            helperText={errors.hostOrIp}
          />

          <TextField
            label="Port"
            name="port"
            size="small"
            fullWidth
            value={formData.port}
            onChange={handleInputChange}
            error={!!errors.port}
            helperText={errors.port}
          />

          <TextField
            label="Printer Queue"
            name="printerQueue"
            size="small"
            fullWidth
            value={formData.printerQueue}
            onChange={handleInputChange}
            error={!!errors.printerQueue}
            helperText={errors.printerQueue}
          />

          <TextField
            label="Timeout"
            name="timeout"
            size="small"
            fullWidth
            value={formData.timeout}
            onChange={handleInputChange}
            error={!!errors.timeout}
            helperText={errors.timeout}
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
          <Button onClick={() => window.history.back()}>Back</Button>

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
    </FormPageLayout>
  );
}
