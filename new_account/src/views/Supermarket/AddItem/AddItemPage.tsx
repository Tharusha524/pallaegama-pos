import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Box, Button, Stack, TextField, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Paper, IconButton, LinearProgress,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import { bulkCreateItems, AddItemRow } from "../../../api/StockMaster/StockMasterApi";
import { notify } from "../../../services/notificationService";
import * as XLSX from "xlsx";

const emptyRow = (): AddItemRow & { _id: number } => ({
  _id: Date.now() + Math.random(),
  stock_id: "",
  description: "",
  category: "",
  subcategory: "",
  brand: "",
  units: "",
  purchase_cost: undefined,
  selling_price: undefined,
  mrp_price: undefined,
  barcode: "",
});

export default function AddItemPage() {
  const [rows, setRows] = useState<Array<AddItemRow & { _id: number }>>([emptyRow()]);

  const mutation = useMutation({
    mutationFn: () => {
      const valid = rows.filter((r) => r.stock_id.trim() && r.description.trim());
      if (valid.length === 0) throw new Error("Add at least one item with Item Code and Description.");
      return bulkCreateItems(valid.map(({ _id, ...r }) => r));
    },
    onSuccess: (data) => {
      notify.success(`${data.created} item(s) created successfully.`);
      if (data.errors?.length) {
        data.errors.forEach((e: any) => notify.error(`Row ${e.row} (${e.stock_id}): ${e.message}`));
      }
      setRows([emptyRow()]);
    },
    onError: (e: any) => notify.error(e.message ?? "Failed to create items."),
  });

  const updateRow = (id: number, field: keyof AddItemRow, value: any) => {
    setRows((prev) => prev.map((r) => r._id === id ? { ...r, [field]: value } : r));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([["Item Code", "Description", "Category", "Subcategory", "Brand", "Unit", "Purchase Cost", "Selling Price", "MRP Price", "Barcode"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Items");
    XLSX.writeFile(wb, "add_items_template.xlsx");
  };
  const deleteRow = (id: number) => setRows((prev) => prev.filter((r) => r._id !== id));

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const imported = data.map((d) => ({
          _id: Date.now() + Math.random(),
          stock_id: String(d["Item Code"] ?? d["stock_id"] ?? ""),
          description: String(d["Description"] ?? d["description"] ?? ""),
          category: String(d["Category"] ?? d["category"] ?? ""),
          subcategory: String(d["Subcategory"] ?? d["subcategory"] ?? ""),
          brand: String(d["Brand"] ?? d["brand"] ?? ""),
          units: String(d["Unit"] ?? d["units"] ?? ""),
          purchase_cost: d["Purchase Cost"] ? Number(d["Purchase Cost"]) : undefined,
          selling_price: d["Selling Price"] ? Number(d["Selling Price"]) : undefined,
          mrp_price: d["MRP Price"] ? Number(d["MRP Price"]) : undefined,
          barcode: String(d["Barcode"] ?? d["barcode"] ?? ""),
        }));
        setRows(imported.length ? imported : [emptyRow()]);
        notify.success(`${imported.length} row(s) imported from Excel.`);
      } catch {
        notify.error("Failed to read Excel file.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const col = (label: string, width?: number) => (
    <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap", width }}>{label}</TableCell>
  );

  const numField = (id: number, field: keyof AddItemRow, val: any) => (
    <TextField
      size="small" type="number" value={val ?? ""}
      inputProps={{ style: { width: 90 } }}
      onChange={(e) => updateRow(id, field, e.target.value === "" ? undefined : Number(e.target.value))}
    />
  );

  return (
    <FormPageLayout>
      <Breadcrumb breadcrumbs={[{ title: "Products" }, { title: "Add Item" }]} />
      <PageTitle title="Add Item" />

      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <Button variant="contained" startIcon={<AddIcon />} onClick={addRow}>Add Row</Button>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
          Download Template
        </Button>
        <Button
          variant="outlined" component="label" startIcon={<UploadFileIcon />}
        >
          Import Excel
          <input type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
        </Button>
        <Button
          variant="contained" color="success" startIcon={<SaveIcon />}
          onClick={() => mutation.mutate()} disabled={mutation.isPending}
        >
          Save Items
        </Button>
      </Stack>

      {mutation.isPending && <LinearProgress sx={{ mb: 1 }} />}

      <Typography variant="caption" color="text.secondary" mb={1} display="block">
        Excel columns: <b>Item Code, Description, Category, Subcategory, Brand, Unit, Purchase Cost, Selling Price, MRP Price, Barcode</b>
      </Typography>

      <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {col("Item Code *", 120)}
              {col("Description *", 200)}
              {col("Category")}
              {col("Subcategory")}
              {col("Brand")}
              {col("Unit")}
              {col("Purchase Cost")}
              {col("Selling Price")}
              {col("MRP Price")}
              {col("Barcode")}
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r._id}>
                <TableCell>
                  <TextField size="small" value={r.stock_id}
                    inputProps={{ style: { width: 110 } }}
                    onChange={(e) => updateRow(r._id, "stock_id", e.target.value)} />
                </TableCell>
                <TableCell>
                  <TextField size="small" value={r.description}
                    inputProps={{ style: { width: 190 } }}
                    onChange={(e) => updateRow(r._id, "description", e.target.value)} />
                </TableCell>
                <TableCell>
                  <TextField size="small" value={r.category ?? ""}
                    inputProps={{ style: { width: 110 } }}
                    onChange={(e) => updateRow(r._id, "category", e.target.value)} />
                </TableCell>
                <TableCell>
                  <TextField size="small" value={r.subcategory ?? ""}
                    inputProps={{ style: { width: 110 } }}
                    onChange={(e) => updateRow(r._id, "subcategory", e.target.value)} />
                </TableCell>
                <TableCell>
                  <TextField size="small" value={r.brand ?? ""}
                    inputProps={{ style: { width: 90 } }}
                    onChange={(e) => updateRow(r._id, "brand", e.target.value)} />
                </TableCell>
                <TableCell>
                  <TextField size="small" value={r.units ?? ""}
                    inputProps={{ style: { width: 70 } }}
                    onChange={(e) => updateRow(r._id, "units", e.target.value)} />
                </TableCell>
                <TableCell>{numField(r._id, "purchase_cost", r.purchase_cost)}</TableCell>
                <TableCell>{numField(r._id, "selling_price", r.selling_price)}</TableCell>
                <TableCell>{numField(r._id, "mrp_price", r.mrp_price)}</TableCell>
                <TableCell>
                  <TextField size="small" value={r.barcode ?? ""}
                    inputProps={{ style: { width: 110 } }}
                    onChange={(e) => updateRow(r._id, "barcode", e.target.value)} />
                </TableCell>
                <TableCell>
                  <Tooltip title="Remove row">
                    <IconButton size="small" color="error" onClick={() => deleteRow(r._id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </FormPageLayout>
  );
}
