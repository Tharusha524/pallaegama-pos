import React from "react";
import BusinessIcon from "@mui/icons-material/Business";
import ApartmentIcon from "@mui/icons-material/Apartment";
import PeopleIcon from "@mui/icons-material/People";
import SecurityIcon from "@mui/icons-material/Security";
import TagIcon from "@mui/icons-material/Tag";
import PercentIcon from "@mui/icons-material/Percent";
import CategoryIcon from "@mui/icons-material/Category";
import InventoryIcon from "@mui/icons-material/Inventory";
import SettingsIcon from "@mui/icons-material/Settings";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import LoginIcon from "@mui/icons-material/Login";
import EmailIcon from "@mui/icons-material/Email";
import VpnLockIcon from "@mui/icons-material/VpnLock";
import { useNavigate } from "react-router";
import ModuleHubLayout, { type ModuleHubItem } from "../../../components/ModuleHubLayout";

const ITEMS: ModuleHubItem[] = [
  { text: "COMPANY SETUP", icon: <BusinessIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/companysetup/company-setup" },
  { text: "USER ACCOUNT SETUP", icon: <PeopleIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/companysetup/user-account-setup" },
  { text: "ACCESS SETUP", icon: <SecurityIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/companysetup/access-setup" },
  // { text: "DEPARTMENT SETUP", icon: <ApartmentIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/companysetup/department-setup" }, // hidden
  // { text: "TRANSACTION REFERENCES", icon: <TagIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/companysetup/transaction-references" }, // hidden
  // { text: "TAXES", icon: <PercentIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/companysetup/taxes" }, // hidden
  // { text: "TAX GROUPS", icon: <CategoryIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/companysetup/tax-groups" }, // hidden
  // { text: "ITEM TAX TYPES", icon: <InventoryIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/companysetup/item-tax-types" }, // hidden
  // { text: "SYSTEM AND GENERAL GL SETUP", icon: <SettingsIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/companysetup/system-and-general-gl-setup" }, // hidden
  // { text: "EMAIL SETUP", icon: <EmailIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/companysetup/email-setup" }, // hidden
  // { text: "LOGIN IP RESTRICTION", icon: <VpnLockIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/companysetup/login-ip-restriction" }, // hidden
  { text: "FISCAL YEARS", icon: <CalendarMonthIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/companysetup/fiscal-years" },
  { text: "USER LOGIN ACTIVITY", icon: <LoginIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/companysetup/user-login-activity" },
];

export default function CompanySetup() {
  const navigate = useNavigate();
  return (
    <ModuleHubLayout
      hubKey="setup:companysetup"
      items={ITEMS}
      onItemClick={(item) => navigate(item.path)}
    />
  );
}
