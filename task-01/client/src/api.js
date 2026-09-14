import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
});

export const getProducts = () => api.get('/products').then((r) => r.data);
export const createProduct = (data) => api.post('/products', data).then((r) => r.data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data).then((r) => r.data);
export const deleteProduct = (id) => api.delete(`/products/${id}`).then((r) => r.data);

export const getOrders = () => api.get('/orders').then((r) => r.data);
export const createOrder = (data) => api.post('/orders', data).then((r) => r.data);
export const cancelOrder = (id) => api.post(`/orders/${id}/cancel`).then((r) => r.data);
export const payOrder = (id, data) => api.post(`/orders/${id}/pay`, data).then((r) => r.data);

export default api;