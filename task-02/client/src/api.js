import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const getProducts = (params) => api.get('/products', { params }).then((r) => r.data);
export const getCategories = () => api.get('/products/categories').then((r) => r.data);
export const getProduct = (id) => api.get(`/products/${id}`).then((r) => r.data);

export const checkout = (data) => api.post('/orders/checkout', data).then((r) => r.data);
export const payOrder = (id, data) => api.post(`/orders/${id}/pay`, data).then((r) => r.data);
export const cancelOrder = (id) => api.post(`/orders/${id}/cancel`).then((r) => r.data);
export const refundOrder = (id) => api.post(`/orders/${id}/refund`).then((r) => r.data);
export const getOrderHistory = (userId) => api.get(`/orders/history/${userId}`).then((r) => r.data);

export default api;
