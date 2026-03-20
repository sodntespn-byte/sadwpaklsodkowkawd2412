// LIBERTY - API Client

const API_BASE = '/api/v1';
const API_TIMEOUT = 8000; // 8 segundos timeout

// Token management — aceita 'token', 'access_token' ou 'liberty_token' para compatibilidade
function getStoredToken() {
  try {
    return (
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('liberty_token') ||
      null
    );
  } catch (e) {
    return null;
  }
}
const TokenManager = {
  getAccessToken: getStoredToken,
  getRefreshToken: () => { try { return localStorage.getItem('refresh_token'); } catch { return null; } },
  setTokens: (access, refresh) => {
    try {
      if (access) {
        localStorage.setItem('token', access);
        localStorage.setItem('access_token', access);
        localStorage.setItem('liberty_token', access);
      }
      localStorage.setItem('refresh_token', refresh || access || '');
    } catch (e) {}
  },
  clearTokens: () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('liberty_token');
      localStorage.removeItem('refresh_token');
    } catch (e) {}
  },
  isAuthenticated: () => !!getStoredToken(),
};

// Helper para timeout
function fetchWithTimeout(url, options, timeout = API_TIMEOUT) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
}

// API Request helper — sempre envia Authorization: Bearer quando houver token
async function apiRequest(endpoint, options = {}) {
  const token = getStoredToken();
  const config = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token && {
        Authorization: 'Bearer ' + token,
        'X-Auth-Token': token,
      }),
      ...options.headers,
    },
  };
  if (options.body && typeof options.body === 'object') {
    const body = { ...options.body };
    if (token && !body.token && !body.access_token) body.token = token;
    config.body = JSON.stringify(body);
  }
  const response = await fetchWithTimeout(`${API_BASE}${endpoint}`, config);

  // Handle token refresh on 401
  if (response.status === 401 && TokenManager.getRefreshToken()) {
    const refreshed = await AuthAPI.refresh();
    if (refreshed) {
      // Retry request with new token
      config.headers.Authorization = `Bearer ${TokenManager.getAccessToken()}`;
      return fetch(`${API_BASE}${endpoint}`, config);
    }
  }

  if (response.status === 401 || response.status === 403) {
    TokenManager.clearTokens();
    try {
      window.dispatchEvent(new CustomEvent('liberty:unauthorized'));
    } catch (_) {}
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Auth API — cadastro só username; login com username e senha opcional
const AuthAPI = {
  async register(username, email, password) {
    const url = `${API_BASE}/auth/register`;
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username || undefined,
        email: email || undefined,
        password: password || undefined,
      }),
    });
    const data = await res.json().catch(() => ({ message: 'Resposta inválida do servidor (não-JSON)' }));
    if (!res.ok) {
      const msg = data.message || data.error || `HTTP ${res.status}`;
      console.error('[LIBERTY] Erro no registro:', res.status, data);
      throw new Error(msg);
    }
    if (data.access_token) {
      TokenManager.setTokens(data.access_token, data.refresh_token || data.access_token);
    }
    return data;
  },

  async login(username, password) {
    console.log('[API] login chamado para:', username);
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { username: username || undefined, password: password || undefined },
    });
    console.log('[API] login response:', data ? 'ok' : 'null', 'access_token:', data?.access_token ? 'presente' : 'AUSENTE');
    
    if (data && data.access_token) {
      TokenManager.setTokens(data.access_token, data.refresh_token || data.access_token);
      console.log('[API] Token salvo com sucesso');
    } else {
      console.error('[API] ❌ Resposta sem access_token!');
    }
    return data;
  },

  async logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      TokenManager.clearTokens();
    }
  },

  async refresh() {
    const refreshToken = TokenManager.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const data = await apiRequest('/auth/refresh', {
        method: 'POST',
        body: { refresh_token: refreshToken },
      });
      TokenManager.setTokens(data.access_token, data.refresh_token);
      return data;
    } catch {
      TokenManager.clearTokens();
      return null;
    }
  },
};

// User API
const UserAPI = {
  async getCurrentUser() {
    return apiRequest('/users/@me');
  },

  async updateCurrentUser(data) {
    return apiRequest('/users/@me', {
      method: 'PATCH',
      body: data,
    });
  },

  /** Definir ou alterar senha (ativar nas configurações). Se já tem senha, enviar current_password. */
  async updatePassword(currentPassword, newPassword) {
    return apiRequest('/users/me/password', {
      method: 'PATCH',
      body: { current_password: currentPassword || undefined, new_password: newPassword },
    });
  },

  async getUser(userId) {
    return apiRequest(`/users/${userId}`);
  },

  async getMutualServers(userId) {
    return apiRequest(`/users/${userId}/mutual-servers`);
  },

  async getMutualFriends(userId) {
    return apiRequest(`/users/${userId}/mutual-friends`);
  },

  /** Envia foto de perfil (data URL base64). Retorna { avatar_url }. */
  async uploadAvatar(imageDataUrl) {
    return apiRequest('/users/me/avatar', {
      method: 'POST',
      body: { image: imageDataUrl },
    });
  },

  /** Exportar todos os dados da conta (privacidade). Retorna blob JSON. */
  async exportData() {
    const token = getStoredToken();
    if (!token) throw new Error('Não autenticado');
    const res = await fetch(`${API_BASE}/users/@me/export`, {
      method: 'GET',
      credentials: 'include',
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Erro ao exportar' }));
      throw new Error(err.message || 'Erro ao exportar dados');
    }
    return res.blob();
  },

  /** Eliminar conta permanentemente. Se o utilizador tiver senha, passá-la como confirmação. */
  async deleteAccount(confirmPassword) {
    return apiRequest('/users/@me', {
      method: 'DELETE',
      body: confirmPassword ? { password: confirmPassword } : {},
    });
  },
};

// Ranking API — By Activity + By Content (XP)
const RankingAPI = {
  async list(limit = 10) {
    return apiRequest(`/ranking?limit=${limit}`);
  },
};

// Activity API — ping para ranking "By Activity" (tempo em app)
const ActivityAPI = {
  async ping() {
    const token = getStoredToken();
    if (!token) return;
    await fetch(`${API_BASE}/activity/ping`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: 'Bearer ' + token },
    }).catch(() => {});
  },
};

// Server API
const ServerAPI = {
  async list() {
    return apiRequest('/servers');
  },

  async create(name, region, icon) {
    return apiRequest('/servers', {
      method: 'POST',
      body: { name, region, icon },
    });
  },

  async get(serverId) {
    return apiRequest(`/servers/${serverId}`);
  },

  async update(serverId, data) {
    return apiRequest(`/servers/${serverId}`, {
      method: 'PATCH',
      body: data,
    });
  },

  async delete(serverId) {
    return apiRequest(`/servers/${serverId}`, {
      method: 'DELETE',
    });
  },

  async getMembers(serverId) {
    return apiRequest(`/servers/${serverId}/members`);
  },

  async updateMemberRole(serverId, userId, role) {
    return apiRequest(`/servers/${serverId}/members/${userId}`, {
      method: 'PATCH',
      body: { role },
    });
  },
};

// Channel API
const ChannelAPI = {
  async list(serverId) {
    return apiRequest(`/servers/${serverId}/channels`);
  },

  async create(serverId, name, type, parentId, topic) {
    return apiRequest(`/servers/${serverId}/channels`, {
      method: 'POST',
      body: { name, type, parent_id: parentId, topic },
    });
  },

  async get(channelId) {
    return apiRequest(`/channels/${channelId}`);
  },

  async update(channelId, data) {
    return apiRequest(`/channels/${channelId}`, {
      method: 'PATCH',
      body: data,
    });
  },

  async delete(channelId) {
    return apiRequest(`/channels/${channelId}`, {
      method: 'DELETE',
    });
  },
};

// Room: "channel:serverId:channelId" ou "dm:id" — extrai channelId para /channels/:channelId/messages
function parseRoom(roomOrChannelId) {
  const r = String(roomOrChannelId || '');
  if (r.startsWith('channel:')) {
    const parts = r.slice(8).split(':');
    return parts.length >= 2 ? parts[1] : parts[0] || r;
  }
  if (r.startsWith('dm:')) return r.slice(3) || r;
  return r;
}

// Message API — aceita room (channel:serverId:channelId ou dm:id) ou channelId direto
const MessageAPI = {
  async list(roomOrChannelId, options = {}) {
    const channelId = parseRoom(roomOrChannelId);
    const params = new URLSearchParams();
    if (options.before) params.append('before', options.before);
    if (options.after) params.append('after', options.after);
    if (options.limit) params.append('limit', options.limit || 50);

    const query = params.toString();
    return apiRequest(`/channels/${channelId}/messages${query ? '?' + query : ''}`);
  },

  async create(roomOrChannelId, content, options = {}) {
    const channelId = parseRoom(roomOrChannelId);
    const { tts = false, embeds = [], clientId = null, attachments = [] } =
      typeof options === 'object' && options !== null ? options : {};
    const body = { content: (content != null && content !== undefined) ? String(content) : '', tts, embeds };
    if (clientId != null) body.client_id = clientId;
    if (Array.isArray(attachments) && attachments.length > 0) body.attachments = attachments;
    return apiRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body,
    });
  },

  async uploadAttachment(channelId, file) {
    const token = getStoredToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/channels/${channelId}/attachments`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: 'Bearer ' + token, 'X-Auth-Token': token } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Falha no upload' }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async get(channelId, messageId) {
    return apiRequest(`/channels/${channelId}/messages/${messageId}`);
  },

  async update(channelId, messageId, content) {
    return apiRequest(`/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      body: { content },
    });
  },

  async delete(channelId, messageId) {
    return apiRequest(`/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
    });
  },
};

// Member API
const MemberAPI = {
  async list(serverId) {
    return apiRequest(`/servers/${serverId}/members`);
  },

  async get(serverId, userId) {
    return apiRequest(`/servers/${serverId}/members/${userId}`);
  },

  async update(serverId, userId, data) {
    return apiRequest(`/servers/${serverId}/members/${userId}`, {
      method: 'PATCH',
      body: data,
    });
  },

  async remove(serverId, userId) {
    return apiRequest(`/servers/${serverId}/members/${userId}`, {
      method: 'DELETE',
    });
  },
};

// Invite API
const InviteAPI = {
  async get(code) {
    return apiRequest(`/invites/${code}`);
  },

  async join(code) {
    return apiRequest(`/invites/${code}/join`, { method: 'POST' });
  },

  async create(channelId, options = {}) {
    return apiRequest(`/channels/${channelId}/invites`, {
      method: 'POST',
      body: {
        max_uses: options.maxUses,
        max_age: options.maxAge,
        temporary: options.temporary,
      },
    });
  },

  async delete(code) {
    return apiRequest(`/invites/${code}`, {
      method: 'DELETE',
    });
  },
};

// DM API
const DMAPI = {
  async list() {
    return apiRequest('/users/@me/channels');
  },

  async create(recipientId) {
    return apiRequest('/users/@me/channels', {
      method: 'POST',
      body: { recipient_id: recipientId },
    });
  },

  async createGroup(name, recipientIds) {
    return apiRequest('/users/@me/channels', {
      method: 'POST',
      body: { name: name || null, recipient_ids: recipientIds },
    });
  },

  async getMessages(channelId, options = {}) {
    const params = new URLSearchParams();
    if (options.before) params.append('before', options.before);
    if (options.limit) params.append('limit', options.limit);
    const query = params.toString();
    return apiRequest(`/channels/${channelId}/messages${query ? '?' + query : ''}`);
  },
};

// Friends/Relationships API — backend já retorna type 1=friend, 3=pending in, 4=pending out
const FriendAPI = {
  async list() {
    return apiRequest('/users/@me/relationships').catch(() => []);
  },

  async listPending() {
    const list = await apiRequest('/users/@me/relationships').catch(() => []);
    return Array.isArray(list) ? list.filter(r => r.type === 3 || r.type === 4) : [];
  },

  async add(username, discriminator) {
    return apiRequest('/users/@me/relationships', {
      method: 'POST',
      body: { username: username || undefined, discriminator: discriminator || undefined },
    });
  },

  async accept(relationshipId) {
    return apiRequest(`/users/@me/relationships/${relationshipId}`, {
      method: 'PUT',
    });
  },

  async remove(relationshipId) {
    return apiRequest(`/users/@me/relationships/${relationshipId}`, {
      method: 'DELETE',
    });
  },
};

// Reaction API
const ReactionAPI = {
  async add(channelId, messageId, emoji) {
    return apiRequest(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
      method: 'PUT',
    });
  },

  async remove(channelId, messageId, emoji) {
    return apiRequest(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
      method: 'DELETE',
    });
  },

  async getUsers(channelId, messageId, emoji) {
    return apiRequest(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
  },
};

// Pin API
const PinAPI = {
  async list(channelId) {
    return apiRequest(`/channels/${channelId}/pins`);
  },

  async pin(channelId, messageId) {
    return apiRequest(`/channels/${channelId}/pins/${messageId}`, {
      method: 'PUT',
    });
  },

  async unpin(channelId, messageId) {
    return apiRequest(`/channels/${channelId}/pins/${messageId}`, {
      method: 'DELETE',
    });
  },
};

const CallAPI = null;

// Task API — gerenciamento de tarefas
const TaskAPI = {
  async list(userId, status = null) {
    const query = status ? `?status=${status}` : '';
    return apiRequest(`/users/${userId}/tasks${query}`).catch(() => []);
  },

  async create(userId, { title, description, priority = 'medium', due_date }) {
    return apiRequest(`/users/${userId}/tasks`, {
      method: 'POST',
      body: { title, description, priority, due_date },
    });
  },

  async update(taskId, { title, description, status, priority, due_date }) {
    return apiRequest(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: { title, description, status, priority, due_date },
    });
  },

  async delete(taskId) {
    return apiRequest(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  },

  async complete(taskId) {
    return this.update(taskId, { status: 'completed' });
  },

  async start(taskId) {
    return this.update(taskId, { status: 'in_progress' });
  },
};

// Ban API (apenas admins configurados no backend)
const BanAPI = {
  async list(serverId) {
    return apiRequest(`/servers/${serverId}/bans`);
  },

  async create(serverId, userId, reason) {
    return apiRequest(`/servers/${serverId}/bans`, {
      method: 'POST',
      body: { user_id: userId, reason: reason || '' },
    });
  },

  async remove(serverId, userId) {
    return apiRequest(`/servers/${serverId}/bans/${userId}`, {
      method: 'DELETE',
    });
  },
};

// Auth Methods API (2FA / Security Methods)
const AuthMethodsAPI = {
  // Obter todos os métodos de autenticação do usuário
  async getMethods() {
    try {
      return await apiRequest('/auth/methods');
    } catch (e) {
      // Se não existe no backend, usar localStorage como fallback
      try {
        const stored = localStorage.getItem('liberty_auth_methods');
        return stored ? JSON.parse(stored) : {};
      } catch { return {}; }
    }
  },

  // Ativar/desativar método
  async setMethod(method, data) {
    try {
      return await apiRequest('/auth/methods', {
        method: 'POST',
        body: { method, ...data },
      });
    } catch (e) {
      // Fallback localStorage
      try {
        const methods = JSON.parse(localStorage.getItem('liberty_auth_methods') || '{}');
        methods[method] = { enabled: true, ...data };
        localStorage.setItem('liberty_auth_methods', JSON.stringify(methods));
        return methods[method];
      } catch { return { enabled: true, ...data }; }
    }
  },

  async disableMethod(method) {
    try {
      return await apiRequest(`/auth/methods/${method}`, {
        method: 'DELETE',
      });
    } catch (e) {
      // Fallback localStorage
      try {
        const methods = JSON.parse(localStorage.getItem('liberty_auth_methods') || '{}');
        delete methods[method];
        localStorage.setItem('liberty_auth_methods', JSON.stringify(methods));
      } catch {}
      return { success: true };
    }
  },

  // Verificar método (usado no login)
  async verifyMethod(method, code) {
    return apiRequest('/auth/verify', {
      method: 'POST',
      body: { method, code },
    });
  },

  // Enviar código de verificação (email/phone)
  async sendCode(method, destination) {
    return apiRequest('/auth/send-code', {
      method: 'POST',
      body: { method, destination },
    });
  },

  // Registrar WebAuthn (YubiKey/Windows Hello)
  async startWebAuthnRegistration(type) {
    return apiRequest('/auth/webauthn/register/start', {
      method: 'POST',
      body: { type },
    });
  },

  async finishWebAuthnRegistration(type, credential) {
    return apiRequest('/auth/webauthn/register/finish', {
      method: 'POST',
      body: { type, credential },
    });
  },

  async verifyWebAuthn(type, assertion) {
    return apiRequest('/auth/webauthn/verify', {
      method: 'POST',
      body: { type, assertion },
    });
  },
};

// Admin API (apenas admins)
const AdminAPI = {
  async getDb() {
    return apiRequest('/admin/db');
  },
};

// Role API
const RoleAPI = {
  async list(serverId) {
    return apiRequest(`/servers/${serverId}/roles`);
  },

  async create(serverId, name, permissions, options = {}) {
    return apiRequest(`/servers/${serverId}/roles`, {
      method: 'POST',
      body: {
        name,
        permissions,
        color: options.color,
        hoist: options.hoist,
        mentionable: options.mentionable,
      },
    });
  },

  async update(serverId, roleId, data) {
    return apiRequest(`/servers/${serverId}/roles/${roleId}`, {
      method: 'PATCH',
      body: data,
    });
  },

  async delete(serverId, roleId) {
    return apiRequest(`/servers/${serverId}/roles/${roleId}`, {
      method: 'DELETE',
    });
  },
};

// Helper para uso em app.js e outros: retorna headers com Bearer
function getAuthHeaders() {
  const token = getStoredToken();
  if (!token) return {};
  return { Authorization: 'Bearer ' + token };
}

// Export
window.API = {
  Token: TokenManager,
  getAuthHeaders: getAuthHeaders,
  getStoredToken: getStoredToken,
  Auth: AuthAPI,
  AuthMethods: AuthMethodsAPI,
  User: UserAPI,
  Server: ServerAPI,
  Channel: ChannelAPI,
  Message: MessageAPI,
  Member: MemberAPI,
  Invite: InviteAPI,
  Role: RoleAPI,
  DM: DMAPI,
  Friend: FriendAPI,
  Ranking: RankingAPI,
  Activity: ActivityAPI,
  Reaction: ReactionAPI,
  Pin: PinAPI,
  Ban: BanAPI,
  Admin: AdminAPI,
  Call: CallAPI,
  Task: TaskAPI,
};
