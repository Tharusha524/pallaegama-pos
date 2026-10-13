import api from "../apiClient";

const API_URL = "/mobile-promotions";

export type PromoType = "promotion" | "offer" | "discount";
export type PromoDiscountType = "percent" | "fixed" | null;

export interface MobilePromotion {
  id: number;
  title: string;
  description: string | null;
  promo_type: PromoType;
  discount_type: PromoDiscountType;
  discount_value: number | null;
  valid_from: string;
  valid_to: string;
  image_path: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  sms_sent_at: string | null;
  sms_sent_count: number;
}

export interface MobilePromotionInput {
  title: string;
  description: string;
  promo_type: PromoType;
  discount_type: PromoDiscountType;
  discount_value: string;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
  sort_order: string;
  image?: File | null;
  remove_image?: boolean;
}

const toFormData = (input: MobilePromotionInput): FormData => {
  const fd = new FormData();
  fd.append("title", input.title);
  fd.append("description", input.description ?? "");
  fd.append("promo_type", input.promo_type);
  if (input.discount_type) {
    fd.append("discount_type", input.discount_type);
    fd.append("discount_value", input.discount_value || "0");
  }
  fd.append("valid_from", input.valid_from);
  fd.append("valid_to", input.valid_to);
  fd.append("is_active", input.is_active ? "1" : "0");
  fd.append("sort_order", input.sort_order || "0");
  if (input.image) fd.append("image", input.image);
  if (input.remove_image) fd.append("remove_image", "1");
  return fd;
};

const multipart = { headers: { "Content-Type": "multipart/form-data" } };

export const getMobilePromotions = async (): Promise<MobilePromotion[]> => {
  const response = await api.get(API_URL);
  return response.data;
};

export const createMobilePromotion = async (input: MobilePromotionInput): Promise<MobilePromotion> => {
  const response = await api.post(API_URL, toFormData(input), multipart);
  return response.data;
};

export const updateMobilePromotion = async (id: number, input: MobilePromotionInput): Promise<MobilePromotion> => {
  const response = await api.post(`${API_URL}/${id}`, toFormData(input), multipart);
  return response.data;
};

export const deleteMobilePromotion = async (id: number): Promise<void> => {
  await api.delete(`${API_URL}/${id}`);
};

export const getSmsRecipientCount = async (): Promise<number> => {
  const response = await api.get(`${API_URL}/sms-recipient-count`);
  return Number(response.data?.count ?? 0);
};

export const sendMobilePromotionSms = async (
  id: number,
  message?: string
): Promise<{ sent: number; failed: number; total: number }> => {
  const response = await api.post(`${API_URL}/${id}/send-sms`, message ? { message } : {});
  return response.data;
};
