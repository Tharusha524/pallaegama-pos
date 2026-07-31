import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  MenuItem,
  Grid,
  useMediaQuery,
  Theme,
  FormControl,
  InputLabel,
  Select,
  TableFooter,
  TablePagination,
  Checkbox,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import { getItems } from "../../../../api/Item/ItemApi";
import { getCustomers } from "../../../../api/Customer/AddCustomerApi";
import { resolveTransactionCurrencyCode } from "../../../../utils/relationId";
import { getBranches } from "../../../../api/CustomerBranch/CustomerBranchApi";
import { getDebtorTrans } from "../../../../api/DebtorTrans/DebtorTransApi";
import { getDebtorTransDetails } from "../../../../api/DebtorTrans/DebtorTransDetailsApi";
import { getSalesOrders } from "../../../../api/SalesOrders/SalesOrdersApi";
import { useMessageDialog } from "../../../../context/MessageDialogContext";
import Breadcrumb from "../../../../components/BreadCrumb";
import CustomerCurrencyField from "../../../../components/CustomerCurrencyField";
import { formatTransactionMoney } from "../../../../utils/transactionMoney";
import { useHomeCurrency } from "../../../../hooks/useHomeCurrency";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import { useAuth } from "../../../../context/AuthContext";

interface Row {
  id: number;
  deliveryNo: string;
  customer: string;
  branch: string;
  contact: string;
  reference: string;
  custRef: string;
  deliveryDate: string;
  dueBy: string;
  deliveryTotal: string | number;
  currency: string;
}

export default function InvoiceAgainstSalesDelivery() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales invoices edition');
  const navigate = useNavigate();
  const { showError } = useMessageDialog();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const { code: homeCurrencyCode } = useHomeCurrency();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  // lookups
  const { data: locations = [] } = useQuery({ queryKey: ["inventoryLocations"], queryFn: getInventoryLocations });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: getItems });

  // draft filters
  const [numberText, setNumberText] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [location, setLocation] = useState("ALL_LOCATIONS");
  const [itemCode, setItemCode] = useState("");
  const [selectedItem, setSelectedItem] = useState("ALL_ITEMS");
  const [selectedCustomer, setSelectedCustomer] = useState("ALL_CUSTOMERS");

  const [applied, setApplied] = useState({
    numberText: "",
    fromDate: "",
    toDate: "",
    location: "ALL_LOCATIONS",
    itemCode: "",
    selectedItem: "ALL_ITEMS",
    selectedCustomer: "ALL_CUSTOMERS",
  });

  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: getCustomers });
  const filterCustomer = React.useMemo(
    () =>
      selectedCustomer !== "ALL_CUSTOMERS"
        ? (customers || []).find((c: any) => String(c.debtor_no) === String(selectedCustomer))
        : null,
    [customers, selectedCustomer]
  );
  const filterCustomerCurrency = resolveTransactionCurrencyCode(filterCustomer, homeCurrencyCode);
  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => getBranches() });
  const { data: debtorTrans = [] } = useQuery({ queryKey: ["debtorTrans"], queryFn: getDebtorTrans });
  const { data: debtorTransDetails = [] } = useQuery({
    queryKey: ["debtorTransDetails"],
    queryFn: getDebtorTransDetails,
  });
  const { data: salesOrders = [] } = useQuery({
    queryKey: ["salesOrders"],
    queryFn: getSalesOrders,
  });

  const handleSearch = () => {
    setApplied({
      numberText,
      fromDate,
      toDate,
      location,
      itemCode,
      selectedItem,
      selectedCustomer,
    });
    setPage(0);
    setSelectedRows([]);
  };

  const handleBatchInvoice = () => {
    if (selectedRows.length === 0) {
      showError("Select at least one delivery to invoice.", "Nothing selected");
      return;
    }
    const selected = rows.filter((r) => selectedRows.includes(r.id));
    const first = selected[0];
    if (selected.length > 1) {
      showError(
        `Opening invoice for delivery #${first.deliveryNo}. Complete it, then invoice the remaining ${selected.length - 1} delivery(ies) individually.`,
        "Batch invoice"
      );
    }
    navigate("/sales/transactions/direct-delivery/delivery-note-invoice", {
      state: {
        trans_no: first.deliveryNo,
        reference: first.reference,
        date: first.deliveryDate,
      },
    });
  };

  const isNotFullyInvoiced = React.useCallback(
    (transNo: string | number) => {
      const details = (debtorTransDetails || []).filter(
        (dd: any) =>
          Number(dd.debtor_trans_type) === 13 &&
          Number(dd.debtor_trans_no) === Number(transNo)
      );
      if (details.length === 0) {
        return true;
      }
      return details.some(
        (dd: any) => Number(dd.qty_done ?? 0) < Number(dd.quantity ?? 0)
      );
    },
    [debtorTransDetails]
  );

  const rows: Row[] = React.useMemo(() => {
    if (!debtorTrans.length || !customers.length || !branches.length) {
      return [];
    }

    return (debtorTrans as any[])
      .filter((dt: any) => Number(dt.trans_type) === 13 && dt.reference !== "auto")
      .filter((dt: any) => isNotFullyInvoiced(dt.trans_no))
      .filter((dt: any) => {
        if (applied.numberText && !String(dt.trans_no ?? "").includes(applied.numberText)) {
          return false;
        }
        if (applied.fromDate && String(dt.tran_date ?? "").split(" ")[0] < applied.fromDate) {
          return false;
        }
        if (applied.toDate && String(dt.tran_date ?? "").split(" ")[0] > applied.toDate) {
          return false;
        }
        if (applied.location && applied.location !== "ALL_LOCATIONS") {
          const linkedOrder = (salesOrders || []).find(
            (o: any) => Number(o.order_no) === Number(dt.order_no)
          );
          const deliveryLoc = String(linkedOrder?.from_stk_loc ?? "");
          if (deliveryLoc !== String(applied.location)) {
            return false;
          }
        }
        if (applied.selectedCustomer !== "ALL_CUSTOMERS") {
          if (String(dt.debtor_no) !== String(applied.selectedCustomer)) {
            return false;
          }
        }
        if (applied.selectedItem !== "ALL_ITEMS") {
          const hasItem = (debtorTransDetails || []).some(
            (dd: any) =>
              Number(dd.debtor_trans_type) === 13 &&
              Number(dd.debtor_trans_no) === Number(dt.trans_no) &&
              String(dd.stock_id) === String(applied.selectedItem)
          );
          if (!hasItem) return false;
        }
        if (applied.itemCode.trim()) {
          const code = applied.itemCode.trim().toLowerCase();
          const hasCode = (debtorTransDetails || []).some(
            (dd: any) =>
              Number(dd.debtor_trans_type) === 13 &&
              Number(dd.debtor_trans_no) === Number(dt.trans_no) &&
              String(dd.stock_id ?? "").toLowerCase().includes(code)
          );
          if (!hasCode) return false;
        }
        return true;
      })
      .map((dt: any, index: number) => {
        const customer = customers.find((c: any) => String(c.debtor_no) === String(dt.debtor_no));
        const branch = branches.find((b: any) => String(b.branch_code) === String(dt.branch_code));
        return {
          id: dt.trans_no ?? index,
          deliveryNo: String(dt.trans_no ?? ""),
          customer: customer?.name || String(dt.debtor_no),
          branch: branch?.br_name || String(dt.branch_code),
          contact: customer?.phone || customer?.contact_phone || "",
          reference: dt.reference || "",
          custRef: dt.customer_ref || "",
          deliveryDate: dt.tran_date ? String(dt.tran_date).split(" ")[0] : "",
          dueBy: dt.due_date ? String(dt.due_date).split(" ")[0] : "",
          deliveryTotal: dt.ov_amount || 0,
          currency: resolveTransactionCurrencyCode(customer, homeCurrencyCode),
        } as Row;
      });
  }, [
    debtorTrans,
    debtorTransDetails,
    salesOrders,
    customers,
    branches,
    applied,
    isNotFullyInvoiced,
  ]);

  useEffect(() => {
    if (!selectedItem || selectedItem === "ALL_ITEMS") {
      setItemCode("");
      return;
    }
    const it = (items || []).find((i: any) => String(i.stock_id ?? i.id) === String(selectedItem));
    setItemCode(it ? String(it.stock_id ?? it.id ?? "") : "");
  }, [selectedItem, items]);

  const paginatedRows = React.useMemo(() => {
    if (rowsPerPage === -1) return rows;
    return rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [rows, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSelectRow = (id: number) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedRows.length === paginatedRows.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(paginatedRows.map((r) => r.id));
    }
  };

  return (
    <FormPageLayout>
      <Box sx={{ padding: theme.spacing(2), boxShadow: 2, borderRadius: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <Box>
          <PageTitle title="Search Not Invoiced Deliveries" />
          <Breadcrumb breadcrumbs={[{ title: "Home", href: "/dashboard" }, { title: "Search Not Invoiced Deliveries" }]} />
        </Box>

        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>Back</Button>
      </Box>
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={2} md={1}>
            <TextField fullWidth size="small" label="#" value={numberText} onChange={(e) => setNumberText(e.target.value)} />
          </Grid>

          <Grid item xs={12} sm={5} md={3}>
            <TextField fullWidth size="small" label="From" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>

          <Grid item xs={12} sm={5} md={3}>
            <TextField fullWidth size="small" label="To" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>

          <Grid item xs={12} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="iasd-location-label">Location</InputLabel>
              <Select labelId="iasd-location-label" value={location} label="Location" onChange={(e) => setLocation(String(e.target.value))}>
                <MenuItem value="ALL_LOCATIONS">All Locations</MenuItem>
                {(locations || []).map((loc: any) => (
                  <MenuItem key={loc.loc_code} value={loc.loc_code}>{loc.location_name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={3} md={2}>
            <TextField fullWidth size="small" label="Item Code" value={itemCode} InputProps={{ readOnly: true }} />
          </Grid>

          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="iasd-item-label">Select Item</InputLabel>
              <Select labelId="iasd-item-label" value={selectedItem ?? ""} label="Select Item" onChange={(e) => setSelectedItem(String(e.target.value))}>
                <MenuItem value="ALL_ITEMS">All Items</MenuItem>
                {(items || []).map((it: any) => (
                  <MenuItem key={it.stock_id ?? it.id} value={String(it.stock_id ?? it.id)}>{it.description ?? it.item_name ?? it.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="iasd-customer-label">Select Customer</InputLabel>
              <Select labelId="iasd-customer-label" value={selectedCustomer ?? ""} label="Select Customer" onChange={(e) => setSelectedCustomer(String(e.target.value))}>
                <MenuItem value="ALL_CUSTOMERS">All Customers</MenuItem>
                {(customers || []).map((c: any) => (
                  <MenuItem key={c.debtor_no} value={String(c.debtor_no)}>{c.name ?? c.customer_name ?? c.debtor_name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedCustomer !== "ALL_CUSTOMERS" ? (
              <Box sx={{ mt: 1 }}>
                <CustomerCurrencyField customer={filterCustomer} currencyCode={filterCustomerCurrency} />
              </Box>
            ) : null}
          </Grid>

          <Grid item xs={12} sm={2} md={1}>
            <Button variant="contained" startIcon={<SearchIcon />} onClick={handleSearch}>
              Search
            </Button>
          </Grid>
        </Grid>
      </Paper>
      <TableContainer component={Paper} sx={{ p: 1 }}>
        <Table>
          <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
            <TableRow>
              <TableCell>Delivery #</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Cust Ref</TableCell>
              <TableCell>Delivery Date</TableCell>
              <TableCell>Due by</TableCell>
              <TableCell>Delivery Total</TableCell>
              <TableCell>Currency</TableCell>
              <TableCell align="center">
                <Button disabled={!canEdit} variant="outlined" size="small" onClick={handleBatchInvoice}>Batch</Button>
              </TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {paginatedRows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{r.deliveryNo}</TableCell>
                <TableCell>{r.customer}</TableCell>
                <TableCell>{r.branch}</TableCell>
                <TableCell>{r.contact}</TableCell>
                <TableCell>{r.reference}</TableCell>
                <TableCell>{r.custRef}</TableCell>
                <TableCell>{r.deliveryDate}</TableCell>
                <TableCell>{r.dueBy}</TableCell>
                <TableCell>{formatTransactionMoney(r.deliveryTotal, r.currency)}</TableCell>
                <TableCell>{r.currency}</TableCell>
                <TableCell align="center">
                  <Checkbox
                    checked={selectedRows.includes(r.id)}
                    onChange={() => handleSelectRow(r.id)}
                  />
                </TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={1} justifyContent="center">
                    <Button variant="outlined" size="small" onClick={() => navigate("/sales/transactions/update-delivery/" , { state: { id: r.id } })}>Edit</Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() =>
                        navigate("/sales/transactions/direct-delivery/delivery-note-invoice", {
                          state: {
                            trans_no: r.deliveryNo,
                            reference: r.reference,
                            date: r.deliveryDate,
                          },
                        })
                      }
                    >
                      Invoice
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() =>
                        navigate("/sales/transactions/direct-delivery/view-direct-delivery", {
                          state: {
                            trans_no: r.deliveryNo,
                            reference: r.reference,
                            printMode: "delivery",
                          },
                        })
                      }
                    >
                      Print
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                colSpan={12}
                count={rows.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                showFirstButton
                showLastButton
              />
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </FormPageLayout>
  );
}
