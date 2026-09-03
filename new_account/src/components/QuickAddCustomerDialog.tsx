import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, Alert, CircularProgress,
} from "@mui/material";
import { createCustomer } from "../api/Customer/AddCustomerApi";
import { createBranch } from "../api/CustomerBranch/CustomerBranchApi";
import { getCurrencies } from "../api/Currency/currencyApi";
import { getSalesTypes } from "../api/SalesMaintenance/salesService";
import { getCreditStatusSetups } from "../api/CreditStatusSetup/CreditStatusSetupApi";
import { getPaymentTerms } from "../api/PaymentTerm/PaymentTermApi";
import { getInventoryLocations } from "../api/InventoryLocation/InventoryLocationApi";
import { getSysPrefs } from "../api/OrganizationSettings/SysPrefsApi";
import { notify } from "../services/notificationService";
import { getFriendlyApiErrorMessage } from "../utils/apiErrorMessage";

interface QuickAddCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: any) => void;
}

/**
 * A fast path onto the SAME customer-creation process the full "Add Customer"
 * screen uses (createCustomer → /debtors-master, then createBranch) — just a
 * smaller form. No separate/bypassed logic: same required fields, same
 * backend validation, same branch-setup step a real checkout needs.
 * Sensible system defaults (currency, sales type, credit status, payment
 * terms, inventory location) are picked automatically so the cashier only
 * has to type the customer's name and phone.
 */
export default function QuickAddCustomerDialog({ open, onClose, onCreated }: QuickAddCustomerDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const { data: currencies } = useQuery({ queryKey: ["currencies"], queryFn: getCurrencies, enabled: open });
  const { data: salesTypes } = useQuery({ queryKey: ["sales-types"], queryFn: getSalesTypes, enabled: open });
  const { data: creditStatuses } = useQuery({ queryKey: ["credit-status-setups"], queryFn: getCreditStatusSetups, enabled: open });
  const { data: paymentTerms } = useQuery({ queryKey: ["payment-terms"], queryFn: getPaymentTerms, enabled: open });
  const { data: locations } = useQuery({ queryKey: ["inventory-locations"], queryFn: getInventoryLocations, enabled: open });

  const createMutation = useMutation({
    mutationFn: async () => {
      const defaultCurrency = currencies?.[0];
      const defaultSalesType = salesTypes?.[0];
      const defaultCreditStatus =
        (creditStatuses ?? []).find((c: any) => !c.disallow_invoices) ?? creditStatuses?.[0];
      const defaultPaymentTerm =
        (paymentTerms ?? []).find((p: any) => /cash/i.test(p.description)) ?? paymentTerms?.[0];
      const defaultLocation = locations?.[0];

      if (!defaultCurrency || !defaultSalesType || !defaultCreditStatus || !defaultPaymentTerm) {
        throw new Error("Basic setup (currency, sales type, credit status, or payment terms) is missing — set these up under Setup first.");
      }

      const customer = await createCustomer({
        name: name.trim(),
        debtor_ref: name.trim(),
        address: "",
        gst: "",
        curr_code: defaultCurrency.currency_abbreviation,
        sales_type: defaultSalesType.id,
        credit_status: defaultCreditStatus.id,
        payment_terms: defaultPaymentTerm.terms_indicator,
        discount: 0,
        pymt_discount: 0,
        credit_limit: 0,
        notes: "",
        cost_center_id: 0,
        cost_center2_id: 0,
        inactive: 0,
        mobile: phone.trim() || null,
      });

      // A checkout can't resolve a branch for a customer that has none —
      // create the default branch the same way the full Add Customer screen does.
      const sysPrefs = await getSysPrefs();
      const getPref = (prefName: string) => sysPrefs.find((p: any) => p.name === prefName)?.value || "";

      await createBranch({
        debtor_no: customer.debtor_no,
        br_name: `${name.trim()} Main Branch`,
        branch_ref: name.trim(),
        br_address: name.trim(),
        inventory_location: defaultLocation?.loc_code || null,
        sales_account: getPref("salesAccount"),
        sales_discount_account: getPref("salesDiscountAccount"),
        receivables_account: getPref("receivableAccount"),
        payment_discount_account: getPref("promptPaymentDiscountAccount"),
        contact_person: name.trim(),
        inactive: false,
      });

      return customer;
    },
    onSuccess: (customer) => {
      notify.success(`Customer "${customer.name}" added`);
      onCreated(customer);
      setName("");
      setPhone("");
      onClose();
    },
    onError: (error) => {
      notify.error(getFriendlyApiErrorMessage(error) || (error as Error)?.message || "Failed to add customer");
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add New Customer</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info" sx={{ py: 0.5 }}>
            Uses the same customer setup as the full Add Customer screen — just the essentials for a fast checkout.
          </Alert>
          <TextField
            label="Customer Name" size="small" fullWidth autoFocus required
            value={name} onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="Mobile Number" size="small" fullWidth
            value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="07XXXXXXXX"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!name.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          startIcon={createMutation.isPending ? <CircularProgress size={16} /> : undefined}
        >
          {createMutation.isPending ? "Adding..." : "Add Customer"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
