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
  TableFooter,
  TablePagination,
  Paper,
  TextField,
  Typography,
  MenuItem,
  Grid,
  useMediaQuery,
  Theme,
  FormControl,
  InputLabel,
  Select,
  ListSubheader,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getInventoryLocations } from "../../../../api/InventoryLocation/InventoryLocationApi";
import { getItems } from "../../../../api/Item/ItemApi";
import { getCustomers } from "../../../../api/Customer/AddCustomerApi";
import { getItemCategories } from "../../../../api/ItemCategories/ItemCategoriesApi";
import { getSalesOrderDetails } from "../../../../api/SalesOrders/SalesOrderDetailsApi";
import { getBranches } from "../../../../api/CustomerBranch/CustomerBranchApi";
import {
  dispatchTemplateDelivery,
  getSalesOrderInquiry,
} from "../../../../api/SalesInquiry/SalesInquiryApi";
import { useMessageDialog } from "../../../../context/MessageDialogContext";
import { runTransactionSave } from "../../../../utils/transactionSave";
import Breadcrumb from "../../../../components/BreadCrumb";
import { formatTransactionMoney } from "../../../../utils/transactionMoney";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import { useAuth } from "../../../../context/AuthContext";

interface Row {
  id: number;
  orderNo: string;
  ref: string;
  customer: string;
  branch: string;
  description: string;
  orderDate: string;
  requiredBy: string;
  deliveryTo: string;
  orderTotal: number | string;
  currency: string;
}

function resolveDebtorNo(selectedCustomer: string, customers: any[]): string | number {
  if (selectedCustomer === "ALL_CUSTOMERS") return selectedCustomer;
  const customer = customers.find(
    (c: any) =>
      String(c.customer_id ?? c.id ?? c.debtor_no) === String(selectedCustomer)
  );
  return customer?.debtor_no ?? selectedCustomer;
}

export default function TemplateDelivery() {
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Sales templates');
  const navigate = useNavigate();
  const { showError } = useMessageDialog();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [processingOrderNo, setProcessingOrderNo] = useState<number | null>(null);

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ["inventoryLocations"],
    queryFn: getInventoryLocations,
  });
  const { data: items = [] } = useQuery<any[]>({ queryKey: ["items"], queryFn: getItems });
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["itemCategories"],
    queryFn: () => getItemCategories(),
  });
  const { data: salesOrderDetails = [] } = useQuery<any[]>({
    queryKey: ["salesOrderDetails"],
    queryFn: () => getSalesOrderDetails(),
  });
  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["custBranches"],
    queryFn: () => getBranches(),
  });

  const [numberText, setNumberText] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [location, setLocation] = useState("ALL_LOCATIONS");
  const [selectedItem, setSelectedItem] = useState("ALL_ITEMS");
  const [itemCode, setItemCode] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("ALL_CUSTOMERS");
  const [searchTick, setSearchTick] = useState(0);

  const inquiryParams = React.useMemo(
    () => ({
      template: true,
      ...(selectedCustomer !== "ALL_CUSTOMERS"
        ? { debtor_no: Number(resolveDebtorNo(selectedCustomer, customers)) }
        : {}),
      ...(numberText.trim() ? { order_no: Number(numberText) || undefined } : {}),
      ...(referenceText.trim() ? { reference: referenceText.trim() } : {}),
      ...(location !== "ALL_LOCATIONS" ? { from_stk_loc: location } : {}),
      ...(itemCode.trim() ? { stk_code: itemCode.trim() } : {}),
      ...(selectedItem !== "ALL_ITEMS" ? { stk_code: selectedItem } : {}),
      limit: 500,
    }),
    [
      selectedCustomer,
      customers,
      numberText,
      referenceText,
      location,
      itemCode,
      selectedItem,
      searchTick,
    ]
  );

  const { data: salesOrders = [], isLoading } = useQuery<any[]>({
    queryKey: ["templateDeliveryOrders", inquiryParams],
    queryFn: () => getSalesOrderInquiry(inquiryParams),
  });

  const hasOrderLines = React.useCallback(
    (orderNo: string | number) =>
      (salesOrderDetails || []).some(
        (d: any) => Number(d.order_no) === Number(orderNo)
      ),
    [salesOrderDetails]
  );

  const rows: Row[] = React.useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return (salesOrders || [])
      .filter((s: any) => Number(s.type ?? 0) === 1 && Number(s.trans_type ?? 30) === 30)
      .filter((s: any) => hasOrderLines(s.order_no))
      .map((s: any, idx: number) => {
        const cust = (customers || []).find(
          (c: any) => String(c.debtor_no) === String(s.debtor_no)
        );
        const br = (branches || []).find(
          (b: any) => String(b.branch_code) === String(s.branch_code)
        );
        const firstDetail = (salesOrderDetails || []).find(
          (d: any) => Number(d.order_no) === Number(s.order_no)
        );
        const description =
          firstDetail?.description ??
          firstDetail?.item_desc ??
          firstDetail?.stock_description ??
          s.description ??
          "";

        return {
          id: s.order_no ?? idx,
          orderNo: String(s.order_no ?? ""),
          ref: s.reference ?? "",
          customer:
            s.customer_name ??
            cust?.name ??
            cust?.customer_name ??
            String(s.debtor_no ?? ""),
          branch: s.branch_name ?? br?.br_name ?? String(s.branch_code ?? ""),
          description,
          orderDate: s.ord_date ?? today,
          requiredBy: s.delivery_date ?? "",
          deliveryTo: s.deliver_to ?? "",
          orderTotal: s.total ?? 0,
          currency: cust?.curr_code ?? "",
        } as Row;
      });
  }, [salesOrders, customers, branches, salesOrderDetails, hasOrderLines]);

  const paginatedRows = React.useMemo(() => {
    if (rowsPerPage === -1) return rows;
    return rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [rows, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  useEffect(() => {
    if (!selectedItem || selectedItem === "ALL_ITEMS") {
      setItemCode("");
      return;
    }
    const it = (items || []).find(
      (i: any) => String(i.stock_id ?? i.id) === String(selectedItem)
    );
    setItemCode(it ? String(it.stock_id ?? it.id ?? "") : "");
  }, [selectedItem, items]);

  const handleSearch = () => {
    setPage(0);
    setSearchTick((t) => t + 1);
  };

  const handleTemplateDelivery = async (orderNo: string | number) => {
    const numericOrderNo = Number(orderNo);
    if (!numericOrderNo) {
      showError("Invalid template order number.");
      return;
    }
    setProcessingOrderNo(numericOrderNo);
    const saveResult = await runTransactionSave(() =>
      dispatchTemplateDelivery(numericOrderNo)
    );
    setProcessingOrderNo(null);

    if ("message" in saveResult) {
      showError(saveResult.message, "Template delivery failed");
      return;
    }

    const result = saveResult.data;
    navigate("/sales/transactions/direct-delivery/success", {
      state: {
        transNo: result.trans_no,
        reference: result.reference,
        deliveryDate: result.debtor_trans?.tran_date,
        orderNo: result.debtor_trans?.order_no,
      },
    });
  };

  return (
    <FormPageLayout>
      <Box
        sx={{
          padding: theme.spacing(2),
          boxShadow: 2,
          borderRadius: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Box>
          <PageTitle title="Select Template for Delivery" />
          <Breadcrumb
            breadcrumbs={[
              { title: "Home", href: "/dashboard" },
              { title: "Template Delivery" },
            ]}
          />
        </Box>

        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Box>
      <Alert severity="info">
        Template orders use the <strong>Template</strong> checkbox on{" "}
        <strong>Sales → Inquiries → Search All Sales Orders</strong>. Only orders marked as
        template (<code>type = 1</code>) appear here — not price list (<code>order_type</code>).
      </Alert>
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              size="small"
              label="#"
              value={numberText}
              onChange={(e) => setNumberText(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="Ref"
              value={referenceText}
              onChange={(e) => setReferenceText(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="td-location-label">Location</InputLabel>
              <Select
                labelId="td-location-label"
                value={location}
                label="Location"
                onChange={(e) => setLocation(String(e.target.value))}
              >
                <MenuItem value="ALL_LOCATIONS">All Locations</MenuItem>
                {(locations || []).map((loc: any) => (
                  <MenuItem key={loc.loc_code} value={loc.loc_code}>
                    {loc.location_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              size="small"
              label="Item Code"
              value={itemCode}
              InputProps={{ readOnly: true }}
            />
          </Grid>

          <Grid item xs={12} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="td-item-label">Select Item</InputLabel>
              <Select
                labelId="td-item-label"
                value={selectedItem ?? ""}
                label="Select Item"
                onChange={(e) => setSelectedItem(String(e.target.value))}
              >
                <MenuItem value="ALL_ITEMS">All Items</MenuItem>
                {Object.entries(
                  items.reduce((acc: any, item: any) => {
                    const category =
                      categories.find((c: any) => c.category_id === item.category_id)
                        ?.description || "Uncategorized";
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(item);
                    return acc;
                  }, {} as Record<string, any[]>)
                ).map(([category, catItems]: [string, any[]]) => [
                  <ListSubheader key={category}>{category}</ListSubheader>,
                  ...catItems.map((item: any) => (
                    <MenuItem
                      key={item.stock_id ?? item.id}
                      value={String(item.stock_id ?? item.id)}
                    >
                      {item.description ?? item.item_name ?? item.name}
                    </MenuItem>
                  )),
                ])}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={12} md={4}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Box sx={{ flex: 1 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="td-customer-label">Select Customer</InputLabel>
                  <Select
                    labelId="td-customer-label"
                    value={selectedCustomer ?? ""}
                    label="Select Customer"
                    onChange={(e) => setSelectedCustomer(String(e.target.value))}
                  >
                    <MenuItem value="ALL_CUSTOMERS">All Customers</MenuItem>
                    {(customers || []).map((c: any) => (
                      <MenuItem
                        key={c.debtor_no ?? c.customer_id ?? c.id}
                        value={String(c.debtor_no ?? c.customer_id ?? c.id)}
                      >
                        {c.name ?? c.customer_name ?? c.debtor_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={handleSearch}
                sx={{ whiteSpace: "nowrap" }}
              >
                Search
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      {rows.length === 0 && !isLoading && (
        <Alert severity="warning">
          No template orders found. Open{" "}
          <strong>Sales → Inquiries → Search All Sales Orders</strong>, tick the{" "}
          <strong>Template</strong> column for an order, then return here.
        </Alert>
      )}
      <TableContainer component={Paper} sx={{ p: 1 }}>
        <Table>
          <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
            <TableRow>
              <TableCell>No</TableCell>
              <TableCell>Order #</TableCell>
              <TableCell>Ref</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Order Date</TableCell>
              <TableCell>Required By</TableCell>
              <TableCell>Delivery To</TableCell>
              <TableCell>Order Total</TableCell>
              <TableCell>Currency</TableCell>
              <TableCell align="center">Action</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {paginatedRows.map((row, index) => (
              <TableRow key={row.id} hover>
                <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                <TableCell>{row.orderNo}</TableCell>
                <TableCell>{row.ref}</TableCell>
                <TableCell>{row.customer}</TableCell>
                <TableCell>{row.branch}</TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell>{row.orderDate}</TableCell>
                <TableCell>{row.requiredBy}</TableCell>
                <TableCell>{row.deliveryTo}</TableCell>
                <TableCell>{formatTransactionMoney(row.orderTotal, row.currency)}</TableCell>
                <TableCell>{row.currency}</TableCell>
                <TableCell>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={processingOrderNo === Number(row.orderNo) || !canEdit}
                    onClick={() => handleTemplateDelivery(row.orderNo)}
                  >
                    {processingOrderNo === Number(row.orderNo) ? "Processing..." : "Delivery"}
                  </Button>
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
