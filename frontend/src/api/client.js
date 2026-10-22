import axios from 'axios';
import toast from 'react-hot-toast';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach Authorization token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cf_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for automatic error toast & 401 handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || 'An error occurred';

    if (status === 401) {
      localStorage.removeItem('cf_token');
      localStorage.removeItem('cf_user');
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/verify')) {
        window.location.href = '/login';
      }
    }

    // Don't toast for expected 404s on verify or report polling
    if (status !== 404 || !error.config.url.includes('/verify/')) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

// --- Auth Endpoints ---
export const loginStudent = (email, password, fullName, regNo) => api.post('/auth/student-login', { email, password, fullName, regNo }).then(r => r.data);
export const registerStudent = (data) => api.post('/auth/student-register', data).then(r => r.data);
export const loginStaff = (email, password) => api.post('/auth/staff-login', { email, password }).then(r => r.data);
export const loginAdmin = (email, password) => api.post('/auth/admin-login', { email, password }).then(r => r.data);
export const completeProfile = (regNo) => api.post('/auth/complete-profile', { regNo }).then(r => r.data);
export const getMe = () => api.get('/auth/me').then(r => r.data);
export const logoutUser = () => api.post('/auth/logout').then(r => r.data);

// --- Meta & Public ---
export const getMeta = () => api.get('/meta').then(r => r.data);
export const getHealth = () => api.get('/health').then(r => r.data);
export const verifyLetterCode = (code) => api.get(`/public/verify/${code}`).then(r => r.data);

// --- Student Reports ---
export const createReport = (data) => api.post('/reports', data).then(r => r.data);
export const getMyReports = (params) => api.get('/reports/mine', { params }).then(r => r.data);
export const getReportById = (id) => api.get(`/reports/${id}`).then(r => r.data);
export const withdrawReport = (id) => api.post(`/reports/${id}/withdraw`).then(r => r.data);
export const declareNotFound = (id) => api.post(`/reports/${id}/not-found`).then(r => r.data);

// --- Found Items (Staff) ---
export const logFoundItem = (formData) =>
  api.post('/found-items', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data);

export const getFoundItems = (params) => api.get('/found-items', { params }).then(r => r.data);
export const getFoundItemById = (id) => api.get(`/found-items/${id}`).then(r => r.data);
export const updateFoundItem = (id, data) => api.patch(`/found-items/${id}`, data).then(r => r.data);
export const disposeItem = (id, data) => api.post(`/found-items/${id}/dispose`, data).then(r => r.data);
export const markHandedOver = (id) => api.post(`/found-items/${id}/handed-over`).then(r => r.data);

// --- Staff Not-Found Cases & Room Visits ---
export const getStaffNotFoundCases = (params) => api.get('/staff/not-found-cases', { params }).then(r => r.data);
export const recordRoomVisit = (data) => api.post('/room-visits', data).then(r => r.data);
export const getRoomVisits = (params) => api.get('/room-visits', { params }).then(r => r.data);

// --- Faculty Endpoints ---
export const getFacultyQueue = (params) => api.get('/faculty/queue', { params }).then(r => r.data);
export const getCaseDossier = (reportId) => api.get(`/faculty/cases/${reportId}`).then(r => r.data);
export const updateMatchStatus = (matchId, status) => api.patch(`/matches/${matchId}`, { status }).then(r => r.data);
export const createManualMatch = (data) => api.post('/matches', data).then(r => r.data);
export const scheduleVerification = (data) => api.post('/verifications', data).then(r => r.data);
export const completeVerification = (id, data) => api.post(`/verifications/${id}/complete`, data).then(r => r.data);
export const toggleAvailability = (isAvailable) => api.patch('/faculty/me/availability', { isAvailable }).then(r => r.data);
export const getTheftCases = () => api.get('/faculty/theft-cases').then(r => r.data);
export const acknowledgeTheftCase = (reportId, notes) => api.post(`/faculty/theft-cases/${reportId}/acknowledge`, { notes }).then(r => r.data);

// --- Letters & PDFs ---
export const getHandoverPdfUrl = (verificationId) => `${baseURL}/letters/${verificationId}/pdf`;
export const downloadHandoverPdf = async (verificationId, letterNo = 'Handover') => {
  const token = localStorage.getItem('cf_token');
  const res = await fetch(`${baseURL}/letters/${verificationId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to download PDF');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Handover_${letterNo}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

// --- Notifications ---
export const getNotifications = (params) => api.get('/notifications', { params }).then(r => r.data);
export const getUnreadNotificationsCount = () => api.get('/notifications/count').then(r => r.data);
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`).then(r => r.data);
export const markAllNotificationsRead = () => api.post('/notifications/read-all').then(r => r.data);

// --- Admin Endpoints ---
export const getAdminStats = () => api.get('/admin/stats').then(r => r.data);
export const getAdminUsers = (params) => api.get('/admin/users', { params }).then(r => r.data);
export const createAdminUser = (data) => api.post('/admin/users', data).then(r => r.data);
export const updateAdminUser = (id, data) => api.patch(`/admin/users/${id}`, data).then(r => r.data);
export const getHierarchyTree = () => api.get('/admin/hierarchy').then(r => r.data);
export const getOverdueCases = () => api.get('/admin/overdue').then(r => r.data);
export const getAllReportsAdmin = (params) => api.get('/admin/reports', { params }).then(r => r.data);
export const reassignReport = (reportId, toUserId) => api.post(`/admin/reports/${reportId}/reassign`, { toUserId }).then(r => r.data);
export const closeReportAdmin = (reportId) => api.post(`/admin/reports/${reportId}/close`).then(r => r.data);

export const getSystemSettings = () => api.get('/admin/settings').then(r => r.data);
export const updateSystemSetting = (key, settingValue) => api.put(`/admin/settings/${key}`, { settingValue }).then(r => r.data);

export const getCategories = () => api.get('/admin/categories').then(r => r.data);
export const createCategory = (data) => api.post('/admin/categories', data).then(r => r.data);
export const updateCategory = (id, data) => api.patch(`/admin/categories/${id}`, data).then(r => r.data);

export const getLocations = () => api.get('/admin/locations').then(r => r.data);
export const createLocation = (data) => api.post('/admin/locations', data).then(r => r.data);
export const updateLocation = (id, data) => api.patch(`/admin/locations/${id}`, data).then(r => r.data);

export const getDesignations = () => api.get('/admin/designations').then(r => r.data);
export const createDesignation = (data) => api.post('/admin/designations', data).then(r => r.data);

export const getAuditLogs = (params) => api.get('/admin/audit-logs', { params }).then(r => r.data);
export const runAdminJobs = () => api.post('/admin/jobs/run').then(r => r.data);
