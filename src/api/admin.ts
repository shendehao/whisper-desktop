import http from "./index";

export interface DashboardStats {
  total_cards: number;
  unused_cards: number;
  used_cards: number;
  expired_cards: number;
  banned_cards: number;
  total_software: number;
  today_events: number;
}

export interface SoftwareItem {
  id: number;
  name: string;
  instance_id: string;
  version: string;
  access_count: number;
  strategy: string;
  secret_key: string | null;
  encrypt_enabled: boolean;
  encrypt_key: string | null;
}

export interface CardItem {
  id: number;
  key: string;
  status: string;
  hwid: string | null;
  created_at: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  first_ip: string | null;
  last_ip: string | null;
  expire_date: string | null;
  duration_unit: string;
  duration_value: number | null;
  unbind_count: number;
  unbind_limit: number | null;
  remarks: string | null;
  software_id: number;
  software_name: string | null;
}

export interface CardListResponse {
  total: number;
  items: CardItem[];
}

export interface EventItem {
  id: number;
  timestamp: string | null;
  message: string;
  event_type: string;
  software_id: number | null;
}

export interface EventListResponse {
  total: number;
  items: EventItem[];
}

export function getDashboard() {
  return http.get<DashboardStats>("/api/desktop/dashboard");
}

export function getSoftwareList() {
  return http.get<SoftwareItem[]>("/api/desktop/software");
}

export function getCards(params: {
  software_id?: number;
  status?: string;
  keyword?: string;
  page?: number;
  page_size?: number;
}) {
  return http.get<CardListResponse>("/api/desktop/cards", { params });
}

export function batchGenerateCards(data: {
  software_id: number;
  count: number;
  duration_unit?: string;
  duration_value?: number;
  unbind_limit?: number;
  prefix?: string;
  remarks?: string;
}) {
  return http.post("/api/desktop/cards/batch", data);
}

export function batchUpdateCardStatus(data: {
  card_ids: number[];
  status: "banned" | "unused";
}) {
  return http.post("/api/desktop/cards/status", data);
}

export function batchDeleteCards(cardIds: number[]) {
  return http.delete("/api/desktop/cards", {
    params: { card_ids: cardIds },
    paramsSerializer: { indexes: null },
  });
}

// ─── Single Card Operations ──────────────────────────────────────

export function updateCard(id: number, data: {
  remarks?: string;
  unbind_limit?: number | null;
  unbind_count?: number;
  status?: "unused" | "used" | "expired" | "banned";
  duration_unit?: "hour" | "day" | "permanent";
  duration_value?: number;
}) {
  return http.put(`/api/desktop/cards/${id}`, data);
}

export function resetCardHwid(id: number) {
  return http.post(`/api/desktop/cards/${id}/reset-hwid`);
}

export function batchResetCardHwid(cardIds: number[]) {
  return http.post("/api/desktop/cards/batch-reset-hwid", { card_ids: cardIds, status: "unused" });
}

export function batchSetCardRemarks(cardIds: number[], remarks: string) {
  return http.post("/api/desktop/cards/batch-remarks", { card_ids: cardIds, remarks });
}

export function batchSetCardUnbindLimit(cardIds: number[], unbindLimit: number | null) {
  return http.post("/api/desktop/cards/batch-unbind-limit", { card_ids: cardIds, unbind_limit: unbindLimit });
}

export function batchBanCardFirstIp(cardIds: number[]) {
  return http.post<{ code: number; banned: number; skipped_no_ip: number; already_exists: number }>(
    "/api/desktop/cards/batch-ban-first-ip",
    { card_ids: cardIds, status: "unused" }
  );
}

export function getLogs(params: {
  page?: number;
  page_size?: number;
  event_type?: string;
}) {
  return http.get<EventListResponse>("/api/desktop/logs", { params });
}

/** 全局事件日志（平台所有租户）—— 仅超级管理员可用 */
export function getGlobalLogs(params: {
  page?: number;
  page_size?: number;
  event_type?: string;
}) {
  return http.get<EventListResponse>("/api/desktop/global-logs", { params });
}

// ─── Software CRUD ───────────────────────────────────────────────

export function createSoftware(data: { name: string; version?: string; strategy?: string; encrypt_enabled?: boolean; encrypt_key?: string }) {
  return http.post("/api/desktop/software", data);
}
export function updateSoftware(id: number, data: { name?: string; version?: string; strategy?: string; encrypt_enabled?: boolean; encrypt_key?: string; update_content?: string }) {
  return http.put(`/api/desktop/software/${id}`, data);
}
export function deleteSoftware(id: number) {
  return http.delete(`/api/desktop/software/${id}`);
}

// ─── Cloud Variables ─────────────────────────────────────────────

export interface CloudVarItem { id: number; key: string; value: string; software_id: number }

export function getCloudVars(softwareId?: number) {
  return http.get<CloudVarItem[]>("/api/desktop/cloud-vars", { params: softwareId ? { software_id: softwareId } : {} });
}
export function createCloudVar(data: { software_id: number; key: string; value: string }) {
  return http.post("/api/desktop/cloud-vars", data);
}
export function updateCloudVar(id: number, data: { key?: string; value?: string }) {
  return http.put(`/api/desktop/cloud-vars/${id}`, data);
}
export function deleteCloudVar(id: number) {
  return http.delete(`/api/desktop/cloud-vars/${id}`);
}

// ─── Announcements ───────────────────────────────────────────────

export interface AnnouncementItem { id: number; title: string; content: string; is_active: boolean; software_id: number | null; created_at: string | null }

export function getAnnouncements(softwareId?: number) {
  return http.get<AnnouncementItem[]>("/api/desktop/announcements", { params: softwareId ? { software_id: softwareId } : {} });
}
export function createAnnouncement(data: { title: string; content: string; software_id?: number; is_active?: boolean }) {
  return http.post("/api/desktop/announcements", data);
}
export function updateAnnouncement(id: number, data: { title?: string; content?: string; is_active?: boolean }) {
  return http.put(`/api/desktop/announcements/${id}`, data);
}
export function deleteAnnouncement(id: number) {
  return http.delete(`/api/desktop/announcements/${id}`);
}

// ─── Blacklist ───────────────────────────────────────────────────

export interface BlacklistItem { id: number; type: string; value: string; reason: string | null; created_at: string | null }

export function getBlacklist() {
  return http.get<BlacklistItem[]>("/api/desktop/blacklist");
}
export function createBlacklist(data: { type: "hwid" | "ip"; value: string; reason?: string }) {
  return http.post("/api/desktop/blacklist", data);
}
export function deleteBlacklist(id: number) {
  return http.delete(`/api/desktop/blacklist/${id}`);
}

// ─── Device Blacklist ────────────────────────────────────────────

export interface DeviceBlacklistItem { id: number; device_fp: string; reason: string | null; is_active: boolean; expires_at: string | null; created_at: string | null }

export function getDeviceBlacklist() {
  return http.get<DeviceBlacklistItem[]>("/api/desktop/device-blacklist");
}
export function createDeviceBlacklist(data: { device_fp: string; reason?: string }) {
  return http.post("/api/desktop/device-blacklist", data);
}
export function deleteDeviceBlacklist(id: number) {
  return http.delete(`/api/desktop/device-blacklist/${id}`);
}

// ─── Sub-accounts ────────────────────────────────────────────────

export interface SubAccountItem { id: number; username: string; is_active: boolean; permissions: string | null; created_at: string | null }

export function getSubAccounts() {
  return http.get<SubAccountItem[]>("/api/desktop/sub-accounts");
}
export function createSubAccount(data: {
  username: string;
  email: string;
  password: string;
  code: string;
  permissions: string[];
}) {
  return http.post("/api/desktop/sub-accounts", data);
}

/**
 * 发送子账号邮箱验证码（与 Web 后台共享 /auth/custom/send-code）。
 * purpose=subaccount 不需要图形验证码（captcha），只受邮箱级频率限制。
 */
export function sendSubaccountCode(email: string) {
  return http.post<{ msg: string; cooldown_seconds: number }>(
    "/auth/custom/send-code",
    { email, purpose: "subaccount" }
  );
}
export function updateSubAccount(id: number, data: { is_active?: boolean; permissions?: string[] }) {
  return http.put(`/api/desktop/sub-accounts/${id}`, data);
}
export function deleteSubAccount(id: number) {
  return http.delete(`/api/desktop/sub-accounts/${id}`);
}

// ─── Users (superadmin) ──────────────────────────────────────────

export interface UserItem { id: number; username: string; is_active: boolean; is_superuser: boolean; parent_id: number | null; created_at: string | null; last_login: string | null }

export function getUsers() {
  return http.get<UserItem[]>("/api/desktop/users");
}

/** 超管：启用/停用主账号、修改用户名或邮箱 */
export function updateUser(
  userId: number,
  data: { is_active?: boolean; username?: string; email?: string }
) {
  return http.patch(`/api/desktop/users/${userId}`, data);
}

/** 超管：重置主账号密码 */
export function resetUserPassword(userId: number, password: string) {
  return http.post(`/api/desktop/users/${userId}/reset-password`, { password });
}

// ─── Superadmin Dashboard (full-platform) ────────────────────────

export interface SoftwareDistributionItem {
  name: string;
  access_count: number;
}

export interface SuperadminEventItem {
  timestamp: string | null;
  event_type: string;
  message: string;
}

export interface SuperadminDashboardData {
  total_main_users: number;
  total_sub_users: number;
  total_software: number;
  total_cards: number;
  used_cards: number;
  today_access: number;
  software_distribution: SoftwareDistributionItem[];
  recent_events: SuperadminEventItem[];
  my_software: number;
  my_cards: number;
  my_used_cards: number;
}

/** 超管：全平台总览（与 Web 后台 /admin/custom_dashboard is_superuser 分支同源） */
export function getSuperadminDashboard() {
  return http.get<SuperadminDashboardData>("/api/desktop/superadmin/dashboard");
}

// ─── System Monitor ──────────────────────────────────────────────

export interface MonitorEventItem {
  event_type: string;
  timestamp: string;
  message: string;
}

export interface SystemStats {
  // 聚合数（兼容字段）
  total_users: number;
  total_sub_accounts: number;
  total_software: number;
  total_cards: number;
  total_access_today: number;
  // 进程资源
  psutil_ok?: boolean;
  cpu_percent?: number | null;
  ram_used_mb?: number | null;
  ram_total_mb?: number | null;
  ram_percent?: number | null;
  disk_used_gb?: number | null;
  disk_total_gb?: number | null;
  disk_percent?: number | null;
  uptime_str?: string | null;
  proc_start?: string | null;
  // 表统计 / 最近错误事件
  db_stats?: Record<string, number | string>;
  recent_errors?: MonitorEventItem[];
  now_cn?: string | null;
  db_error?: string | null;
}

export function getSystemMonitor() {
  return http.get<SystemStats>("/api/desktop/monitor");
}

// ─── Dashboard Chart ─────────────────────────────────────────────

export function getDashboardChart(days = 7) {
  return http.get<{ dates: string[]; counts: number[] }>("/api/desktop/dashboard/chart", { params: { days } });
}

// ─── Cloud Update Push (superadmin) ──────────────────────────────

export interface CloudUpdateConfig {
  latest_version?: string;
  update_url?: string;
  update_content?: string;
  min_version?: string;
  force_update?: boolean;
  pushed_at?: string;
  pushed_by?: number;
  active?: boolean;
  cancelled_at?: string;
  cancelled_by?: number;
}

export interface CloudUpdateUploadResult {
  ok: boolean;
  url: string;
  path: string;
  filename: string;
  size: number;
  sha256: string;
  detected_version: string | null;
  version_source: "pe" | "filename" | null;
}

export function getCloudUpdateStatus() {
  return http.get<{ cfg: CloudUpdateConfig }>("/api/desktop/superadmin/cloud-update/status");
}

export function uploadCloudUpdateInstaller(
  file: File,
  onProgress?: (pct: number) => void
) {
  const fd = new FormData();
  fd.append("upload_file", file);
  return http.post<CloudUpdateUploadResult>(
    "/api/desktop/superadmin/cloud-update/upload",
    fd,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 0,
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }
  );
}

export function pushCloudUpdate(payload: {
  latest_version: string;
  update_url: string;
  update_content?: string;
  min_version?: string;
  force_update?: boolean;
}) {
  return http.post<{ ok: boolean; message: string; cfg: CloudUpdateConfig }>(
    "/api/desktop/superadmin/cloud-update/push",
    payload
  );
}

export function cancelCloudUpdate() {
  return http.post<{ ok: boolean; message: string; cfg: CloudUpdateConfig }>(
    "/api/desktop/superadmin/cloud-update/cancel"
  );
}

// ─── Lua Scripts (file distribution) ─────────────────────────────

export interface FileDistributionSoftwareItem {
  id: number;
  name: string;
  instance_id: string;
}

export interface LuaScriptItem {
  id: number;
  software_id: number;
  version: string;
  description: string | null;
  file_url: string;
  checksum: string;
  is_force_update: boolean;
  created_at: string | null;
}

export function getFileDistributionSoftware() {
  return http.get<FileDistributionSoftwareItem[]>("/api/desktop/file-distribution-software");
}

export function listLuaScripts(softwareId: number) {
  return http.get<LuaScriptItem[]>("/api/desktop/lua-scripts", { params: { software_id: softwareId } });
}

export function uploadLuaScript(
  payload: { software_id: number; version?: string; description?: string; is_force_update?: boolean },
  file: File,
  onProgress?: (pct: number) => void
) {
  const fd = new FormData();
  fd.append("software_id", String(payload.software_id));
  if (payload.version) fd.append("version", payload.version);
  if (payload.description) fd.append("description", payload.description);
  if (payload.is_force_update) fd.append("is_force_update", "1");
  fd.append("upload_file", file);
  return http.post<LuaScriptItem>("/api/desktop/lua-scripts/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 0,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
}

export function replaceLuaScript(
  scriptId: number,
  payload: { description?: string; is_force_update?: boolean },
  file?: File,
  onProgress?: (pct: number) => void
) {
  const fd = new FormData();
  if (payload.description !== undefined) fd.append("description", payload.description);
  if (payload.is_force_update !== undefined) fd.append("is_force_update", payload.is_force_update ? "1" : "0");
  if (file) fd.append("upload_file", file);
  return http.post<LuaScriptItem>(`/api/desktop/lua-scripts/${scriptId}/replace`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 0,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
}

export function deleteLuaScript(scriptId: number) {
  return http.delete<{ code: number }>(`/api/desktop/lua-scripts/${scriptId}`);
}

// ─── Docs (GUIDE.md) ─────────────────────────────────────────────

export interface GuideDoc {
  html: string;
  updated_at: string | null;
  source_path: string;
}

export function getGuide() {
  return http.get<GuideDoc>("/api/desktop/docs/guide");
}
