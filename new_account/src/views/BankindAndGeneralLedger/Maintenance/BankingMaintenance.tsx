import React from "react";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ClassIcon from "@mui/icons-material/Class";
import LockIcon from "@mui/icons-material/Lock";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import { useNavigate } from "react-router";
import ModuleHubLayout, { type ModuleHubItem } from "../../../components/ModuleHubLayout";

const ITEMS: ModuleHubItem[] = [
  { text: "BANK ACCOUNTS", icon: <AccountBalanceIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/maintenance/bank-accounts" },
  { text: "QUICK ENTRIES", icon: <FlashOnIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/maintenance/quick-entries" },
  { text: "ACCOUNT TAGS", icon: <LocalOfferIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/maintenance/account-tags" },
  { text: "CURRENCIES", icon: <CurrencyExchangeIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/maintenance/currencies" },
  { text: "EXCHANGE RATES", icon: <TrendingUpIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/maintenance/exchange-rates" },
  { text: "GL ACCOUNTS", icon: <AccountTreeIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/maintenance/gl-accounts" },
  { text: "GL ACCOUNT GROUPS", icon: <ClassIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/maintenance/gl-account-groups" },
  { text: "ACCOUNT TYPES (GL)", icon: <ClassIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/maintenance/gl-types" },
  { text: "GL ACCOUNT CLASSES", icon: <ClassIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/maintenance/gl-account-classes" },
  { text: "CLASS TYPES", icon: <ClassIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/maintenance/class-types" },
  { text: "CLOSING GL TRANSACTIONS", icon: <LockIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/maintenance/closing-gl-transactions" },
  { text: "REVALUATION OF CURRENCY ACCOUNTS", icon: <AutorenewIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/maintenance/revaluation-of-currency-accounts" },
];

export default function BankingMaintenance() {
  const navigate = useNavigate();
  return (
    <ModuleHubLayout
      hubKey="banking:maintenance"
      items={ITEMS}
      onItemClick={(item) => navigate(item.path)}
    />
  );
}
