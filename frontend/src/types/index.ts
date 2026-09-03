export type RoleName = 'ADMIN' | 'INVESTIGATING_OFFICER' | 'SUPERVISOR' | 'PROSECUTOR';
export type CaseStatus = 'OPEN' | 'UNDER_INVESTIGATION' | 'CLOSED' | 'ARCHIVED';
export type DocumentClassification = 'RESTRICTED' | 'CONFIDENTIAL' | 'HIGHLY_CONFIDENTIAL';
export type DocumentStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'SEALED';
export type IncidentType = 'DOCUMENT_TAMPER_DETECTED' | 'AUDIT_CHAIN_VERIFICATION_FAILED' | 'REPEATED_UNAUTHORIZED_ACCESS' | 'SUSPICIOUS_DOCUMENT_ACTION';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: RoleName;
  isActive?: boolean;
}

export interface CaseAssignment {
  id: string;
  caseId: string;
  userId: string;
  roleInCase?: string;
  assignedAt: string;
  user?: User;
}

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  description?: string;
  status: CaseStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: User;
  assignments?: CaseAssignment[];
  documents?: Document[];
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  storagePath: string;
  fileSizeBytes: string;
  mimeType: string;
  sha256Hash: string;
  isCompromised: boolean;
  changeDescription?: string;
  createdById: string;
  createdAt: string;
  createdBy?: User;
}

export interface Approval {
  id: string;
  documentId: string;
  versionId: string;
  requestedById: string;
  approvedById?: string;
  status: DocumentStatus;
  comments?: string;
  requestedAt: string;
  decidedAt?: string;
  requestedBy?: User;
  approvedBy?: User;
  version?: {
    id: string;
    versionNumber: number;
    sha256Hash: string;
  };
}

export interface Document {
  id: string;
  caseId: string;
  title: string;
  documentType: string;
  classification: DocumentClassification;
  currentStatus: DocumentStatus;
  currentVersionId?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  case?: {
    id: string;
    caseNumber: string;
    title: string;
  };
  versions?: DocumentVersion[];
  approvals?: Approval[];
}

export interface SecurityIncident {
  id: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  caseId?: string;
  documentId?: string;
  versionId?: string;
  status: IncidentStatus;
  description: string;
  detectedAt: string;
  resolvedAt?: string;
  case?: Case;
  document?: Document;
  version?: DocumentVersion;
}

export interface AuditEvent {
  id: string;
  sequenceNumber: string;
  eventType: string;
  userId?: string;
  caseId?: string;
  documentId?: string;
  versionId?: string;
  action: string;
  metadata?: any;
  previousEventHash?: string;
  currentEventHash: string;
  createdAt: string;
  user?: {
    fullName: string;
    role: RoleName;
    email: string;
  };
  case?: {
    caseNumber: string;
    title: string;
  };
  document?: {
    title: string;
  };
}

export interface DashboardStats {
  role: RoleName;
  totalCases: number;
  totalDocuments: number;
  underReviewCount: number;
  approvedCount: number;
  sealedCount: number;
  openIncidentsCount: number;
  recentActivity: AuditEvent[];
}

export interface SearchDocumentsResponse {
  data: Document[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
