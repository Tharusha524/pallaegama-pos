import React from "react";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SearchIcon from "@mui/icons-material/Search";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import BalanceIcon from "@mui/icons-material/Balance";
import AssessmentIcon from "@mui/icons-material/Assessment";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useNavigate } from "react-router";
import ModuleHubLayout, { type ModuleHubItem } from "../../../components/ModuleHubLayout";

const ITEMS: ModuleHubItem[] = [
  // { text: "JOURNAL INQUIRY", icon: <MenuBookIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/inquiriesandreports/journal-inquiry" }, // hidden
  // { text: "GL INQUIRY", icon: <SearchIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/inquiriesandreports/gl-inquiry" }, // hidden
  // { text: "BANK ACCOUNT INQUIRY", icon: <AccountBalanceIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/inquiriesandreports/bank-account-inquiry" }, // hidden
  // { text: "TAX INQUIRY", icon: <ReceiptLongIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/inquiriesandreports/tax-inquiry" }, // hidden
  // { text: "TRIAL BALANCE", icon: <BalanceIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/inquiriesandreports/trial-balance" }, // hidden
  // { text: "BALANCE SHEET DRILLDOWN", icon: <AssessmentIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/inquiriesandreports/balance-sheet-drilldown" }, // hidden
  // { text: "PROFIT AND LOSS DRILLDOWN", icon: <TrendingUpIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/bankingandgeneralledger/inquiriesandreports/profit-and-loss-drilldown" }, // hidden
  // { text: "BANKING REPORTS", icon: <AssessmentIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/reports", description: "Banking and payment reports" }, // hidden
  { text: "GENERAL LEDGER REPORTS", icon: <BalanceIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/reports", description: "GL and financial statement reports" },
];

export default function BankingInquiriesAndReports() {
  const navigate = useNavigate();
  return (
    <ModuleHubLayout
      hubKey="banking:inquiries"
      items={ITEMS}
      onItemClick={(item) => {
        if (item.text === "BANKING REPORTS") {
          navigate("/reports", { state: { selectedClass: "Banking" } });
        } else if (item.text === "GENERAL LEDGER REPORTS") {
          navigate("/reports", { state: { selectedClass: "GeneralLedger" } });
        } else {
          navigate(item.path);
        }
      }}
    />
  );
}
