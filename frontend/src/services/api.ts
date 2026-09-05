import {
  User,
  Case,
  Document,
  DocumentVersion,
  Approval,
  SecurityIncident,
  AuditEvent,
  DashboardStats,
  SearchDocumentsResponse,
  DocumentClassification,
  DocumentStatus,
  IncidentStatus,
  RoleName,
  RegistrationRequest,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// In-memory access token storage (Security requirement: never in localStorage/sessionStorage)
let inMemoryAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

function getAuthHeader(): Record<string, string> {
  return inMemoryAccessToken ? { Authorization: `Bearer ${inMemoryAccessToken}` } : {};
}

// Shared promise for concurrent 401 refresh prevention
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        setAccessToken(null);
        return null;
      }

      const data = await res.json();
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        return data.accessToken;
      }

      setAccessToken(null);
      return null;
    } catch (_) {
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const headers = {
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && !isRetry && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
    // Access token expired: attempt silent refresh using HTTP-only cookie
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry original request once with new access token
      return request<T>(endpoint, options, true);
    }
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson.message) {
        errorMessage = Array.isArray(errorJson.message)
          ? errorJson.message.join(', ')
          : errorJson.message;
      }
    } catch (_) {}
    throw new Error(errorMessage);
  }

  // Handle empty 204 responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Auth
  async login(email: string, password: string) {
    const data = await request<any>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const accessToken = data.accessToken || data.tokens?.accessToken;
    if (accessToken) {
      setAccessToken(accessToken);
    }
    return data;
  },

  async me() {
    return request<User>('/auth/me');
  },

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string) {
    return request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
  },

  async requestPasswordReset(email: string) {
    return request<{ message: string }>('/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  },

  async confirmPasswordReset(data: { token: string; newPassword: string; confirmPassword: string }) {
    return request<{ message: string }>('/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeader(),
        credentials: 'include',
      });
    } catch (_) {
      // Ignore logout request errors and clean local state
    } finally {
      setAccessToken(null);
      localStorage.removeItem('nyaya_access_token');
      localStorage.removeItem('nyaya_refresh_token');
    }
  },

  // Admin User Management
  async getUsers() {
    return request<User[]>('/admin/users');
  },

  async getUserById(userId: string) {
    return request<User>(`/admin/users/${userId}`);
  },

  async createUser(data: { email: string; fullName: string; password: string; role: RoleName }) {
    return request<User>('/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async updateUserRole(userId: string, role: RoleName) {
    return request<User>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
  },

  async updateUserStatus(userId: string, isActive: boolean) {
    return request<User>(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
  },

  // Dashboard
  async getDashboard() {
    return request<DashboardStats>('/dashboard');
  },

  // Cases
  async getCases() {
    return request<Case[]>('/cases');
  },

  async getCaseById(caseId: string) {
    return request<Case>(`/cases/${caseId}`);
  },

  async createCase(data: { caseNumber: string; title: string; description?: string }) {
    return request<Case>('/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async assignUser(caseId: string, data: { userId: string; roleInCase?: string }) {
    return request<any>(`/cases/${caseId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  // Documents
  async getDocumentsForCase(caseId: string) {
    return request<Document[]>(`/cases/${caseId}/documents`);
  },

  async getDocumentById(documentId: string) {
    return request<Document>(`/documents/${documentId}`);
  },

  async getVersionsForDocument(documentId: string) {
    return request<DocumentVersion[]>(`/documents/${documentId}/versions`);
  },

  async uploadDocument(caseId: string, formData: FormData) {
    const headers = getAuthHeader();
    const res = await fetch(`${API_BASE}/cases/${caseId}/documents`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Upload failed: ${res.statusText}`);
    }
    return res.json();
  },

  async createRevision(documentId: string, formData: FormData) {
    const headers = getAuthHeader();
    const res = await fetch(`${API_BASE}/documents/${documentId}/versions`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Revision failed: ${res.statusText}`);
    }
    return res.json();
  },

  async fetchVerifiedBlob(documentId: string, versionId: string) {
    const headers = getAuthHeader();
    const res = await fetch(`${API_BASE}/documents/${documentId}/versions/${versionId}/download`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Verification failed with HTTP ${res.status}`);
    }

    const sha256 = res.headers.get('X-Document-SHA256');
    const contentType = res.headers.get('Content-Type');
    const blob = await res.blob();
    return { blob, sha256, contentType };
  },

  async downloadVersion(documentId: string, versionId: string, filename: string) {
    const { blob, sha256 } = await this.fetchVerifiedBlob(documentId, versionId);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { sha256 };
  },

  // Workflow Actions
  async submitForReview(documentId: string) {
    return request<Approval>(`/documents/${documentId}/submit-for-review`, {
      method: 'POST',
    });
  },

  async approveDocument(documentId: string, versionId: string, comments?: string) {
    return request<Approval>(`/documents/${documentId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionId, comments }),
    });
  },

  async sealDocument(documentId: string) {
    return request<Document>(`/documents/${documentId}/seal`, {
      method: 'POST',
    });
  },

  async getApprovals(documentId: string) {
    return request<Approval[]>(`/documents/${documentId}/approvals`);
  },

  // Search
  async searchDocuments(params: {
    q?: string;
    caseId?: string;
    classification?: DocumentClassification;
    status?: DocumentStatus;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params.q) query.append('q', params.q);
    if (params.caseId) query.append('caseId', params.caseId);
    if (params.classification) query.append('classification', params.classification);
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());

    return request<SearchDocumentsResponse>(`/documents/search?${query.toString()}`);
  },

  // Security Incidents
  async getIncidents() {
    return request<SecurityIncident[]>('/security-incidents');
  },

  async updateIncidentStatus(incidentId: string, status: IncidentStatus) {
    return request<SecurityIncident>(`/security-incidents/${incidentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  },

  // Audit Chain & Tamper Demo
  async getAuditEvents(params?: { startDate?: string; endDate?: string }) {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<AuditEvent[]>(`/security/audit-events${queryString}`);
  },

  async verifyAuditChain() {
    return request<{ valid: boolean; totalEvents?: number; brokenAtSequence?: number; reason?: string; checkedAt: string }>(
      '/security/audit-chain/verify',
      { method: 'POST' }
    );
  },

  async simulateTamper(versionId: string) {
    return request<{
      success: boolean;
      message: string;
      versionId: string;
      storagePath: string;
      trustedDbHash: string;
    }>('/security/simulate-tamper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionId }),
    });
  },

  // Public Registration
  async register(payload: {
    email: string;
    fullName: string;
    password: string;
    requestedRole: RoleName;
  }) {
    return request<{ message: string; status: string; detail: string }>('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  // ADMIN Registration Approval
  async getPendingRegistrations() {
    return request<RegistrationRequest[]>('/admin/users/registrations/all');
  },

  async approveRegistration(id: string) {
    return request<User>(`/admin/users/registrations/${id}/approve`, {
      method: 'POST',
    });
  },

  async rejectRegistration(id: string, rejectionReason?: string) {
    return request<RegistrationRequest>(`/admin/users/registrations/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionReason }),
    });
  },
};
