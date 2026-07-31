import React from "react";
import { Stack, Grid } from "@mui/material";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import PriceChangeIcon from "@mui/icons-material/PriceChange";
import { useNavigate } from "react-router";
import DashboardCard from "../../../components/DashboardCard";
import { useAuth } from "../../../context/AuthContext";
import { getPermissionIdForPath } from "../../../permissions/navigationTree";

function ItemsPricingAndCosts() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const allItems = [
    {
      text: "SALES PRICING",
      change: +36,
      icon: <RequestQuoteIcon sx={{ fontSize: 40, color: "#1976d2" }} />,
      path: "/itemsandinventory/pricingandcosts/sales-pricing",
    },
    {
      text: "PURCHASING PRICING",
      change: -14,
      icon: <ShoppingCartIcon sx={{ fontSize: 40, color: "#1976d2" }} />,
      path: "/itemsandinventory/pricingandcosts/purchasing-pricing",
    },
    {
      text: "STANDARD COSTS",
      change: +36,
      icon: <PriceChangeIcon sx={{ fontSize: 40, color: "#1976d2" }} />,
      path: "/itemsandinventory/pricingandcosts/standard-costs",
    },
  ];

  const visibleItems = allItems.filter((item) => {
    const requiredId = getPermissionIdForPath(item.path);
    return requiredId === undefined || hasPermission(requiredId);
  });

  const handleItemClick = (path: string, text: string) => {
    if (path) {
      navigate(path);
    } else {
      console.log(`Clicked: ${text} (No route defined)`);
    }
  };

  return (
    <Stack sx={{ minHeight: "100vh", backgroundColor: "#f0f0f0", p: 3 }}>
      <Grid container spacing={2}>
        {visibleItems.map((item, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <DashboardCard
              text={item.text}
              icon={item.icon}
              change={item.change}
              onClick={() => handleItemClick(item.path, item.text)}
            />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

export default ItemsPricingAndCosts;
