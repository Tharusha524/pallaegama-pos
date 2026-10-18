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

// ---- Loyalty Phone Lookup ----
export const getLoyaltyByPhone = async (phone: string) =>
  (await api.get(`/loyalty-cards/by-phone/${encodeURIComponent(phone)}`)).data;
export const registerLoyaltyByPhone = async (data: { name: string; mobile: string; loyalty_tier_id?: number | null }) =>
  (await api.post("/loyalty-cards/register-by-phone", data)).data;

// ---- Loyalty Points ----
export const earnLoyaltyPoints = async (data: { debtor_no: number; amount_spent: number }) =>
  (await api.post("/loyalty-points/earn", data)).data;
export const redeemLoyaltyPoints = async (data: { debtor_no: number; points: number; debtor_trans_no?: number; debtor_trans_type?: number }) =>
  (await api.post("/loyalty-points/redeem", data)).data;
export const getLoyaltyPointsHistory = async (debtorNo: number | string) =>
  (await api.get(`/loyalty-points/${debtorNo}/history`)).data;

// ---- Offers ----
export interface OfferInput {
  offer_name: string;
  coupon_code?: string;
  offer_type: string;
  target_id?: string;
  discount_type: string;
  discount_value: number;
  valid_from: string;
  valid_to: string;
  min_purchase_amount?: number;
  max_total_uses?: number;
  max_uses_per_customer?: number;
  status?: string;
  image?: File | null;
  remove_image?: boolean;
}

const toOfferFormData = (data: OfferInput): FormData => {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => {
    if (k === "image") {
      if (v instanceof File) fd.append("image", v);
    } else if (k === "remove_image") {
      if (v) fd.append("remove_image", "1");
    } else if (v !== undefined && v !== null) {
      fd.append(k, String(v));
    }
  });
  return fd;
};

const multipart = { headers: { "Content-Type": "multipart/form-data" } };

export const getOffers = async () => (await api.get("/offers")).data;
export const createOffer = async (data: OfferInput) =>
  (await api.post("/offers", toOfferFormData(data), multipart)).data;
// PHP can't read multipart bodies on PUT, so send POST + _method=PUT (Laravel method spoofing).
export const updateOffer = async (id: number | string, data: OfferInput) => {
  const fd = toOfferFormData(data);
  fd.append("_method", "PUT");
  return (await api.post(`/offers/${id}`, fd, multipart)).data;
};
export const deleteOffer = async (id: number | string) => (await api.delete(`/offers/${id}`)).data;
export const getApplicableOffers = async (params: { debtor_no?: number; stock_id?: string; category_id?: string }) =>
  (await api.get("/offers-applicable", { params })).data;
export const getOfferPopularity = async () => (await api.get("/offers-popularity")).data;

// ---- Win-Back Campaigns ----
export const getInactiveCustomers = async (
  days = 30,
  params?: { page?: number; per_page?: number; search?: string }
) =>
  (await api.get("/win-back/inactive-customers", { params: { days, ...params } })).data;
export const sendWinBackOffer = async (data: { debtor_no: number; offer_id?: number; channel: "sms" | "whatsapp"; message?: string }) =>
  (await api.post("/win-back/send", data)).data;
export const getWinBackHistory = async () => (await api.get("/win-back/history")).data;
export const markWinBackRedeemed = async (id: number | string) =>
  (await api.post(`/win-back/${id}/mark-redeemed`)).data;
