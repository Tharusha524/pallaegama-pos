import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import PageTitle from "../../../../components/PageTitle";
import Breadcrumb from "../../../../components/BreadCrumb";
import {
  getMailSettings,
  sendMailSettingsTest,
  updateMailSettings,
  type MailSettings,
} from "../../../../api/MailSettings/MailSettingsApi";
import FormattedNumberField from "../../../../components/FormattedNumberField";
import { useAuth } from "../../../../context/AuthContext";

type ProviderPreset = "gmail" | "outlook" | "custom";

const PRESETS: Record<Exclude<ProviderPreset, "custom">, Pick<MailSettings, "mailHost" | "mailPort" | "mailScheme">> = {
  gmail: { mailHost: "smtp.gmail.com", mailPort: 587, mailScheme: "tls" },
  outlook: { mailHost: "smtp.office365.com", mailPort: 587, mailScheme: "tls" },
};

export default function EmailSetupForm() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Email setup page');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [provider, setProvider] = useState<ProviderPreset>("gmail");
  const [mailEnabled, setMailEnabled] = useState(false);
  const [mailHost, setMailHost] = useState("");
  const [mailPort, setMailPort] = useState(587);
  const [mailScheme, setMailScheme] = useState("tls");
  const [mailUsername, setMailUsername] = useState("");
  const [mailPassword, setMailPassword] = useState("");
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [mailFromAddress, setMailFromAddress] = useState("");
  const [mailFromName, setMailFromName] = useState("");
  const [testTo, setTestTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["mailSettings"],
    queryFn: getMailSettings,
  });

  useEffect(() => {
    if (!data) return;
    setMailEnabled(data.mailEnabled);
    setMailHost(data.mailHost);
    setMailPort(data.mailPort);
    setMailScheme(data.mailScheme || "tls");
    setMailUsername(data.mailUsername);
    setPasswordConfigured(data.passwordConfigured);
    setMailFromAddress(data.mailFromAddress);
    setMailFromName(data.mailFromName);
    setTestTo(data.mailFromAddress || data.mailUsername);

    if (data.mailHost === PRESETS.gmail.mailHost) {
      setProvider("gmail");
    } else if (data.mailHost === PRESETS.outlook.mailHost) {
      setProvider("outlook");
    } else if (data.mailHost) {
      setProvider("custom");
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: updateMailSettings,
    onSuccess: (result) => {
      queryClient.setQueryData(["mailSettings"], result.settings);
      setPasswordConfigured(result.settings.passwordConfigured);
      setMailPassword("");
      enqueueSnackbar(result.message, { variant: "success" });
    },
    onError: (error: { data?: { message?: string } }) => {
      enqueueSnackbar(error?.data?.message || "Could not save email settings", { variant: "error" });
    },
  });

  const testMutation = useMutation({
    mutationFn: sendMailSettingsTest,
    onSuccess: (result) => {
      enqueueSnackbar(result.message, { variant: "success" });
    },
    onError: (error: { data?: { message?: string } }) => {
      enqueueSnackbar(error?.data?.message || "Test email failed", { variant: "error" });
    },
  });

  const handleProviderChange = (value: ProviderPreset) => {
    setProvider(value);
    if (value !== "custom") {
      const preset = PRESETS[value];
      setMailHost(preset.mailHost);
      setMailPort(preset.mailPort);
      setMailScheme(preset.mailScheme);
    }
  };

  const handleSave = () => {
    saveMutation.mutate({
      mailEnabled,
      mailHost,
      mailPort,
      mailScheme,
      mailUsername,
      ...(mailPassword ? { mailPassword } : {}),
      mailFromAddress,
      mailFromName,
    });
  };

  const breadcrumbs = [
    { title: "Setup", href: "/setup" },
    { title: "Company Setup", href: "/setup/companysetup" },
    { title: "Email Setup" },
  ];

  return (
    <FormPageLayout>
      <Box>
        <PageTitle title="Email Setup" />
        <Breadcrumb breadcrumbs={breadcrumbs} />
      </Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Configure outgoing email for invoices, receipts, and other PDF documents. Settings are
          stored in the database — no server file editing required.
        </Typography>

        <Stack spacing={2.5}>
          <FormControlLabel
            control={
              <Checkbox
                checked={mailEnabled}
                onChange={(e) => setMailEnabled(e.target.checked)}
              />
            }
            label="Enable outgoing email (SMTP)"
          />

          <FormControl fullWidth disabled={!mailEnabled}>
            <InputLabel>Email provider</InputLabel>
            <Select
              label="Email provider"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as ProviderPreset)}
            >
              <MenuItem value="gmail">Gmail</MenuItem>
              <MenuItem value="outlook">Microsoft 365 / Outlook</MenuItem>
              <MenuItem value="custom">Custom SMTP</MenuItem>
            </Select>
          </FormControl>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="SMTP host"
              value={mailHost}
              onChange={(e) => setMailHost(e.target.value)}
              disabled={!mailEnabled}
              fullWidth
            />
            <FormattedNumberField
              label="Port"
              value={mailPort}
              onChange={(e) => setMailPort(Number(e.target.value) || 587)}
              disabled={!mailEnabled}
              sx={{ minWidth: 120 }}
            />
            <FormControl sx={{ minWidth: 140 }} disabled={!mailEnabled}>
              <InputLabel>Encryption</InputLabel>
              <Select
                label="Encryption"
                value={mailScheme}
                onChange={(e) => setMailScheme(e.target.value)}
              >
                <MenuItem value="tls">TLS</MenuItem>
                <MenuItem value="ssl">SSL</MenuItem>
                <MenuItem value="">None</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <TextField
            label="SMTP username / email"
            value={mailUsername}
            onChange={(e) => setMailUsername(e.target.value)}
            disabled={!mailEnabled}
            fullWidth
          />

          <TextField
            label="SMTP password"
            type="password"
            value={mailPassword}
            onChange={(e) => setMailPassword(e.target.value)}
            disabled={!mailEnabled}
            placeholder={passwordConfigured ? "Leave blank to keep current password" : "Required"}
            helperText={
              provider === "gmail"
                ? "Gmail requires an App Password (not your normal login password)."
                : undefined
            }
            fullWidth
          />

          <Divider />

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="From email address"
              type="email"
              value={mailFromAddress}
              onChange={(e) => setMailFromAddress(e.target.value)}
              disabled={!mailEnabled}
              fullWidth
            />
            <TextField
              label="From name"
              value={mailFromName}
              onChange={(e) => setMailFromName(e.target.value)}
              disabled={!mailEnabled}
              fullWidth
            />
          </Stack>

          <Divider />

          <Typography variant="subtitle2">Test configuration</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Save settings before sending a test email.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
            <TextField
              label="Send test email to"
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              disabled={!mailEnabled}
              fullWidth
            />
            <Button
              variant="outlined"
              startIcon={<SendIcon />}
              disabled={!mailEnabled || !testTo.trim() || testMutation.isPending}
              onClick={() => testMutation.mutate(testTo.trim())}
            >
              Send test
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 3 }} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/setup/companysetup")}
          >
            Back
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={isLoading || saveMutation.isPending || !canEdit}
            onClick={handleSave}
          >
            Save settings
          </Button>
        </Stack>
      </Paper>
    </FormPageLayout>
  );
}
