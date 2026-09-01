import api from "../apiClient";

// ---- Loyalty Tiers ----
export const getLoyaltyTiers = async () => (await api.get("/loyalty-tiers")).data;
export const createLoyaltyTier = async (data: any) => (await api.post("/loyalty-tiers", data)).data;
export const updateLoyaltyTier = async (id: number | string, data: any) =>
  (await api.put(`/loyalty-tiers/${id}`, data)).data;
export const deleteLoyaltyTier = async (id: number | string) =>
  (await api.delete(`/loyalty-tiers/${id}`)).data;

// ---- Loyalty Cards ----
export const getLoyaltyCards = async () => (await api.get("/loyalty-cards")).data;
export const getLoyaltyCard = async (id: number | string) => (await api.get(`/loyalty-cards/${id}`)).data;
export const createLoyaltyCard = async (data: any) => (await api.post("/loyalty-cards", data)).data;
export const updateLoyaltyCard = async (id: number | string, data: any) =>
  (await api.put(`/loyalty-cards/${id}`, data)).data;
export const deleteLoyaltyCard = async (id: number | string) =>
  (await api.delete(`/loyalty-cards/${id}`)).data;

// ---- Loyalty Points ----
export const earnLoyaltyPoints = async (data: { debtor_no: number; amount_spent: number }) =>
  (await api.post("/loyalty-points/earn", data)).data;
export const redeemLoyaltyPoints = async (data: { debtor_no: number; points: number }) =>
  (await api.post("/loyalty-points/redeem", data)).data;
export const getLoyaltyPointsHistory = async (debtorNo: number | string) =>
  (await api.get(`/loyalty-points/${debtorNo}/history`)).data;

// ---- Offers ----
export const getOffers = async () => (await api.get("/offers")).data;
export const createOffer = async (data: any) => (await api.post("/offers", data)).data;
export const updateOffer = async (id: number | string, data: any) => (await api.put(`/offers/${id}`, data)).data;
export const deleteOffer = async (id: number | string) => (await api.delete(`/offers/${id}`)).data;
export const getApplicableOffers = async (params: { debtor_no?: number; stock_id?: string; category_id?: string }) =>
  (await api.get("/offers-applicable", { params })).data;
export const getOfferPopularity = async () => (await api.get("/offers-popularity")).data;

// ---- Win-Back Campaigns ----
export const getInactiveCustomers = async (days = 30) =>
  (await api.get("/win-back/inactive-customers", { params: { days } })).data;
export const sendWinBackOffer = async (data: { debtor_no: number; offer_id?: number; channel: "sms" | "whatsapp"; message?: string }) =>
  (await api.post("/win-back/send", data)).data;
export const getWinBackHistory = async () => (await api.get("/win-back/history")).data;
export const markWinBackRedeemed = async (id: number | string) =>
  (await api.post(`/win-back/${id}/mark-redeemed`)).data;
