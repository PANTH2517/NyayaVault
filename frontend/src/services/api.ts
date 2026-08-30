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
} from '../types';

const API_BASE = '/api/v1';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('nyaya_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

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
  async login(email: string, passwordHash: string) {
    const data = await request<{
      user: User;
      tokens: { accessToken: string; refreshToken: string };
    }>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: passwordHash }),
    });

    localStorage.setItem('nyaya_access_token', data.tokens.accessToken);
    localStorage.setItem('nyaya_refresh_token', data.tokens.refreshToken);
    return data;
  },

  async me() {
    return request<User>('/auth/me');
  },

  logout() {
    localStorage.removeItem('nyaya_access_token');
    localStorage.removeItem('nyaya_refresh_token');
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
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Revision failed: ${res.statusText}`);
    }
    return res.json();
  },

  async downloadVersion(documentId: string, versionId: string, filename: string) {
    const headers = getAuthHeader();
    const res = await fetch(`${API_BASE}/documents/${documentId}/versions/${versionId}/download`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Download failed with HTTP ${res.status}`);
    }

    const sha256 = res.headers.get('X-Document-SHA256');
    const blob = await res.blob();
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
  async getAuditEvents() {
    return request<AuditEvent[]>('/security/audit-events');
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
};
