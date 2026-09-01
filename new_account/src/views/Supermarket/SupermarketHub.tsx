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
import InventoryIcon from "@mui/icons-material/Inventory";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import ReceiptIcon from "@mui/icons-material/Receipt";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import GroupsIcon from "@mui/icons-material/Groups";
import StyleIcon from "@mui/icons-material/Style";
import BuildIcon from "@mui/icons-material/Build";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import AssessmentIcon from "@mui/icons-material/Assessment";

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
  { title: "Stock Adjustments", description: "Add, reduce, or override stock with a reason", href: "/supermarket/stock-adjustments", icon: <InventoryIcon />, color: "#6d4c41" },
  { title: "Stock Transfers", description: "Move stock between branches", href: "/supermarket/stock-transfers", icon: <SwapHorizIcon />, color: "#5e35b1" },
  { title: "Inventory Audits", description: "Physical stock counts & reconciliation", href: "/supermarket/inventory-audits", icon: <FactCheckIcon />, color: "#00695c" },
  { title: "Offline Sales & Purchases", description: "Log transactions made outside the system", href: "/supermarket/offline-entries", icon: <ReceiptIcon />, color: "#8d6e63" },
  { title: "Warranty", description: "Track warranties, check status, manage claims", href: "/supermarket/warranty", icon: <VerifiedUserIcon />, color: "#0277bd" },
  { title: "Vouchers", description: "Issue and redeem gift vouchers", href: "/supermarket/vouchers", icon: <CardGiftcardIcon />, color: "#ad1457" },
  { title: "Customer Segments", description: "RFM segmentation — Champion, At Risk, Dormant", href: "/supermarket/customer-segments", icon: <GroupsIcon />, color: "#283593" },
  { title: "Product Variants", description: "Size/color/weight combos with own barcodes", href: "/supermarket/product-variants", icon: <StyleIcon />, color: "#00838f" },
  { title: "Service Tickets", description: "Repair/service job tracking board", href: "/supermarket/service-tickets", icon: <BuildIcon />, color: "#f57f17" },
  { title: "POS Settings", description: "Configure POS behavior & receipt layout", href: "/supermarket/pos-settings", icon: <SettingsSuggestIcon />, color: "#546e7a" },
  { title: "Reports", description: "Velocity, dead stock, profit margin, activity feed, valuation", href: "/supermarket/reports", icon: <AssessmentIcon />, color: "#37474f" },
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
