import React, { useMemo } from "react";
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
} from "@mui/material";
import { formatItemLabel } from "../utils/formatItemLabel";
import ItemAutocomplete from "./ItemAutocomplete";
import { searchItems } from "../utils/itemSearch";

export interface ItemSearchOption {
  stock_id: string;
  description: string;
  category_id?: number | string;
  category_name?: string;
  units?: number | string;
  inactive?: boolean | number;
}

interface ItemSearchSelectProps {
  label?: string;
  /** Which field to show in the input after selection */
  displayField?: "description" | "code";
  /** Hide the floating label (for table cells) */
  hideLabel?: boolean;
  /** Display fallback — description text */
  value?: string;
  /** Preferred key for matching the selected row */
  selectedStockId?: string;
  items: ItemSearchOption[];
  categories?: Array<{ id?: number | string; category_name?: string; name?: string }>;
  onSelect: (item: ItemSearchOption | null) => void;
  size?: "small" | "medium";
  fullWidth?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Include inactive items (default: active only) */
  includeInactive?: boolean;
  /** Grey out options that cannot be selected (still visible for training) */
  isOptionDisabled?: (item: ItemSearchOption) => boolean;
  /** Shown under greyed-out options */
  getOptionDisabledHint?: (item: ItemSearchOption) => string | undefined;
}

function categoryLabel(
  item: ItemSearchOption,
  categories: ItemSearchSelectProps["categories"]
): string {
  if (item.category_name) return item.category_name;
  const cat = (categories ?? []).find(
    (c) => String(c.id) === String(item.category_id)
  );
  return cat?.category_name ?? cat?.name ?? "Other";
}

function isActiveItem(item: ItemSearchOption): boolean {
  const inactive = item.inactive;
  if (inactive === true || inactive === 1) return false;
  if (typeof inactive === "string" && inactive === "1") return false;
  return String(item.stock_id ?? "").trim() !== "";
}

type ItemOption = ItemSearchOption & {
  _category: string;
  _label: string;
};

function getOptionLabel(option: ItemOption, displayField: "code" | "description") {
  return displayField === "code" ? option.stock_id : option._label;
}

/**
 * Searchable item picker — filter by description or item code (stock_id).
 * Renders in a portal so dropdown is not clipped inside tables.
 */
export default function ItemSearchSelect({
  label = "Description",
  displayField = "description",
  hideLabel = false,
  value = "",
  selectedStockId = "",
  items,
  categories = [],
  onSelect,
  size = "small",
  fullWidth = true,
  disabled = false,
  placeholder,
  includeInactive = false,
  isOptionDisabled,
  getOptionDisabledHint,
}: ItemSearchSelectProps) {
  const inputPlaceholder =
    placeholder ??
    (displayField === "code"
      ? "Search item code…"
      : "Search item code or description…");
  const inputLabel =
    hideLabel ? undefined : displayField === "code" ? "Item Code" : label;

  const options = useMemo(() => {
    const seen = new Set<string>();
    const list = (items ?? [])
      .filter((item) => includeInactive || isActiveItem(item))
      .map((item) => {
        const stockId = String(item.stock_id ?? "").trim();
        const description = String(item.description ?? stockId).trim();
        return {
          ...item,
          stock_id: stockId,
          description,
          _category: categoryLabel(item, categories),
          _label: formatItemLabel({ stock_id: stockId, description }),
        };
      })
      .filter((item) => {
        if (seen.has(item.stock_id)) return false;
        seen.add(item.stock_id);
        return true;
      });

    return list.sort((a, b) => {
      const g = a._category.localeCompare(b._category);
      if (g !== 0) return g;
      return a.description.localeCompare(b.description);
    });
  }, [items, categories, includeInactive]);

  const selected = useMemo(() => {
    const stockKey = String(selectedStockId ?? "").trim();
    if (stockKey) {
      const byStock = options.find((o) => o.stock_id === stockKey);
      if (byStock) return byStock;
    }
    const desc = String(value ?? "").trim();
    if (!desc) return null;
    return (
      options.find(
        (o) =>
          o.description === desc ||
          o.stock_id === desc ||
          o._label === desc
      ) ?? null
    );
  }, [options, selectedStockId, value]);

  return (
    <ItemAutocomplete
      fullWidth={fullWidth}
      size={size}
      disabled={disabled}
      options={options}
      value={selected}
      openOnFocus
      autoHighlight
      disablePortal={false}
      getOptionLabel={(option) => getOptionLabel(option, displayField)}
      isOptionEqualToValue={(a, b) => a.stock_id === b.stock_id}
      getOptionDisabled={
        isOptionDisabled
          ? (option) => isOptionDisabled(option)
          : undefined
      }
      onChange={(_: any, option: ItemOption | null) => {
        if (option && isOptionDisabled?.(option)) {
          return;
        }
        onSelect(option);
      }}
      // POS checkout search (code first, Singlish, close Sinhala spellings),
      // plus a category-name match; barcode scan + Enter picks the item.
      filterOptions={(opts: ItemOption[], { inputValue }: { inputValue: string }) => {
        const q = inputValue.trim().toLowerCase();
        if (!q) return opts;
        const found = searchItems(opts, inputValue);
        const seen = new Set(found);
        return [...found, ...opts.filter((o) => !seen.has(o) && o._category.toLowerCase().includes(q))];
      }}
      slotProps={{
        popper: {
          placement: "bottom-start",
          sx: { zIndex: 1500 },
          modifiers: [{ name: "flip", enabled: true }],
        },
        paper: {
          sx: { minWidth: 300 },
        },
        listbox: {
          sx: {
            maxHeight: 420,
            "& .MuiAutocomplete-option": {
              alignItems: "flex-start",
              py: 1,
            },
          },
        },
      }}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        const blocked = isOptionDisabled?.(option) ?? false;
        const hint = blocked ? getOptionDisabledHint?.(option) : undefined;
        return (
          <Box
            component="li"
            key={option.stock_id}
            {...rest}
            sx={{ opacity: blocked ? 0.55 : 1 }}
          >
            <Box sx={{ width: "100%" }}>
              <Typography variant="body2" sx={{ lineHeight: 1.3 }}>
                {option._label}
              </Typography>
              <Typography variant="caption" color={blocked ? "warning.main" : "text.secondary"}>
                {[option._category, hint].filter(Boolean).join(" · ")}
              </Typography>
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={inputLabel}
          placeholder={inputPlaceholder}
        />
      )}
    />
  );
}
