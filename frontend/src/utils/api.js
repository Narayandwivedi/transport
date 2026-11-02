import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050/api';
// Uploaded files are served next to the API: http://host:5050/uploads/...
export const FILE_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const onAuthPage = window.location.pathname === '/login';
    if (error.response?.status === 401 && !onAuthPage && !error.config?.url?.startsWith('/auth/')) {
      window.location.href = '/login';
    }
    return Promise.reject({ message: error.response?.data?.message || error.message || 'Something went wrong' });
  }
);

export default apiClient;
