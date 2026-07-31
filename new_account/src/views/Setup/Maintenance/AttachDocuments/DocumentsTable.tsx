import { FormPageLayout } from "../../../../components/Layout/FormPageLayout";
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
} from "@mui/material";
import { useMemo, useState, useEffect } from "react";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../../../../components/BreadCrumb";
import PageTitle from "../../../../components/PageTitle";
import theme from "../../../../theme";
import SearchBar from "../../../../components/SearchBar";
import { useAuth } from "../../../../context/AuthContext";

// Mock API
const getDocuments = async () => [
  {
    id: 1,
    docTitle: "Invoice 001",
    filename: "invoice001.pdf",
    size: "250KB",
    filetype: "PDF",
    docDate: "2025-09-01",
  },
  {
    id: 2,
    docTitle: "Report Q2",
    filename: "report_q2.xlsx",
    size: "1.2MB",
    filetype: "Excel",
    docDate: "2025-08-15",
  },
];

export default function DocumentsTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [documents, setDocuments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { hasEditPermission } = useAuth();
  const canEdit = hasEditPermission('Attaching documents');

  // Fetch data
  useEffect(() => {
    getDocuments().then((data) => setDocuments(data));
  }, []);

  // Filter data
  const filteredData = useMemo(() => {
    if (searchQuery.trim() === "") return documents;

    const lower = searchQuery.toLowerCase();
    return documents.filter(
      (d) =>
        d.docTitle.toLowerCase().includes(lower) ||
        d.filename.toLowerCase().includes(lower) ||
        d.size.toLowerCase().includes(lower) ||
        d.filetype.toLowerCase().includes(lower) ||
        d.docDate.toLowerCase().includes(lower) ||
        d.id.toString().includes(lower)
    );
  }, [documents, searchQuery]);

  const paginatedData = useMemo(() => {
    if (rowsPerPage === -1) return filteredData;
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [page, rowsPerPage, filteredData]);

  const handleChangePage = (event: React.MouseEvent<HTMLButtonElement> | null, newPage: number) =>
    setPage(newPage);

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = (id: number) => {
    alert(`Delete document with id: ${id}`);
  };

  const breadcrumbItems = [
    { title: "Home", href: "/dashboard" },
    { title: "Documents" },
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
          <PageTitle title="Documents" />
          <Breadcrumb breadcrumbs={breadcrumbItems} />
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/setup/maintenance/add-document")}
          >
            Add Document
          </Button>

          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/setup/maintenance")}
          >
            Back
          </Button>
        </Stack>
      </Box>
      {/* Search */}
      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={2}
        sx={{ px: 2, mb: 2, alignItems: "center", justifyContent: "flex-end" }}
      >
        <Box sx={{ width: isMobile ? "100%" : "300px" }}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Search Documents"
          />
        </Box>
      </Stack>
      <Stack sx={{ alignItems: "center" }}>
        <TableContainer
          component={Paper}
          elevation={2}
          sx={{ overflowX: "auto", maxWidth: isMobile ? "88vw" : "100%" }}
        >
          <Table aria-label="documents table">
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Doc Title</TableCell>
                <TableCell>Filename</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Filetype</TableCell>
                <TableCell>Doc Date</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((doc) => (
                  <TableRow key={doc.id} hover>
                    <TableCell>{doc.id}</TableCell>
                    <TableCell>{doc.docTitle}</TableCell>
                    <TableCell>{doc.filename}</TableCell>
                    <TableCell>{doc.size}</TableCell>
                    <TableCell>{doc.filetype}</TableCell>
                    <TableCell>{doc.docDate}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() =>
                            navigate(`/setup/maintenance/update-document/${doc.id}`)
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
                          onClick={() => handleDelete(doc.id)}
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
