import api from "../apiClient";

// Finance -> Credit Customers / Credit Payments (POS credit sales).
export const getCreditCustomers = async () => (await api.get("/credit-customers")).data;
export const getCreditOpenBills = async (debtorNo: number | string) =>
  (await api.get(`/credit-customers/${debtorNo}/open-bills`)).data;
export const setCreditLimit = async (debtorNo: number | string, creditLimit: number) =>
  (await api.put(`/credit-customers/${debtorNo}/credit-limit`, { credit_limit: creditLimit })).data;
export const postOpeningCreditBalance = async (
  debtorNo: number | string,
  data: { amount: number; credit_account: string; tran_date: string; memo?: string }
) => (await api.post(`/credit-customers/${debtorNo}/opening-balance`, data)).data;
