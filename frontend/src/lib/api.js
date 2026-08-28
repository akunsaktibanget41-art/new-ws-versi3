import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
export const API = `${BASE}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// ============ AUTH ============
export const authRegister = (p) => api.post("/auth/register", p).then((r) => r.data);
export const authLogin = (p) => api.post("/auth/login", p).then((r) => r.data);
export const authGoogleSession = (session_id) => api.post("/auth/google/session", { session_id }).then((r) => r.data);
export const authMe = () => api.get("/auth/me").then((r) => r.data);
export const authLogout = () => api.post("/auth/logout").then((r) => r.data);
export const listUsers = (status) => api.get("/auth/users", { params: status ? { status } : {} }).then((r) => r.data);
export const updateUserAcc = (id, p) => api.put(`/auth/users/${id}`, p).then((r) => r.data);
export const deleteUserAcc = (id) => api.delete(`/auth/users/${id}`).then((r) => r.data);
export const updateProfile = (p) => api.put("/auth/profile", p).then((r) => r.data);
export const createUserAcc = (p) => api.post("/auth/users", p).then((r) => r.data);
export const resetUserPassword = (id, new_password) => api.put(`/auth/users/${id}/password`, { new_password }).then((r) => r.data);

// ============ SEARCH ============
export const globalSearch = (q) => api.get("/search", { params: { q } }).then((r) => r.data);

// ============ MONITORING ============
export const monitoringDeadline = (params = {}) => api.get("/monitoring/deadline-radar", { params }).then((r) => r.data);
export const monitoringWorkload = (params = {}) => api.get("/monitoring/workload", { params }).then((r) => r.data);
export const monitoringCompliance = (params = {}) => api.get("/monitoring/amaliyah-compliance", { params }).then((r) => r.data);
export const monitoringStagnant = (params = {}) => api.get("/monitoring/stagnant-tasks", { params }).then((r) => r.data);
export const monitoringDivProgress = () => api.get("/monitoring/division-progress").then((r) => r.data);
export const monitoringUser = (anggotaId, params = {}) => api.get(`/monitoring/user/${anggotaId}`, { params }).then((r) => r.data);

// ============ DASHBOARD ============
export const dashboardDigest = () => api.get("/dashboard/digest").then((r) => r.data);

// ============ STRATEGY & EXECUTION ============
export const strategyListPeriods = () => api.get("/strategy/periods").then((r) => r.data);
export const strategyActivePeriod = () => api.get("/strategy/periods/active").then((r) => r.data);
export const strategyCreatePeriod = (p) => api.post("/strategy/periods", p).then((r) => r.data);
export const strategyUpdatePeriod = (id, p) => api.put(`/strategy/periods/${id}`, p).then((r) => r.data);
export const strategyDeletePeriod = (id) => api.delete(`/strategy/periods/${id}`).then((r) => r.data);
export const strategyActivatePeriod = (id) => api.post(`/strategy/periods/${id}/activate`).then((r) => r.data);

export const strategyDashboard = (periodId) => api.get("/strategy/dashboard", { params: { period_id: periodId } }).then((r) => r.data);

// Vision/Mission
export const visionGet = (periodId) => api.get("/strategy/vision", { params: { period_id: periodId } }).then((r) => r.data);
export const visionUpsert = (periodId, p) => api.put("/strategy/vision", p, { params: { period_id: periodId } }).then((r) => r.data);

// Komitmen PDF URL builder
export const komitmenPdfUrl = (periodId, divisiId) => `${API}/strategy/komitmen.pdf?period_id=${periodId}&divisi_id=${divisiId}`;

export const bscList = (periodId) => api.get("/strategy/bsc", { params: { period_id: periodId } }).then((r) => r.data);
export const bscCreate = (p) => api.post("/strategy/bsc", p).then((r) => r.data);
export const bscUpdate = (id, p) => api.put(`/strategy/bsc/${id}`, p).then((r) => r.data);
export const bscDelete = (id) => api.delete(`/strategy/bsc/${id}`).then((r) => r.data);

export const okrList = (periodId, params = {}) => api.get("/strategy/okr", { params: { period_id: periodId, ...params } }).then((r) => r.data);
export const okrCreate = (p) => api.post("/strategy/okr", p).then((r) => r.data);
export const okrUpdate = (id, p) => api.put(`/strategy/okr/${id}`, p).then((r) => r.data);
export const okrDelete = (id) => api.delete(`/strategy/okr/${id}`).then((r) => r.data);
export const krCreate = (okrId, p) => api.post(`/strategy/okr/${okrId}/keyresults`, p).then((r) => r.data);
export const krUpdate = (okrId, krId, p) => api.put(`/strategy/okr/${okrId}/keyresults/${krId}`, p).then((r) => r.data);
export const krDelete = (okrId, krId) => api.delete(`/strategy/okr/${okrId}/keyresults/${krId}`).then((r) => r.data);

export const kpiList = (periodId) => api.get("/strategy/kpi", { params: { period_id: periodId } }).then((r) => r.data);
export const kpiCreate = (p) => api.post("/strategy/kpi", p).then((r) => r.data);
export const kpiUpdate = (id, p) => api.put(`/strategy/kpi/${id}`, p).then((r) => r.data);
export const kpiDelete = (id) => api.delete(`/strategy/kpi/${id}`).then((r) => r.data);

export const projectsList = (periodId) => api.get("/strategy/projects", { params: { period_id: periodId } }).then((r) => r.data);
export const projectCreate = (p) => api.post("/strategy/projects", p).then((r) => r.data);
export const projectUpdate = (id, p) => api.put(`/strategy/projects/${id}`, p).then((r) => r.data);
export const projectDelete = (id) => api.delete(`/strategy/projects/${id}`).then((r) => r.data);
export const projectLinkTasks = (id, task_ids) => api.post(`/strategy/projects/${id}/link-tasks`, { task_ids }).then((r) => r.data);
export const projectUnlinkTask = (id, task_ids) => api.post(`/strategy/projects/${id}/unlink-task`, { task_ids }).then((r) => r.data);

// ============ RAPORT PDF ============
export const raportExportPdfUrl = (start, end, anggotaId) => {
  const qs = new URLSearchParams();
  if (start) qs.set("start", start);
  if (end) qs.set("end", end);
  if (anggotaId) qs.set("anggota_id", anggotaId);
  return `${API}/raport/export.pdf${qs.toString() ? `?${qs}` : ""}`;
};

// Tasks
export const listTasks = (params = {}) => api.get("/tasks", { params }).then((r) => r.data);
export const createTask = (payload) => api.post("/tasks", payload).then((r) => r.data);
export const updateTask = (id, payload) => api.put(`/tasks/${id}`, payload).then((r) => r.data);
export const deleteTask = (id) => api.delete(`/tasks/${id}`).then((r) => r.data);
export const archiveTask = (id) => api.post(`/tasks/${id}/archive`).then((r) => r.data);
export const unarchiveTask = (id) => api.post(`/tasks/${id}/unarchive`).then((r) => r.data);
export const moveTask = (id, payload) => api.post(`/tasks/${id}/move`, payload).then((r) => r.data);
export const revisiTask = (id, catatan) => api.post(`/tasks/${id}/revisi`, { catatan }).then((r) => r.data);
export const bulkDeleteTasks = (ids) => api.post(`/tasks/bulk_delete`, { ids }).then((r) => r.data);

// Divisi (Tim)
export const listDivisi = () => api.get("/divisi").then((r) => r.data);
export const createDivisi = (p) => api.post("/divisi", p).then((r) => r.data);
export const updateDivisi = (id, p) => api.put(`/divisi/${id}`, p).then((r) => r.data);
export const deleteDivisi = (id) => api.delete(`/divisi/${id}`).then((r) => r.data);

// Kategori (user-managed)
export const listKategori = () => api.get("/kategori").then((r) => r.data);
export const createKategori = (p) => api.post("/kategori", p).then((r) => r.data);
export const updateKategori = (id, p) => api.put(`/kategori/${id}`, p).then((r) => r.data);
export const deleteKategori = (id) => api.delete(`/kategori/${id}`).then((r) => r.data);

// Anggota (member per divisi)
export const listAnggota = (params = {}) => api.get("/anggota", { params }).then((r) => r.data);
export const createAnggota = (p) => api.post("/anggota", p).then((r) => r.data);
export const updateAnggota = (id, p) => api.put(`/anggota/${id}`, p).then((r) => r.data);
export const deleteAnggota = (id) => api.delete(`/anggota/${id}`).then((r) => r.data);

// Analytics
export const anggotaAnalytics = (params) => api.get("/anggota/analytics", { params }).then((r) => r.data);

// Bulk task operations
export const bulkArchiveTasks = (ids) => api.post(`/tasks/bulk_archive`, { ids }).then((r) => r.data);
export const bulkUnarchiveTasks = (ids) => api.post(`/tasks/bulk_unarchive`, { ids }).then((r) => r.data);
export const bulkMoveTasks = (payload) => api.post(`/tasks/bulk_move`, payload).then((r) => r.data);
export const reorderTasks = (task_ids) => api.post(`/tasks/reorder`, { task_ids }).then((r) => r.data);
export const unreadTasks = () => api.get("/task_unread").then((r) => r.data);
export const markSeenTasks = (divisi_id) => api.post(`/task_mark_seen`, null, { params: divisi_id ? { divisi_id } : {} }).then((r) => r.data);
export const listIncomingNotifications = () => api.get("/notifications/incoming").then((r) => r.data);
export const markNotificationsSeen = () => api.post("/notifications/mark_seen").then((r) => r.data);

// Task Lists (kanban columns)
export const listTaskLists = (params = {}) => api.get("/task_lists", { params }).then((r) => r.data);
export const createTaskList = (p) => api.post("/task_lists", p).then((r) => r.data);
export const updateTaskList = (id, p) => api.put(`/task_lists/${id}`, p).then((r) => r.data);
export const deleteTaskList = (id) => api.delete(`/task_lists/${id}`).then((r) => r.data);

// Task Labels
export const listTaskLabels = () => api.get("/task_labels").then((r) => r.data);
export const createTaskLabel = (p) => api.post("/task_labels", p).then((r) => r.data);
export const updateTaskLabel = (id, p) => api.put(`/task_labels/${id}`, p).then((r) => r.data);
export const deleteTaskLabel = (id) => api.delete(`/task_labels/${id}`).then((r) => r.data);

// Todo Rutin tracker
export const listTodoEntries = (params = {}) => api.get("/todo/entries", { params }).then((r) => r.data);
export const upsertTodoEntry = (p) => api.post("/todo/entries", p).then((r) => r.data);

// Amaliyah
export const listAmaliyahItems = () => api.get("/amaliyah/items").then((r) => r.data);
export const createAmaliyahItem = (p) => api.post("/amaliyah/items", p).then((r) => r.data);
export const updateAmaliyahItem = (id, p) => api.put(`/amaliyah/items/${id}`, p).then((r) => r.data);
export const deleteAmaliyahItem = (id) => api.delete(`/amaliyah/items/${id}`).then((r) => r.data);
export const bulkDeleteAmaliyahItems = (ids) => api.post("/amaliyah/items/bulk_delete", { ids }).then((r) => r.data);
export const reorderAmaliyahItems = (item_ids) => api.post("/amaliyah/items/reorder", { item_ids }).then((r) => r.data);
export const amaliyahStreak = () => api.get("/amaliyah/streak").then((r) => r.data);
export const listEntries = (params = {}) => api.get("/amaliyah/entries", { params }).then((r) => r.data);
export const upsertEntry = (p) => api.post("/amaliyah/entries", p).then((r) => r.data);

// Raport
export const raportSummary = (params = {}) => api.get("/raport/summary", { params }).then((r) => r.data);
export const updateRaportNote = (p, params = {}) => api.put("/raport/note", p, { params }).then((r) => r.data);

// Import (kept but hidden from UI)
export const importExcel = (file) => {
  const form = new FormData();
  form.append("file", file);
  return axios.post(`${API}/import/excel`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    withCredentials: true,
  }).then((r) => r.data);
};
