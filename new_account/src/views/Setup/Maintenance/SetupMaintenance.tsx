import React from "react";
import BlockIcon from "@mui/icons-material/Block";
import PrintIcon from "@mui/icons-material/Print";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import BackupIcon from "@mui/icons-material/Backup";
import LoginIcon from "@mui/icons-material/Login";
import CollectionsIcon from "@mui/icons-material/Collections";
import { useNavigate } from "react-router";
import ModuleHubLayout, { type ModuleHubItem } from "../../../components/ModuleHubLayout";

const ITEMS: ModuleHubItem[] = [
  // { text: "VOID A TRANSACTION", icon: <BlockIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/maintenance/void-a-transaction" }, // hidden
  // { text: "VIEW OR PRINT TRANSACTION", icon: <PrintIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/maintenance/view-or-print-transaction" }, // hidden
  // { text: "ATTACH DOCUMENTS", icon: <AttachFileIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/maintenance/attach-documents" }, // hidden
  // { text: "SYSTEM DIAGNOSTICS", icon: <HealthAndSafetyIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/maintenance/system-diagnostics" }, // hidden
  { text: "BACKUP AND RESTORE", icon: <BackupIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/maintenance/backup-and-restore" },
  { text: "USER LOGIN ACTIVITY", icon: <LoginIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/maintenance/user-login-logs" },
  { text: "SLIDESHOW IMAGES", icon: <CollectionsIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/maintenance/slideshow-images" },
];

export default function SetupMaintenance() {
  const navigate = useNavigate();
  return (
    <ModuleHubLayout
      hubKey="setup:maintenance"
      items={ITEMS}
      onItemClick={(item) => navigate(item.path)}
    />
  );
}
