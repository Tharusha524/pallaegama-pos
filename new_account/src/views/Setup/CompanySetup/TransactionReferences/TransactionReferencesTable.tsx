import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
import React, { useMemo, useState } from "react";
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
  Typography,
  useMediaQuery,
  Theme,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import SearchBar from "../../../../components/SearchBar";
import theme from "../../../../theme";
import { getReflines, deleteRefline } from "../../../../api/Reflines/ReflinesApi";
import { getTransTypes } from "../../../../api/Reflines/TransTypesApi";
import { useAuth } from "../../../../context/AuthContext";

// Data is loaded from the Reflines API (see schema):
// id, trans_type, prefix, pattern, memo, default, inactive, timestamps

function TransactionReferencesTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDefault, setShowDefault] = useState(false);
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Stock transactions view');

  const { data: transactionData = [], refetch } = useQuery({
    queryKey: ["reflines"],
    queryFn: getReflines,
    refetchOnMount: true
  });

  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRefline(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reflines"] });
    },
    onError: (err: any) => {
      console.error(err);
      alert("Failed to delete Transaction Reference");
    },
  });

  const { data: transTypes = [] } = useQuery({
    queryKey: ["transTypes"],
    queryFn: getTransTypes,
  });

  const transTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    (transTypes as any[]).forEach((t: any) => {
      // trans_types table uses `trans_type` as the code that matches reflines.trans_type
      const key = String(t.trans_type ?? t.id ?? t.code ?? "");
      const label = String(t.description ?? t.name ?? t.label ?? key);
      if (key) map[key] = label;
    });
    return map;
  }, [transTypes]);

  const filteredData = useMemo(() => {
    if (!transactionData) return [];
    let filtered = transactionData as any[];

    if (showDefault) {
      filtered = filtered.filter((item) => !!item.default);
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const transTypeName = String(transTypeMap[String(item.trans_type)] ?? item.trans_type ?? "").toLowerCase();
        const prefix = String(item.prefix ?? "").toLowerCase();
    const pattern = String(item.pattern ?? "").toLowerCase();
    const desc = String(item.memo ?? "").toLowerCase();

        return (
          transTypeName.includes(lowerQuery) ||
          prefix.includes(lowerQuery) ||
          pattern.includes(lowerQuery) ||
          desc.includes(lowerQuery)
        );
      });
    }

    // Sort/group so same transaction types stay together (by description if available)
    try {
      filtered = filtered.slice().sort((a, b) => {
        // Sort by raw trans_type code first (preserve server ordering by trans_type)
        const aRaw = a.trans_type ?? "";
        const bRaw = b.trans_type ?? "";

        // If both look like numbers, compare numerically
        const aNum = Number(aRaw);
        const bNum = Number(bRaw);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          if (aNum !== bNum) return aNum - bNum;
        } else {
          const cmp = String(aRaw).localeCompare(String(bRaw), undefined, { numeric: true, sensitivity: "base" });
          if (cmp !== 0) return cmp;
        }

        // then by prefix, then pattern
        const cmpPrefix = String(a.prefix ?? "").localeCompare(String(b.prefix ?? ""), undefined, { sensitivity: "base" });
        if (cmpPrefix !== 0) return cmpPrefix;

        return String(a.pattern ?? "").localeCompare(String(b.pattern ?? ""), undefined, { sensitivity: "base" });
      });
    } catch (e) {
      // fall back to unsorted if anything unexpected happens
      console.warn("Failed to sort reflines by trans_type:", e);
    }

    return filtered;
  }, [transactionData, searchQuery, showDefault]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = (id: number) => {
    const confirmed = window.confirm("Are you sure you want to delete this Transaction Reference?");
    if (!confirmed) return;
    setDeletingId(id);
    deleteMutation.mutate(id, {
      onSettled: () => setDeletingId(null),
    });
  };

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Transaction References" },
  ];

  return (
    <FormPageLayout>
      {/* Header */}
      <Box
        sx={{
          padding: theme.spacing(2),
          boxShadow: 2,
          marginY: 2,
          borderRadius: 1,
          overflowX: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <PageTitle title="Transaction References" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() =>
              navigate("/setup/companysetup/add-transaction-references")
            }
          >
            Add Transaction Reference
          </Button>

          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        </Stack>
      </Box>
      {/* Search + Show Default Toggle */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          px: 2,
          mb: 2,
          width: "100%",
          alignItems: "center",
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={showDefault}
              onChange={(e) => setShowDefault(e.target.checked)}
            />
          }
          label="Show only Default"
        />

        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Search..."
          />
        </Box>
      </Box>
      {/* Table */}
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer
          component={Paper}
          elevation={2}
          sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}
        >
          <Table aria-label="transaction references table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>No</TableCell>
                <TableCell>Transaction Type</TableCell>
                <TableCell>Prefix</TableCell>
                <TableCell>Pattern</TableCell>
                <TableCell>Default</TableCell>
                <TableCell>Memo</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((item: any, index: number) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{transTypeMap[String(item.trans_type)] ?? item.trans_type}</TableCell>
                    <TableCell>{item.prefix}</TableCell>
                    <TableCell>{item.pattern}</TableCell>
                    <TableCell>{!!item.default ? "Yes" : "No"}</TableCell>
                    <TableCell>{item.memo}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => navigate(`/setup/companysetup/update-transaction-references/${item.id}`)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id || !canEdit}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2">No Records Found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  colSpan={7}
                  count={filteredData.length}
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
      </Stack>
    </FormPageLayout>
  );
}

export default TransactionReferencesTable;
