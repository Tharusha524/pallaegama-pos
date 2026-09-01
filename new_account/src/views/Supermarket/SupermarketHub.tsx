import { Box, Card, Grid, ListItemButton, ListItemIcon, ListItemText, Typography, alpha } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { FormPageLayout } from "../../components/Layout/FormPageLayout";
import PageTitle from "../../components/PageTitle";
import Breadcrumb from "../../components/BreadCrumb";
import LoyaltyIcon from "@mui/icons-material/Loyalty";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import CampaignIcon from "@mui/icons-material/Campaign";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import InsightsIcon from "@mui/icons-material/Insights";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";

const cards = [
  { title: "POS Checkout", description: "Cashier till — scan, cart, and complete a sale", href: "/supermarket/pos-checkout", icon: <PointOfSaleOutlinedIcon />, color: "#024271" },
  { title: "Sales Analytics", description: "Best/slow sellers, trends, top customers", href: "/supermarket/sales-analytics", icon: <InsightsIcon />, color: "#024271" },
  { title: "Low Stock Alerts", description: "Items at or below reorder level", href: "/supermarket/low-stock", icon: <WarningAmberIcon />, color: "#f59e0b" },
  { title: "Loyalty Tiers", description: "Configure earn/redeem rates & benefits", href: "/supermarket/loyalty-tiers", icon: <LoyaltyIcon />, color: "#7b1fa2" },
  { title: "Loyalty Cards", description: "Issue and manage customer loyalty cards", href: "/supermarket/loyalty-cards", icon: <CardMembershipIcon />, color: "#2e7d32" },
  { title: "Offers & Discounts", description: "Product, category, tier & customer offers", href: "/supermarket/offers", icon: <LocalOfferIcon />, color: "#c62828" },
  { title: "Win-Back Campaigns", description: "Re-engage inactive customers via SMS/WhatsApp", href: "/supermarket/win-back", icon: <CampaignIcon />, color: "#00838f" },
  { title: "Stock Damage", description: "Record and review damaged stock", href: "/supermarket/stock-damage", icon: <ReportProblemIcon />, color: "#ed6c02" },
  { title: "POS Shifts", description: "Open/close cashier tills & cash-up", href: "/supermarket/pos-shifts", icon: <PointOfSaleIcon />, color: "#1976d2" },
];

export default function SupermarketHub() {
  const navigate = useNavigate();
  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Smart Supermarket" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket" }]} />
      </Box>
      <Grid container spacing={2}>
        {cards.map((c) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={c.title}>
            <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
              <ListItemButton onClick={() => navigate(c.href)} sx={{ p: 2.5, borderRadius: 3 }}>
                <ListItemIcon sx={{ minWidth: 48 }}>
                  <Box
                    sx={{
                      width: 44, height: 44, borderRadius: 2, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      bgcolor: alpha(c.color, 0.1), color: c.color,
                    }}
                  >
                    {c.icon}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="subtitle2" fontWeight={700}>{c.title}</Typography>}
                  secondary={<Typography variant="caption" color="text.secondary">{c.description}</Typography>}
                />
              </ListItemButton>
            </Card>
          </Grid>
        ))}
      </Grid>
    </FormPageLayout>
  );
}
