import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState } from "react";
import {
  Box,
  Button,
  Stack,
  Typography,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListSubheader,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router";
import { useLocation } from "react-router-dom";
import { getItems, getItemById } from "../../../../api/Item/ItemApi";
import { getItemCategories } from "../../../../api/ItemCategories/ItemCategoriesApi";
import { getItemTypes } from "../../../../api/ItemType/ItemType";
import { useQuery } from "@tanstack/react-query";

// Import item-specific components
import ItemGeneralSettingsForm from "./ItemsGeneralSettings/ItemsGeneralSettingsForm";
import UpdateItemGeneralSettingsForm from "./ItemsGeneralSettings/UpdateItemsGeneralSettingsForm";
import SalesPricingTable from "./SalesPricing/SalesPricingTable";
import PurchasingPricingTable from "./PurchasingPricing/PurchasingPricingTable";
import AddStandardCostForm from "./StandardCosts/AddStandardCostForm";
import ReOrderLevelsForm from "./ReOrderLevels/ReOrderLevelsForm";
import ItemTransactionsTable from "./Transactions/ItemTransactionsTable";
import StatusTable from "./Status/StatusTable";
import ItemAttachmentsTable from "./Attachments/ItemAttachmentsTable";

// TabPanel helper
function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return <div hidden={value !== index}>{value === index && <Box sx={{ mt: 2 }}>{children}</Box>}</div>;
}

const Items = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tabValue, setTabValue] = useState(location.state?.tab || 0);

  // Item dropdown state
  const [selectedItem, setSelectedItem] = useState<string | number>(location.state?.selectedItem || "new");
  const [showInactive, setShowInactive] = useState(false);

  // Fetch items using React Query
  const { data: items = [] } = useQuery<{ stock_id: string | number; category_id: string | number; description: string; inactive: number }[]>({
    queryKey: ["items"],
    queryFn: () => getItems() as Promise<{ stock_id: string | number; category_id: string | number; description: string; inactive: number }[]>,
  });

  // Fetch categories using React Query
  const { data: categories = [] } = useQuery<{ category_id: number; description: string }[]>({
    queryKey: ["itemCategories"],
    queryFn: () => getItemCategories() as Promise<{ category_id: number; description: string }[]>,
  });

  // Fetch selected item data
  const { data: selectedItemData } = useQuery({
    queryKey: ["item", selectedItem],
    queryFn: () => getItemById(selectedItem),
    enabled: selectedItem !== "new",
  });

  // Fetch item types
  const { data: itemTypes = [] } = useQuery({
    queryKey: ["itemTypes"],
    queryFn: getItemTypes,
  });

  // Determine if selected item is service
  const selectedItemType = itemTypes.find((t) => t.id === selectedItemData?.mb_flag);
  const isService = selectedItemType?.name?.toLowerCase() === "service";

  // Tab change handler
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Item select handler
  const handleItemChange = (value: string | number) => {
    setSelectedItem(value);
  };

  return (
    <FormPageLayout>
      {/* Header + Dropdown + Back */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: "bold" }}>
          Manage Items
        </Typography>

        {/* Item dropdown and checkbox */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <FormControl sx={{ minWidth: 250 }}>
            <InputLabel>Select Item</InputLabel>
            <Select
              value={selectedItem}
              label="Select Item"
              onChange={(e) => handleItemChange(e.target.value)}
            >
              <MenuItem value="new" key="new">
                + Add New Item
              </MenuItem>

              {/* Group items by category_id */}
              {(() => {
                const filteredItems = items.filter(item => showInactive || item.inactive !== 1);
                return Object.entries(
                  filteredItems.reduce((groups, item) => {
                    const catId = item.category_id || "Uncategorized";
                    if (!groups[catId]) groups[catId] = [];
                    groups[catId].push(item);
                    return groups;
                  }, {} as Record<string, typeof filteredItems>)
                ).map(([categoryId, groupedItems]) => {
                  const category = categories.find(cat => cat.category_id === Number(categoryId));
                  const categoryLabel = category ? category.description : `Category ${categoryId}`;
                  return [
                    <ListSubheader key={`cat-${categoryId}`}>
                      {categoryLabel}
                    </ListSubheader>,
                    groupedItems.map((item) => (
                      <MenuItem key={item.stock_id} value={item.stock_id}>
                        {item.description}
                      </MenuItem>
                    ))
                  ];
                });
              })()}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
            }
            label="Show Inactive Items"
          />
        </Stack>

        {/* Back Button */}
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/itemsandinventory/maintenance")}
        >
          Back
        </Button>
      </Box>
      {/* Tabs */}
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        textColor="primary"
        indicatorColor="primary"
        sx={{ bgcolor: "background.paper", borderRadius: 1 }}
      >
        <Tab label="General Settings" />
        <Tab label="Sales Pricing" disabled={selectedItem === "new"} />
        <Tab label="Purchasing Pricing" disabled={selectedItem === "new"} />
        <Tab label="Standard Costs" disabled={selectedItem === "new" || isService} />
        <Tab label="Reorder Levels" disabled={selectedItem === "new" || isService} />
        <Tab label="Transactions" disabled={selectedItem === "new" || isService} />
        <Tab label="Status" disabled={selectedItem === "new"} />
        <Tab label="Attachments" disabled={selectedItem === "new"} />
      </Tabs>
      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        {selectedItem === "new" ? (
          <ItemGeneralSettingsForm/>
        ) : (
          <UpdateItemGeneralSettingsForm itemId={selectedItem} />
        )}
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        {selectedItem !== "new" && <SalesPricingTable itemId={selectedItem} />}
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        {selectedItem !== "new" && <PurchasingPricingTable itemId={selectedItem} />}
      </TabPanel>
      <TabPanel value={tabValue} index={3}>
        {selectedItem !== "new" && !isService && <AddStandardCostForm itemId={selectedItem} />}
      </TabPanel>
      <TabPanel value={tabValue} index={4}>
        {selectedItem !== "new" && !isService && <ReOrderLevelsForm itemId={selectedItem} />}
      </TabPanel>
      <TabPanel value={tabValue} index={5}>
        {selectedItem !== "new" && <ItemTransactionsTable itemId={selectedItem} />}
      </TabPanel>
      <TabPanel value={tabValue} index={6}>
        {selectedItem !== "new" && <StatusTable itemId={selectedItem} />}
      </TabPanel>
      <TabPanel value={tabValue} index={7}>
        {selectedItem !== "new" && <ItemAttachmentsTable itemId={selectedItem} />}
      </TabPanel>
    </FormPageLayout>
  );
};

export default Items;
