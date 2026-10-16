// ====================================================================
// NexusHub Portal Frontend: Centralized API Client
// ====================================================================

const TOKEN_KEY = 'nexushub_jwt_token';
const USER_KEY = 'nexushub_user_profile';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  getUser: () => {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  },
  setUser: (user: any) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, { ...options, headers });
  
  if (response.status === 401) {
    // Session expired or invalid
    authStorage.clear();
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}: Failed request`);
  }

  return data as T;
}

export const api = {
  // Auth
  login: async (username: string, password: string = 'admin123') => {
    const data = await request<{ token: string; user: any }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    authStorage.setToken(data.token);
    authStorage.setUser(data.user);
    return data;
  },
  getDemoUsers: () => request<{ users: any[] }>('/api/v1/auth/demo-users'),

  // Observability & Dashboard
  getStats: () => request<any>('/api/v1/observability/stats'),
  getCapacityPlanning: (scaleMultiplier: number = 1) =>
    request<any>(`/api/v1/observability/capacity-planning?scale=${scaleMultiplier}`),
  getRecentLogs: (limit: number = 25) => request<{ logs: any[] }>(`/api/v1/observability/logs?limit=${limit}`),

  // Catalog
  getCatalog: (type?: string, search?: string) => {
    let url = '/api/v1/catalog?';
    if (type && type !== 'ALL') url += `type=${type}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    return request<{ services: any[] }>(url);
  },
  createService: (serviceData: any) =>
    request<{ service: any }>('/api/v1/catalog', {
      method: 'POST',
      body: JSON.stringify(serviceData)
    }),

  // Subscriptions
  getSubscriptions: () => request<{ subscriptions: any[] }>('/api/v1/subscriptions'),
  subscribeService: (service_id: string, rate_limit_tier: string = 'GOLD') =>
    request<{ subscription: any }>('/api/v1/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ service_id, rate_limit_tier })
    }),

  // Approvals (Super Admin)
  getApprovals: () => request<any>('/api/v1/approvals'),
  approveService: (id: string) =>
    request<any>(`/api/v1/approvals/services/${id}/approve`, { method: 'POST' }),
  approveSubscription: (id: string) =>
    request<any>(`/api/v1/approvals/subscriptions/${id}/approve`, { method: 'POST' }),
  rejectApproval: (type: 'services' | 'subscriptions', id: string) =>
    request<any>(`/api/v1/approvals/${type}/${id}/reject`, { method: 'POST' }),

  // DLQ
  getDlqRecords: (status?: string) => {
    const url = status ? `/api/v1/dlq?status=${status}` : '/api/v1/dlq';
    return request<{ dlqRecords: any[] }>(url);
  },
  replayDlqMessage: (id: string) =>
    request<any>(`/api/v1/dlq/${id}/replay`, { method: 'POST' })
};

