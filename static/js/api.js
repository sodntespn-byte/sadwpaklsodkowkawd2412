// LIBERTY - API Client

const API_BASE = '/api/v1';

// Token management
const TokenManager = {
    getAccessToken: () => localStorage.getItem('access_token'),
    getRefreshToken: () => localStorage.getItem('refresh_token'),
    setTokens: (access, refresh) => {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
    },
    clearTokens: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    },
    isAuthenticated: () => !!localStorage.getItem('access_token')
};

// API Request helper
async function apiRequest(endpoint, options = {}) {
    const token = TokenManager.getAccessToken();
    
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        }
    };
    
    if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    
    // Handle token refresh on 401
    if (response.status === 401 && TokenManager.getRefreshToken()) {
        const refreshed = await refreshToken();
        if (refreshed) {
            // Retry request with new token
            config.headers.Authorization = `Bearer ${TokenManager.getAccessToken()}`;
            return fetch(`${API_BASE}${endpoint}`, config);
        }
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

// Auth API — cadastro com username (email/senha opcionais); login com username e senha opcional
const AuthAPI = {
    async register(username, email, password) {
        const data = await apiRequest('/auth/register', {
            method: 'POST',
            body: { username: username || undefined, email: email || undefined, password: password || undefined }
        });
        TokenManager.setTokens(data.access_token, data.refresh_token);
        return data;
    },
    
    async login(username, password) {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: { username: username || undefined, password: password || undefined }
        });
        TokenManager.setTokens(data.access_token, data.refresh_token);
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
        if (!refreshToken) return false;
        
        try {
            const data = await apiRequest('/auth/refresh', {
                method: 'POST',
                body: { refresh_token: refreshToken }
            });
            TokenManager.setTokens(data.access_token, data.refresh_token);
            return true;
        } catch {
            TokenManager.clearTokens();
            return false;
        }
    }
};

// User API
const UserAPI = {
    async getCurrentUser() {
        return apiRequest('/users/@me');
    },
    
    async updateCurrentUser(data) {
        return apiRequest('/users/@me', {
            method: 'PATCH',
            body: data
        });
    },
    
    async getUser(userId) {
        return apiRequest(`/users/${userId}`);
    }
};

// Server API
const ServerAPI = {
    async list() {
        return apiRequest('/servers');
    },
    
    async create(name, region, icon) {
        return apiRequest('/servers', {
            method: 'POST',
            body: { name, region, icon }
        });
    },
    
    async get(serverId) {
        return apiRequest(`/servers/${serverId}`);
    },
    
    async update(serverId, data) {
        return apiRequest(`/servers/${serverId}`, {
            method: 'PATCH',
            body: data
        });
    },
    
    async delete(serverId) {
        return apiRequest(`/servers/${serverId}`, {
            method: 'DELETE'
        });
    }
};

// Channel API
const ChannelAPI = {
    async list(serverId) {
        return apiRequest(`/servers/${serverId}/channels`);
    },
    
    async create(serverId, name, type, parentId, topic) {
        return apiRequest(`/servers/${serverId}/channels`, {
            method: 'POST',
            body: { name, type, parent_id: parentId, topic }
        });
    },
    
    async get(channelId) {
        return apiRequest(`/channels/${channelId}`);
    },
    
    async update(channelId, data) {
        return apiRequest(`/channels/${channelId}`, {
            method: 'PATCH',
            body: data
        });
    },
    
    async delete(channelId) {
        return apiRequest(`/channels/${channelId}`, {
            method: 'DELETE'
        });
    }
};

// Message API
const MessageAPI = {
    async list(channelId, options = {}) {
        const params = new URLSearchParams();
        if (options.before) params.append('before', options.before);
        if (options.after) params.append('after', options.after);
        if (options.limit) params.append('limit', options.limit);
        
        const query = params.toString();
        return apiRequest(`/channels/${channelId}/messages${query ? '?' + query : ''}`);
    },
    
    async create(channelId, content, tts = false, embeds = []) {
        return apiRequest(`/channels/${channelId}/messages`, {
            method: 'POST',
            body: { content, tts, embeds }
        });
    },
    
    async get(channelId, messageId) {
        return apiRequest(`/channels/${channelId}/messages/${messageId}`);
    },
    
    async update(channelId, messageId, content) {
        return apiRequest(`/channels/${channelId}/messages/${messageId}`, {
            method: 'PATCH',
            body: { content }
        });
    },
    
    async delete(channelId, messageId) {
        return apiRequest(`/channels/${channelId}/messages/${messageId}`, {
            method: 'DELETE'
        });
    }
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
            body: data
        });
    },
    
    async remove(serverId, userId) {
        return apiRequest(`/servers/${serverId}/members/${userId}`, {
            method: 'DELETE'
        });
    }
};

// Invite API
const InviteAPI = {
    async get(code) {
        return apiRequest(`/invites/${code}`);
    },
    
    async create(channelId, options = {}) {
        return apiRequest(`/channels/${channelId}/invites`, {
            method: 'POST',
            body: {
                max_uses: options.maxUses,
                max_age: options.maxAge,
                temporary: options.temporary
            }
        });
    },
    
    async delete(code) {
        return apiRequest(`/invites/${code}`, {
            method: 'DELETE'
        });
    }
};

// DM API
const DMAPI = {
    async list() {
        return apiRequest('/users/@me/channels');
    },

    async create(recipientId) {
        return apiRequest('/users/@me/channels', {
            method: 'POST',
            body: { recipient_id: recipientId }
        });
    },

    async createGroup(name, recipientIds) {
        return apiRequest('/groups', {
            method: 'POST',
            body: { name: name || null, member_ids: recipientIds }
        });
    },

    async getMessages(channelId, options = {}) {
        const params = new URLSearchParams();
        if (options.before) params.append('before', options.before);
        if (options.limit) params.append('limit', options.limit);
        const query = params.toString();
        return apiRequest(`/channels/${channelId}/messages${query ? '?' + query : ''}`);
    }
};

// Friends / Relationships API (usa /api/v1/relationships)
const FriendAPI = {
    async list() {
        return apiRequest('/relationships');
    },

    async listPending() {
        const list = await apiRequest('/relationships');
        return Array.isArray(list) ? list.filter(r => r.type === 3 || r.type === 4) : [];
    },

    async add(username) {
        const trimmed = String(username || '').trim();
        if (!trimmed) throw new Error('username é obrigatório');
        return apiRequest('/relationships', {
            method: 'POST',
            body: { username: trimmed }
        });
    },

    async accept(friendshipId) {
        return apiRequest(`/relationships/${friendshipId}/accept`, {
            method: 'PATCH'
        });
    },

    async remove(friendshipId) {
        return apiRequest(`/relationships/${friendshipId}`, {
            method: 'DELETE'
        });
    }
};

// Reaction API
const ReactionAPI = {
    async add(channelId, messageId, emoji) {
        return apiRequest(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
            method: 'PUT'
        });
    },

    async remove(channelId, messageId, emoji) {
        return apiRequest(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
            method: 'DELETE'
        });
    },

    async getUsers(channelId, messageId, emoji) {
        return apiRequest(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
    }
};

// Pin API
const PinAPI = {
    async list(channelId) {
        return apiRequest(`/channels/${channelId}/pins`);
    },

    async pin(channelId, messageId) {
        return apiRequest(`/channels/${channelId}/pins/${messageId}`, {
            method: 'PUT'
        });
    },

    async unpin(channelId, messageId) {
        return apiRequest(`/channels/${channelId}/pins/${messageId}`, {
            method: 'DELETE'
        });
    }
};

// Ban API
const BanAPI = {
    async list(serverId) {
        return apiRequest(`/servers/${serverId}/bans`);
    },

    async create(serverId, userId, reason, deleteMessageDays) {
        return apiRequest(`/servers/${serverId}/bans/${userId}`, {
            method: 'PUT',
            body: { reason, delete_message_days: deleteMessageDays }
        });
    },

    async remove(serverId, userId) {
        return apiRequest(`/servers/${serverId}/bans/${userId}`, {
            method: 'DELETE'
        });
    }
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
                mentionable: options.mentionable
            }
        });
    },
    
    async update(serverId, roleId, data) {
        return apiRequest(`/servers/${serverId}/roles/${roleId}`, {
            method: 'PATCH',
            body: data
        });
    },
    
    async delete(serverId, roleId) {
        return apiRequest(`/servers/${serverId}/roles/${roleId}`, {
            method: 'DELETE'
        });
    }
};

// Export
window.API = {
    Token: TokenManager,
    Auth: AuthAPI,
    User: UserAPI,
    Server: ServerAPI,
    Channel: ChannelAPI,
    Message: MessageAPI,
    Member: MemberAPI,
    Invite: InviteAPI,
    Role: RoleAPI,
    DM: DMAPI,
    Friend: FriendAPI,
    Reaction: ReactionAPI,
    Pin: PinAPI,
    Ban: BanAPI
};



