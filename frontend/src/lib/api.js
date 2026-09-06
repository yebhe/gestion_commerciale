import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const BACKEND_URL = API_URL.replace(/\/api\/?$/, '');

export const mediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${BACKEND_URL}${path}`;
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer le rafraîchissement du token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post(`${API_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });
        
        const { access } = response.data;
        localStorage.setItem('access_token', access);
        
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Se déconnecter uniquement si le serveur refuse explicitement le refresh.
        // En cas d'erreur réseau (hors ligne), on conserve les tokens pour réessayer plus tard.
        const refreshStatus = refreshError.response?.status;
        if (refreshStatus === 401 || refreshStatus === 403) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) =>
    api.post('/auth/login/', { email, password }),
  
  register: (data) =>
    api.post('/auth/register/', data),
  
  getProfile: () =>
    api.get('/auth/profile/'),
  
  updateProfile: (data) =>
    api.put('/auth/profile/', data),
  
  getPermissions: () =>
    api.get('/auth/permissions/'),

  switchCompany: (companyUuid) =>
    api.post('/auth/switch-company/', { company_uuid: companyUuid }),
};

export const companiesAPI = {
  getMyCompanies: () =>
    api.get('/companies/my/'),

  getAllCompanies: () =>
    api.get('/companies/all/'),

  getCurrent: () =>
    api.get('/companies/current/'),

  updateCurrent: (data) =>
    api.patch('/companies/current/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const settingsAPI = {
  getSettings: (storeUuid) =>
    api.get('/settings/', { params: storeUuid ? { store: storeUuid } : {} }),

  updateSettings: (data) =>
    api.patch('/settings/', data),
};

export const storesAPI = {
  list: (page, search = '') =>
    api.get('/companies/stores/', { params: { page: page || 1, ...(search && { search }) } }),

  create: (formData) =>
    api.post('/companies/stores/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (uuid, formData) =>
    api.patch(`/companies/stores/${uuid}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  remove: (uuid) =>
    api.delete(`/companies/stores/${uuid}/`),
};

export const categoriesAPI = {
  list: (page, search = '', store = '') =>
    api.get('/products/categories/', { params: { page: page || 1, ...(search && { search }), ...(store && { store }) } }),

  create: (data) =>
    api.post('/products/categories/', data),

  update: (uuid, data) =>
    api.patch(`/products/categories/${uuid}/`, data),

  remove: (uuid) =>
    api.delete(`/products/categories/${uuid}/`),
};

export const productsAPI = {
  list: (page, search = '', store = '') =>
    api.get('/products/', { params: { page: page || 1, ...(search && { search }), ...(store && { store }) } }),

  create: (formData) =>
    api.post('/products/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (uuid, formData) =>
    api.patch(`/products/${uuid}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  remove: (uuid) =>
    api.delete(`/products/${uuid}/`),
};

export const customersAPI = {
  list: (page, search = '') =>
    api.get('/customers/', { params: { page: page || 1, ...(search && { search }) } }),

  create: (data) =>
    api.post('/customers/', data),

  update: (uuid, data) =>
    api.patch(`/customers/${uuid}/`, data),

  remove: (uuid) =>
    api.delete(`/customers/${uuid}/`),
};

export const suppliersAPI = {
  list: (page, search = '') =>
    api.get('/suppliers/', { params: { page: page || 1, ...(search && { search }) } }),

  create: (data) =>
    api.post('/suppliers/', data),

  update: (uuid, data) =>
    api.patch(`/suppliers/${uuid}/`, data),

  remove: (uuid) =>
    api.delete(`/suppliers/${uuid}/`),
};

export const salesAPI = {
  list: (page, search = '') =>
    api.get('/sales/', { params: { page: page || 1, ...(search && { search }) } }),

  create: (data) =>
    api.post('/sales/', data),

  retrieve: (uuid) =>
    api.get(`/sales/${uuid}/`),

  update: (uuid, data) =>
    api.patch(`/sales/${uuid}/`, data),

  remove: (uuid) =>
    api.delete(`/sales/${uuid}/`),

  initiateMobileMoney: (uuid) =>
    api.post(`/sales/${uuid}/mobile-money/`),
};

export const inventoryAPI = {
  list: (page, search = '') =>
    api.get('/inventory/', { params: { page: page || 1, ...(search && { search }) } }),

  create: (data) =>
    api.post('/inventory/', data),

  transfer: (data) =>
    api.post('/inventory/transfer/', data),

  update: (uuid, data) =>
    api.patch(`/inventory/${uuid}/`, data),

  remove: (uuid) =>
    api.delete(`/inventory/${uuid}/`),
};

export const filesAPI = {
  list: (page, search = '', store = '') =>
    api.get('/files/', { params: { page: page || 1, ...(search && { search }), ...(store && { store }) } }),

  create: (formData) =>
    api.post('/files/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (uuid, data) =>
    api.patch(`/files/${uuid}/`, data),

  remove: (uuid) =>
    api.delete(`/files/${uuid}/`),
};

export const rolesAPI = {
  list: (page, search = '') =>
    api.get('/auth/roles/', { params: { page: page || 1, ...(search && { search }) } }),

  create: (data) =>
    api.post('/auth/roles/', data),

  update: (uuid, data) =>
    api.patch(`/auth/roles/${uuid}/`, data),

  remove: (uuid) =>
    api.delete(`/auth/roles/${uuid}/`),

  assignPermissions: (uuid, permissionCodes) =>
    api.post(`/auth/roles/${uuid}/assign-permissions/`, { permission_codes: permissionCodes }),

  allPermissions: () =>
    api.get('/auth/all-permissions/'),
};

export const employeesAPI = {
  list: (page, search = '') =>
    api.get('/auth/employees/', { params: { page: page || 1, ...(search && { search }) } }),

  create: (data) =>
    api.post('/auth/employees/', data),

  update: (uuid, data) =>
    api.patch(`/auth/employees/${uuid}/`, data),

  remove: (uuid) =>
    api.delete(`/auth/employees/${uuid}/`),
};

export const auditAPI = {
  list: (page, search = '') =>
    api.get('/audit/', { params: { page: page || 1, ...(search && { search }) } }),
};

export const reportsAPI = {
  sales: (params = {}) =>
    api.get('/reports/sales/', { params }),

  inventory: (params = {}) =>
    api.get('/reports/inventory/', { params }),

  export: (params = {}) =>
    api.get('/reports/export/', { params, responseType: 'blob' }),
};

export default api;
