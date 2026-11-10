import api from "../apiClient";

const API_URL = "/subcategories";

export const getSubcategories = async (categoryId?: number) =>
  (await api.get(API_URL, { params: categoryId ? { category_id: categoryId } : undefined })).data;

export const createSubcategory = async (data: { category_id: number; name: string }) =>
  (await api.post(API_URL, data)).data;

export const updateSubcategory = async (id: number, data: { category_id: number; name: string }) =>
  (await api.put(`${API_URL}/${id}`, data)).data;

export const deleteSubcategory = async (id: number) => (await api.delete(`${API_URL}/${id}`)).data;
