import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Chip, Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import { FormPageLayout } from "../../../components/Layout/FormPageLayout";
import PageTitle from "../../../components/PageTitle";
import Breadcrumb from "../../../components/BreadCrumb";
import PageLoader from "../../../components/PageLoader";
import { getPosShifts, openPosShift, closePosShift } from "../../../api/Pos/posApi";
import useCurrentUser from "../../../hooks/useCurrentUser";

export default function PosShiftPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialogId, setCloseDialogId] = useState<number | null>(null);
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingExpected, setClosingExpected] = useState("0");
  const [closingCounted, setClosingCounted] = useState("0");

  const { data: shifts, isLoading } = useQuery({ queryKey: ["pos-shifts"], queryFn: () => getPosShifts() });

  const openMutation = useMutation({
    mutationFn: openPosShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-shifts"] });
      setOpenDialog(false);
      setOpeningFloat("0");
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => closePosShift(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-shifts"] });
      setCloseDialogId(null);
    },
  });

  return (
    <FormPageLayout>
      <Box sx={{ p: 2, boxShadow: 2, borderRadius: 1, mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <PageTitle title="POS Shifts" />
          <Breadcrumb breadcrumbs={[{ title: "Smart Supermarket", href: "/supermarket" }, { title: "POS Shifts" }]} />
        </Box>
        <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={() => setOpenDialog(true)}>Open Shift</Button>
      </Box>

      {isLoading ? <PageLoader /> : (
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead sx={{ backgroundColor: "var(--pallet-lighter-blue)" }}>
              <TableRow>
                <TableCell>Cashier</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>End</TableCell>
                <TableCell align="right">Opening Float</TableCell>
                <TableCell align="right">Variance</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(shifts ?? []).map((s: any) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.user?.name}</TableCell>
                  <TableCell>{new Date(s.shift_start).toLocaleString()}</TableCell>
                  <TableCell>{s.shift_end ? new Date(s.shift_end).toLocaleString() : "—"}</TableCell>
                  <TableCell align="right">{s.opening_float}</TableCell>
                  <TableCell align="right">{s.variance ?? "—"}</TableCell>
                  <TableCell align="center">
                    <Chip label={s.status} size="small" color={s.status === "open" ? "success" : "default"} />
                  </TableCell>
                  <TableCell align="center">
                    {s.status === "open" && (
                      <Button size="small" variant="outlined" color="warning" startIcon={<StopIcon />} onClick={() => setCloseDialogId(s.id)}>
                        Close
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!shifts || shifts.length === 0) && (
                <TableRow><TableCell colSpan={7} align="center"><Typography variant="body2">No shifts recorded yet.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Open Shift</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Opening Float" type="number" fullWidth value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={openMutation.isPending || !user?.id}
            onClick={() => openMutation.mutate({ user_id: Number(user!.id), opening_float: Number(openingFloat) || 0 })}
          >
            {openMutation.isPending ? "Opening..." : "Open Shift"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={closeDialogId !== null} onClose={() => setCloseDialogId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Close Shift — Cash Up</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Expected Cash" type="number" fullWidth value={closingExpected} onChange={(e) => setClosingExpected(e.target.value)} />
            <TextField label="Counted Cash" type="number" fullWidth value={closingCounted} onChange={(e) => setClosingCounted(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDialogId(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={closeMutation.isPending}
            onClick={() => closeMutation.mutate({
              id: closeDialogId!,
              data: { closing_expected: Number(closingExpected) || 0, closing_counted: Number(closingCounted) || 0 },
            })}
          >
            {closeMutation.isPending ? "Closing..." : "Close Shift"}
          </Button>
        </DialogActions>
      </Dialog>
    </FormPageLayout>
  );
}
