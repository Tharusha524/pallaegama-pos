import React from "react";
import PaymentIcon from "@mui/icons-material/Payment";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import ContactsIcon from "@mui/icons-material/Contacts";
import { useNavigate } from "react-router";
import ModuleHubLayout, { type ModuleHubItem } from "../../../components/ModuleHubLayout";

const ITEMS: ModuleHubItem[] = [
  { text: "PAYMENT TERMS", icon: <PaymentIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/miscellaneous/payment-terms" },
  // { text: "SHIPPING COMPANY", icon: <LocalShippingIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/miscellaneous/shipping-company" }, // hidden
  // { text: "POINT OF SALE", icon: <PointOfSaleIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/miscellaneous/point-of-sale" }, // hidden
  // { text: "CONTACT CATEGORIES", icon: <ContactsIcon sx={{ fontSize: 40, color: "#1976d2" }} />, path: "/setup/miscellaneous/contact-categories" }, // hidden
];

export default function Miscellaneous() {
  const navigate = useNavigate();
  return (
    <ModuleHubLayout
      hubKey="setup:miscellaneous"
      items={ITEMS}
      onItemClick={(item) => navigate(item.path)}
    />
  );
}
