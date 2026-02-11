import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 请求拦截器
api.interceptors.request.use(
    (config: any) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: any) => {
        return Promise.reject(error);
    }
);

// 响应拦截器 - 适配新的响应格式 { success, data, error }
api.interceptors.response.use(
    (response: any) => {
        const data = response.data;

        // 新格式：{ success: true, data: ... }
        if (data && typeof data.success === 'boolean') {
            if (data.success) {
                // 返回兼容旧格式的对象
                return { code: 200, data: data.data, message: 'Success' };
            } else {
                // 错误情况
                return Promise.reject({
                    code: data.error?.code || 'ERROR',
                    message: data.error?.message || 'Request failed',
                });
            }
        }

        // 旧格式兼容
        return data;
    },
    (error: any) => {
        if (error.response) {
            const { status, data } = error.response;

            if (status === 401) {
                // Token 过期或无效，跳转到登录页
                localStorage.removeItem('token');
                localStorage.removeItem('admin');
                window.location.href = '/login';
            }

            // 新格式错误处理
            if (data && data.error) {
                return Promise.reject({
                    code: data.error.code || status,
                    message: data.error.message || 'Request failed',
                });
            }

            return Promise.reject({
                code: status,
                message: data?.message || 'Request failed',
            });
        }

        return Promise.reject({
            code: 500,
            message: error.message || 'Network error',
        });
    }
);

export default api;

// ========================================
// 认证 API
// ========================================

export const authApi = {
    login: (username: string, password: string) =>
        api.post('/admin/auth/login', { username, password }),

    logout: () =>
        api.post('/admin/auth/logout'),

    getMe: () =>
        api.get('/admin/auth/me'),

    changePassword: (oldPassword: string, newPassword: string) =>
        api.post('/admin/auth/change-password', { oldPassword, newPassword }),
};

// ========================================
// 管理员 API
// ========================================

export const adminApi = {
    getList: (params?: { page?: number; pageSize?: number; status?: string; role?: string; keyword?: string }) =>
        api.get('/admin/admins', { params }),

    getById: (id: number) =>
        api.get(`/admin/admins/${id}`),

    create: (data: { username: string; password: string; email?: string; role?: string; status?: string }) =>
        api.post('/admin/admins', data),

    update: (id: number, data: { username?: string; password?: string; email?: string; role?: string; status?: string }) =>
        api.put(`/admin/admins/${id}`, data),

    delete: (id: number) =>
        api.delete(`/admin/admins/${id}`),
};

// ========================================
// API Key API
// ========================================

export const apiKeyApi = {
    getList: (params?: { page?: number; pageSize?: number; status?: string; keyword?: string }) =>
        api.get('/admin/api-keys', { params }),

    getById: (id: number) =>
        api.get(`/admin/api-keys/${id}`),

    create: (data: { name: string; permissions?: Record<string, boolean>; rateLimit?: number; expiresAt?: string | null }) =>
        api.post('/admin/api-keys', data),

    update: (id: number, data: { name?: string; permissions?: Record<string, boolean>; rateLimit?: number; status?: string; expiresAt?: string | null }) =>
        api.put(`/admin/api-keys/${id}`, data),

    delete: (id: number) =>
        api.delete(`/admin/api-keys/${id}`),

    getUsage: (id: number, groupName?: string) =>
        api.get(`/admin/api-keys/${id}/usage`, { params: { group: groupName } }),

    resetPool: (id: number, groupName?: string) =>
        api.post(`/admin/api-keys/${id}/reset-pool`, { group: groupName }),

    getPoolEmails: (id: number, groupId?: number) =>
        api.get(`/admin/api-keys/${id}/pool-emails`, { params: { groupId } }),

    updatePoolEmails: (id: number, emailIds: number[]) =>
        api.put(`/admin/api-keys/${id}/pool-emails`, { emailIds }),
};

// ========================================
// 邮箱账户 API
// ========================================

export const emailApi = {
    getList: (params?: { page?: number; pageSize?: number; status?: string; keyword?: string; groupId?: number }) =>
        api.get('/admin/emails', { params }),

    getById: (id: number, includeSecrets?: boolean) =>
        api.get(`/admin/emails/${id}`, { params: { secrets: includeSecrets } }),

    create: (data: { email: string; clientId: string; refreshToken: string }) =>
        api.post('/admin/emails', data),

    import: (content: string, separator?: string) =>
        api.post('/admin/emails/import', { content, separator }),

    export: (ids?: number[], separator?: string) =>
        api.get('/admin/emails/export', { params: { ids: ids?.join(','), separator } }),

    update: (id: number, data: { email?: string; clientId?: string; refreshToken?: string; status?: string }) =>
        api.put(`/admin/emails/${id}`, data),

    delete: (id: number) =>
        api.delete(`/admin/emails/${id}`),

    batchDelete: (ids: number[]) =>
        api.post('/admin/emails/batch-delete', { ids }),

    // 查看邮件 (管理员专用)
    viewMails: (id: number, mailbox?: string) =>
        api.get(`/admin/emails/${id}/mails`, { params: { mailbox } }),

    // 清空邮箱 (管理员专用)
    clearMailbox: (id: number, mailbox?: string) =>
        api.post(`/admin/emails/${id}/clear`, { mailbox }),
};

// ========================================
// 邮箱分组 API
// ========================================

export const groupApi = {
    getList: () =>
        api.get('/admin/email-groups'),

    getById: (id: number) =>
        api.get(`/admin/email-groups/${id}`),

    create: (data: { name: string; description?: string }) =>
        api.post('/admin/email-groups', data),

    update: (id: number, data: { name?: string; description?: string }) =>
        api.put(`/admin/email-groups/${id}`, data),

    delete: (id: number) =>
        api.delete(`/admin/email-groups/${id}`),

    assignEmails: (groupId: number, emailIds: number[]) =>
        api.post(`/admin/email-groups/${groupId}/assign`, { emailIds }),

    removeEmails: (groupId: number, emailIds: number[]) =>
        api.post(`/admin/email-groups/${groupId}/remove`, { emailIds }),
};

// ========================================
// 仪表盘 API
// ========================================

export const dashboardApi = {
    getStats: () =>
        api.get('/admin/dashboard/stats'),

    getApiTrend: (days: number = 7) =>
        api.get('/admin/dashboard/api-trend', { params: { days } }),

    getLogs: (params?: { page?: number; pageSize?: number; action?: string }) =>
        api.get('/admin/dashboard/logs', { params }),
};

// ========================================
// 操作日志 API（废弃，使用 dashboardApi.getLogs）
// ========================================

export const logsApi = {
    getList: (params: { page?: number; pageSize?: number; action?: string; resource?: string }) =>
        api.get('/admin/dashboard/logs', { params }),
};

