import { useMemo, useState } from "react";
import { toSinhalaSearch } from "../../../utils/singlishSearch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Stack, TextField, Autocomplete, Button, Typography, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getStockList } from "../../../api/Inventory/StockListApi";
import {
  getPromotionalPrices, createPromotionalPrice, deletePromotionalPrice, updatePromotionalPrice,
} from "../../../api/PromotionalPrice/PromotionalPriceApi";
import { useHomeCurrency } from "../../../hooks/useHomeCurrency";
import { notify } from "../../../services/notificationService";

/**
 * Schedule a temporary selling price for a date range — checkout (via
 * BarcodeLookupController::resolveSalePrice) picks it up automatically
 * while today falls inside that range, and stops the moment it doesn't.
 * The permanent price in Set Price / sales_pricing is never touched, so
 * there's nothing to manually revert when the promotion ends.
 */
export default function PromotionalPricesPage() {
  const { formatCurrency } = useHomeCurrency();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [promoPrice, setPromoPrice] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));

  const { data: typedResults } = useQuery({
    queryKey: ["stock-search-promo", search],
    queryFn: () => getStockList({ search: search || undefined }),
    enabled: search.length > 0,
  });

  // Singlish search, same as POS Checkout: "kiri" also searches "කිරි".
  const sinhalaSearch = useMemo(() => toSinhalaSearch(search), [search]);
  const { data: sinhalaResults } = useQuery({
    queryKey: ["stock-search-promo", sinhalaSearch],
    queryFn: () => getStockList({ search: sinhalaSearch }),
    enabled: sinhalaSearch.length > 0,
  });

  const results = useMemo(() => {
    const seen = new Set<string>();
    return [...(typedResults ?? []), ...(sinhalaSearch ? sinhalaResults ?? [] : [])].filter((p: any) => {
      const id = String(p.stock_id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [typedResults, sinhalaResults, sinhalaSearch]);

  const { data: promos, isLoading } = useQuery({ queryKey: ["promotional-prices"], queryFn: () => getPromotionalPrices() });

  const createMutation = useMutation({
    mutationFn: () => createPromotionalPrice({
      stock_id: product.stock_id,
      promo_price: Number(promoPrice),
      start_date: startDate,
      end_date: endDate,
    }),
    onSuccess: () => {
      notify.success("Promotional price scheduled");
      queryClient.invalidateQueries({ queryKey: ["promotional-prices"] });
      setProduct(null);
      setPromoPrice("");
    },
    onError: (err: any) => notify.error(err?.response?.data?.message || "Failed to schedule promotional price"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => updatePromotionalPrice(id, { active: false }),
    onSuccess: () => {
      notify.success("Promotion cancelled");
      queryClient.invalidateQueries({ queryKey: ["promotional-prices"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePromotionalPrice(id),
    onSuccess: () => {
      notify.success("Promotion deleted");
      queryClient.invalidateQueries({ queryKey: ["promotional-prices"] });
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const statusOf = (p: any) => {
    if (!p.active) return { label: "Cancelled", color: "default" as const };
    if (p.end_date < today) return { label: "Expired", color: "default" as const };
    if (p.start_date > today) return { label: "Scheduled", color: "info" as const };
    return { label: "Active Now", color: "success" as const };
  };

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2 }}>
        <PageTitle title="Promotional Prices" />
        <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "Promotional Prices" }]} />
        <Typography variant="caption" color="text.secondary">
          Schedule a temporary discounted price for a date range — checkout uses it automatically while the range is active, and reverts to the normal price on its own once it ends.
        </Typography>
      </Box>

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Autocomplete
              options={results ?? []}
              getOptionLabel={(p: any) => p.description ?? p.stock_id ?? ""}
              inputValue={search}
              onInputChange={(_, v) => setSearch(v)}
              onChange={(_, v) => setProduct(v)}
              filterOptions={(x) => x}
              renderInput={(p) => <TextField {...p} label="Find Product" placeholder="Search by name, stock ID, or barcode" size="small" />}
            />

            {product && (
              <>
                <Typography variant="body2">
                  {product.description} — current price: {formatCurrency(product.selling_price ?? 0)}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField label="Promo Price" type="number" size="small" sx={{ flex: 1 }} value={promoPrice} onChange={(e) => setPromoPrice(e.target.value)} />
                  <TextField label="Start Date" type="date" size="small" sx={{ flex: 1 }} value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                  <TextField label="End Date" type="date" size="small" sx={{ flex: 1 }} value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                </Stack>
                <Button
                  variant="contained" startIcon={<LocalOfferIcon />} sx={{ alignSelf: "flex-start" }}
                  disabled={!promoPrice || Number(promoPrice) <= 0 || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? "Scheduling..." : "Schedule Promotion"}
                </Button>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Product ID</TableCell><TableCell>Product</TableCell><TableCell align="right">Promo Price</TableCell>
                <TableCell>Start</TableCell><TableCell>End</TableCell><TableCell>Status</TableCell><TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(promos ?? []).map((p: any) => {
                const status = statusOf(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell>{p.stock_id}</TableCell>
                    <TableCell>{p.stock?.description ?? p.stock_id}</TableCell>
                    <TableCell align="right">{formatCurrency(p.promo_price)}</TableCell>
                    <TableCell>{p.start_date}</TableCell>
                    <TableCell>{p.end_date}</TableCell>
                    <TableCell><Chip size="small" label={status.label} color={status.color} /></TableCell>
                    <TableCell align="center">
                      {p.active && (
                        <Button size="small" onClick={() => cancelMutation.mutate(p.id)}>Cancel</Button>
                      )}
                      <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(p.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!promos || promos.length === 0) && (
                <TableRow><TableCell colSpan={7} align="center"><Typography variant="body2">No promotional prices scheduled.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </FormPageLayout>
  );
}
