import { useState } from "react";
import { Autocomplete } from "@mui/material";
import { searchItems, looksLikeCode, findItemsByCode, defaultCodeOf, defaultTextOf, type ItemCodeOf, type ItemTextOf } from "../utils/itemSearch";
import { notify } from "../services/notificationService";

/**
 * Drop-in replacement for MUI <Autocomplete> on item (product) search boxes.
 * Adds the POS checkout search: item code first, Singlish / close Sinhala
 * spellings, and barcode scan in the same box — scan (or type the code) and
 * press Enter to pick the item. A barcode shared by several products opens
 * the list with just those products.
 */
export default function ItemAutocomplete(props: any & { codeOf?: ItemCodeOf; textOf?: ItemTextOf }) {
  const { codeOf = defaultCodeOf, textOf = defaultTextOf, renderInput, filterOptions, open, onOpen, onClose, onInputChange, ...rest } = props;
  const [codeMatches, setCodeMatches] = useState<any[] | null>(null);
  // Always a controlled list, so a shared barcode can open it with its products.
  const [localOpen, setLocalOpen] = useState(false);
  const isOpen = codeMatches ? true : open !== undefined ? open : localOpen;
  const options: any[] = Array.isArray(props.options) ? props.options : [];

  const pick = (event: any, option: any) => {
    if (props.disabled || props.readOnly) return;
    const next = props.multiple ? [...(Array.isArray(props.value) ? props.value : []), option] : option;
    props.onChange?.(event, next, "selectOption", { option });
  };

  const handleKeyDown = (event: any) => {
    if (event.key !== "Enter") return;
    const text = String(event.currentTarget?.value ?? event.target?.value ?? "");
    if (codeMatches || !looksLikeCode(text)) return;
    // Ours to handle: stop the list from also picking its highlighted row.
    event.preventDefault();
    event.stopPropagation();
    (event as any).defaultMuiPrevented = true;
    findItemsByCode(text, options, codeOf).then((found) => {
      if (found.length === 1) pick(event, found[0]);
      else if (found.length > 1) setCodeMatches(found);
      else notify.error(`No product found for code "${text.trim()}"`);
    });
  };

  return (
    <Autocomplete
      {...rest}
      filterOptions={codeMatches ? () => codeMatches : (filterOptions ?? ((opts: any[], state: any) => searchItems(opts, state.inputValue, codeOf, textOf)))}
      open={isOpen}
      onOpen={(e: any) => { setLocalOpen(true); onOpen?.(e); }}
      onClose={(e: any, reason: any) => { setLocalOpen(false); setCodeMatches(null); onClose?.(e, reason); }}
      onInputChange={(e: any, v: string, reason: any) => {
        if (reason === "input" && codeMatches) setCodeMatches(null);
        onInputChange?.(e, v, reason);
      }}
      onChange={(e: any, v: any, reason: any, details: any) => { setCodeMatches(null); props.onChange?.(e, v, reason, details); }}
      renderInput={(params: any) => renderInput({
        ...params,
        inputProps: {
          ...params.inputProps,
          onKeyDown: (e: any) => { handleKeyDown(e); params.inputProps?.onKeyDown?.(e); },
        },
      })}
    />
  );
}
