import api from "../apiClient";

const API_URL = "/brands";

export const getBrands = async () => (await api.get(API_URL)).data;
export const createBrand = async (data: { name: string }) => (await api.post(API_URL, data)).data;
export const updateBrand = async (id: number, data: { name: string }) => (await api.put(`${API_URL}/${id}`, data)).data;
export const deleteBrand = async (id: number) => (await api.delete(`${API_URL}/${id}`)).data;
