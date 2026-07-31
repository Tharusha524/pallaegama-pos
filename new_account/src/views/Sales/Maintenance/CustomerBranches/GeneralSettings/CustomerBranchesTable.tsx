import { FormPageLayout } from "../../../../../components/Layout/FormPageLayout";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import {
  Box,
  Button,
  Stack,
  TableFooter,
  TablePagination,
  Typography,
  useMediaQuery,
  Theme,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { useMemo, useState, useEffect } from "react";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../../components/BreadCrumb";
import PageTitle from "../../../../../components/PageTitle";
import theme from "../../../../../theme";
import SearchBar from "../../../../../components/SearchBar";
import { getBranches, deleteBranch, getBranch, updateBranch, CustomerBranch as ApiCustomerBranch } from "../../../../../api/CustomerBranch/CustomerBranchApi";
import { useAuth } from "../../../../../context/AuthContext";

interface CustomerBranchesTableProps {
  customerId: string | number;
}

export interface CustomerBranch {
  branch_code: number;
  debtor_no: number;
  br_name: string;
  branch_ref: string;
  br_address: string;
  sales_area?: number | null | { name?: string; label?: string };
  sales_person?: number | null | { name?: string; label?: string };
  inventory_location: string;
  tax_group?: number | null | { description?: string; name?: string };
  sales_account: string;
  sales_discount_account: string;
  receivables_account: string;
  payment_discount_account: string;
  shipping_company: number;
  br_post_address: string;
  sales_group: number;
  notes: string;
  bank_account?: string;
  inactive: boolean;
}

interface MappedBranch {
  id: number;
  shortName: string;
  name: string;
  contact: string;
  salesPerson: string;
  area: string;
  phone: string;
  fax: string;
  email: string;
  taxGroup: string;
  inactive: boolean;
}

export default function CustomerBranchesTable({ customerId }: CustomerBranchesTableProps) {
  const [branches, setBranches] = useState<MappedBranch[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Customer branches maintenance');

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const data: CustomerBranch[] = await getBranches(customerId);
        // filter branches by selected customer
        const filtered = data.filter(b => b.debtor_no === customerId);
        
        // Create an array to store the mapped branches
        let mappedBranches: MappedBranch[] = [];
        
        // Process each branch and get its contacts
        for (const branch of filtered) {
          // First, map the basic branch data
          const mappedBranch: MappedBranch = {
            id: branch.branch_code,
            shortName: branch.branch_ref,
            name: branch.br_name,
            contact: "", // Will be populated below if contacts exist
            salesPerson:
              branch.sales_person
                ? typeof branch.sales_person === "object"
                  ? branch.sales_person.name || branch.sales_person.label || ""
                  : String(branch.sales_person)
                : "",
            area:
              branch.sales_area
                ? typeof branch.sales_area === "object"
                  ? branch.sales_area.name || branch.sales_area.label || ""
                  : String(branch.sales_area)
                : "",
            phone: "", // Will be populated below if contacts exist
            fax: "", // Will be populated below if contacts exist
            email: "", // Will be populated below if contacts exist
            taxGroup:
              branch.tax_group
                ? typeof branch.tax_group === "object"
                  ? branch.tax_group.description || branch.tax_group.name || ""
                  : String(branch.tax_group)
                : "",
            inactive: branch.inactive,
          };
          
          try {
            // Fetch contacts for this branch using branch_code
            // Directly import the API module to avoid any caching issues
            const CustomerBranchContactApi = await import('../../../../../api/CustomerBranch/CustomerBranchContactApi');
            
            // Get contacts where crm_contacts.entity_id = branch.branch_code
            // This ensures each branch gets its own specific contacts
            const branchContacts = await CustomerBranchContactApi.getCustomerContacts(branch.branch_code);
            
            // If contacts exist, use the first contact's information
            if (branchContacts && Array.isArray(branchContacts) && branchContacts.length > 0) {
              const primaryContact = branchContacts[0];
              
              // Safely extract contact info with fallbacks
              mappedBranch.contact = primaryContact?.ref || ""; // Use ref field from crm_persons as the contact name
              mappedBranch.phone = primaryContact?.phone || "";
              mappedBranch.fax = primaryContact?.fax || "";
              mappedBranch.email = primaryContact?.email || "";
            }
          } catch (contactError) {
            // Continue with empty contact fields
          }
          
          mappedBranches.push(mappedBranch);
        }
        
        setBranches(mappedBranches);
      } catch (error) {
        // Failed to fetch branches
      }
    };

    if (customerId) loadBranches();
  }, [customerId]);


  const filteredData = useMemo(() => {
    let data = showInactive ? branches : branches.filter((b) => !b.inactive);
    if (searchQuery.trim() !== "") {
      const lower = searchQuery.toLowerCase();
      data = data.filter(
        (b) =>
          b.shortName.toLowerCase().includes(lower) ||
          b.name.toLowerCase().includes(lower) ||
          b.contact.toLowerCase().includes(lower) ||
          b.salesPerson.toLowerCase().includes(lower) ||
          b.area.toLowerCase().includes(lower) ||
          b.phone.toLowerCase().includes(lower) ||
          b.fax.toLowerCase().includes(lower) ||
          b.email.toLowerCase().includes(lower) ||
          b.taxGroup.toLowerCase().includes(lower)
      );
    }
    return data;
  }, [branches, showInactive, searchQuery]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [page, rowsPerPage, filteredData]);

  const columnCount = showInactive ? 11 : 10;

  const handleChangePage = (event: React.MouseEvent<HTMLButtonElement> | null, newPage: number) =>
    setPage(newPage);

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this branch?")) return;
    try {
      await deleteBranch(id);
      setBranches((prev) => prev.filter((b) => b.id !== id));
      alert("Branch deleted successfully");
    } catch (error) {
      alert("Failed to delete branch");
    }
  };

  const handleToggleInactive = async (id: number, value: boolean) => {
    // Optimistic UI update
    setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, inactive: value } : b)));

    try {
      // Fetch full branch object from backend because update endpoint expects required fields
      const fullBranch: any = await getBranch(id);

      // Build sanitized payload matching the shape used by the Update form
      const payload: any = {};

      if (fullBranch.debtor_no !== undefined && fullBranch.debtor_no !== null) payload.debtor_no = Number(fullBranch.debtor_no);
      if (fullBranch.br_name !== undefined) payload.br_name = String(fullBranch.br_name || "");
      if (fullBranch.branch_ref !== undefined) payload.branch_ref = String(fullBranch.branch_ref || "");

      if (fullBranch.sales_person !== undefined && fullBranch.sales_person !== null) {
        payload.sales_person = typeof fullBranch.sales_person === "object"
          ? Number(fullBranch.sales_person.id ?? fullBranch.sales_person)
          : Number(fullBranch.sales_person);
      }

      if (fullBranch.sales_area !== undefined && fullBranch.sales_area !== null) {
        payload.sales_area = typeof fullBranch.sales_area === "object"
          ? Number(fullBranch.sales_area.id ?? fullBranch.sales_area)
          : Number(fullBranch.sales_area);
      }

      if (fullBranch.sales_group !== undefined && fullBranch.sales_group !== null) {
        payload.sales_group = typeof fullBranch.sales_group === "object"
          ? Number(fullBranch.sales_group.id ?? fullBranch.sales_group)
          : Number(fullBranch.sales_group);
      }

      if (fullBranch.inventory_location !== undefined && fullBranch.inventory_location !== null) {
        payload.inventory_location = typeof fullBranch.inventory_location === "object"
          ? String(fullBranch.inventory_location.loc_code ?? fullBranch.inventory_location)
          : String(fullBranch.inventory_location);
      }

      if (fullBranch.shipping_company !== undefined && fullBranch.shipping_company !== null) {
        payload.shipping_company = typeof fullBranch.shipping_company === "object"
          ? Number(fullBranch.shipping_company.shipper_id ?? fullBranch.shipping_company)
          : Number(fullBranch.shipping_company);
      }

      if (fullBranch.tax_group !== undefined && fullBranch.tax_group !== null) {
        payload.tax_group = typeof fullBranch.tax_group === "object"
          ? Number(fullBranch.tax_group.id ?? fullBranch.tax_group)
          : Number(fullBranch.tax_group);
      }

      if (fullBranch.sales_account !== undefined) payload.sales_account = String(fullBranch.sales_account || "");
      if (fullBranch.sales_discount_account !== undefined) payload.sales_discount_account = String(fullBranch.sales_discount_account || "");
      if (fullBranch.receivables_account !== undefined) payload.receivables_account = String(fullBranch.receivables_account || "");
      if (fullBranch.payment_discount_account !== undefined) payload.payment_discount_account = String(fullBranch.payment_discount_account || "");
      if (fullBranch.bank_account !== undefined) payload.bank_account = String(fullBranch.bank_account || "");
      if (fullBranch.br_post_address !== undefined) payload.br_post_address = String(fullBranch.br_post_address || "");
      if (fullBranch.br_address !== undefined) payload.br_address = String(fullBranch.br_address || "");
      if (fullBranch.notes !== undefined) payload.notes = String(fullBranch.notes || "");

      // Always set inactive to the requested value
      payload.inactive = value;

      // Cast to ApiCustomerBranch when sending
      const castPayload: ApiCustomerBranch = payload as ApiCustomerBranch;

      await updateBranch(id, castPayload);

      await updateBranch(id, payload);
    } catch (error: any) {
      // Revert on error
      setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, inactive: !value } : b)));
      const message = error?.message || "Failed to update inactive status";
      alert(message);
    }
  };

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Branches" },
  ];

  return (
    <FormPageLayout>
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
          <PageTitle title="Customer Branches" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate(`/sales/maintenance/customer-branches/add-general-settings/${customerId}`)}
          >
            Add Branch
          </Button>
        </Stack>
      </Box>
      {/* Checkbox & Search */}
      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={2}
        sx={{ px: 2, mb: 2, alignItems: "center", justifyContent: "space-between" }}
      >
        <FormControlLabel
          control={
            <Checkbox checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          }
          label="Show Also Inactive"
        />
        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Search Branches" />
        </Box>
      </Stack>
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer component={Paper} elevation={2} sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}>
          <Table aria-label="branches table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Short Name</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Sales Person</TableCell>
                <TableCell>Area</TableCell>
                <TableCell>Phone No</TableCell>
                <TableCell>Fax No</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Tax Group</TableCell>
                {showInactive && <TableCell align="center">Inactive</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((branch) => (
                  <TableRow key={branch.id} hover>
                    <TableCell>{branch.shortName}</TableCell>
                    <TableCell>{branch.name}</TableCell>
                    <TableCell>{branch.contact}</TableCell>
                    <TableCell>{branch.salesPerson}</TableCell>
                    <TableCell>{branch.area}</TableCell>
                    <TableCell>{branch.phone}</TableCell>
                    <TableCell>{branch.fax}</TableCell>
                    <TableCell>{branch.email}</TableCell>
                    <TableCell>{branch.taxGroup}</TableCell>
                    {showInactive && (
                      <TableCell align="center">
                        <Checkbox
                          checked={!!branch.inactive}
                          onChange={(e) => handleToggleInactive(branch.id, e.target.checked)}
                        />
                      </TableCell>
                    )}
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() =>
                            navigate(`/sales/maintenance/customer-branches/edit/${branch.id}`)
                          }
                        >
                          Edit
                        </Button>
                        <Button
                          disabled={!canEdit}
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleDelete(branch.id)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columnCount} align="center">
                    <Typography variant="body2">No Records Found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, { label: "All", value: -1 }]}
                  colSpan={columnCount}
                  count={filteredData.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  showFirstButton
                  showLastButton
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      </Stack>
    </FormPageLayout>
  );
}
