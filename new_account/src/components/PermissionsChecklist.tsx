import {
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Stack,
  Typography,
} from "@mui/material";
import { NAVIGATION_PERMISSION_TREE } from "../permissions/navigationTree";

interface PermissionsChecklistProps {
  selectedIds: number[];
  onToggle: (id: number) => void;
  editIds?: number[];
  onToggleEdit?: (id: number) => void;
  error?: string;
  title?: string;
}

export default function PermissionsChecklist({
  selectedIds,
  onToggle,
  editIds = [],
  onToggleEdit,
  error,
  title = "Permissions",
}: PermissionsChecklistProps) {
  const isChecked = (id: number) => selectedIds.includes(id);
  const isEditChecked = (id: number) => editIds.includes(id);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        {title}
      </Typography>
      {NAVIGATION_PERMISSION_TREE.map((module) => (
        <Box key={module.label} sx={{ mb: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {module.label}
          </Typography>
          {module.submenus.map((submenu) => (
            <Box key={submenu.label} sx={{ pl: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                {submenu.label}
              </Typography>
              <FormGroup sx={{ pl: 2 }}>
                {submenu.pages.map((page) => {
                  const viewChecked = isChecked(page.id);
                  return (
                    <Stack
                      key={`${submenu.label}-${page.label}`}
                      direction="row"
                      spacing={2}
                      alignItems="center"
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={viewChecked}
                            onChange={() => {
                              // Unchecking View revokes Edit too — Edit can
                              // never be granted without View.
                              if (viewChecked && isEditChecked(page.id)) {
                                onToggleEdit?.(page.id);
                              }
                              onToggle(page.id);
                            }}
                          />
                        }
                        label={`${page.label} (View)`}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={isEditChecked(page.id)}
                            disabled={!viewChecked || !onToggleEdit}
                            onChange={() => onToggleEdit?.(page.id)}
                          />
                        }
                        label="Edit"
                      />
                    </Stack>
                  );
                })}
              </FormGroup>
            </Box>
          ))}
        </Box>
      ))}
      {error && <FormHelperText sx={{ color: "red" }}>{error}</FormHelperText>}
    </Box>
  );
}
