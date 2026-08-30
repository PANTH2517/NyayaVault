# NyayaVault — Project Rules and Engineering Constitution

## 1. Project Identity

**Project Name:** NyayaVault

**Project Type:** Secure Digital Document Management System for Legal and Investigation Documents

**Primary Objective:**
Build a secure, centralized, and intelligent platform that enables authorized law-enforcement, legal, and investigative stakeholders to store, organize, retrieve, share, verify, and manage sensitive case-related documents while preserving confidentiality, traceability, document integrity, version history, and evidentiary accountability.

The system manages documents including:

* FIRs and police reports
* Investigation records
* Witness statements
* Charge sheets
* Court filings
* Evidence records
* Forensic reports
* Legal notices
* Judgments
* Supporting attachments

---

# 2. Locked Technology Stack

The following technology stack is locked unless the project owner explicitly approves a change.

## Frontend

* React
* Vite
* TypeScript
* Tailwind CSS
* shadcn/ui
* Lucide React

## Backend

* NestJS
* TypeScript
* Prisma ORM

## Database and Storage

* Supabase PostgreSQL
* Supabase Storage

## Authentication and Security

* JWT Access Tokens
* Refresh Tokens
* Argon2 Password Hashing
* Role-Based Access Control
* Case-Based Access Control
* SHA-256 Document Hashing
* Hash-Chained Audit Trail

## Search

* PostgreSQL Full-Text Search
* Metadata-Based Filtering

## Deployment

* Vercel — Frontend
* Render — Backend
* Supabase — PostgreSQL Database and Document Storage

---

# 3. Technologies That Must NOT Be Added Without Approval

Do not introduce the following technologies unless explicitly requested by the project owner:

* Docker
* Kubernetes
* Microservices
* Full Blockchain
* MongoDB
* Firebase
* Redis
* Elasticsearch
* Kafka
* RabbitMQ
* Keycloak
* GraphQL
* Next.js
* Separate authentication providers
* Paid AI APIs as a core dependency

Do not change the database, storage provider, backend framework, frontend framework, or deployment architecture without explicit approval.

Keep the architecture simple and appropriate for an SIH prototype.

---

# 4. Core System Modules

The system consists of the following modules:

1. Authentication
2. User and Role Management
3. Case Management
4. Case Assignment
5. Document Management
6. Document Upload and Storage
7. Document Version Control
8. Access Control
9. Document Integrity Verification
10. Audit and Chain of Custody
11. Security Incident Management
12. Search and Filtering
13. Approval Workflow
14. Dashboard and Monitoring

Do not build all modules simultaneously.

Implement and verify one module at a time.

---

# 5. Core Security Principles

Security decisions must always be enforced by the backend.

The frontend may hide or disable actions for usability, but it must never be treated as the source of authorization truth.

Every sensitive operation must be validated server-side.

Sensitive operations include:

* Viewing confidential documents
* Downloading documents
* Uploading documents
* Creating a new version
* Changing document status
* Approving or rejecting documents
* Assigning users to cases
* Changing user roles
* Changing document classification
* Accessing audit records
* Handling security incidents

---

# 6. Authentication Rules

Authentication must use:

* Argon2 for password hashing
* JWT access tokens
* Refresh tokens

Passwords must never be stored in plain text.

Passwords must never be returned through APIs.

JWT secrets must never be hardcoded.

Authentication secrets must only exist in environment variables.

The frontend must never receive privileged backend secrets.

---

# 7. Authorization Rules

Authorization must use multiple layers.

A user must satisfy all relevant conditions before accessing a protected resource.

## Authorization Flow

1. Verify the user is authenticated.
2. Identify the authenticated user.
3. Verify the user's role permits the requested action.
4. Verify the user has access to the relevant case.
5. Verify the document classification permits access.
6. Allow or deny the action.
7. Record sensitive actions in the audit trail.

The backend is the final authority for all authorization decisions.

---

# 8. Initial Role Model

Use the following initial roles:

* INVESTIGATING_OFFICER
* SUPERVISOR
* PROSECUTOR
* ADMIN

Do not create unnecessary roles during the initial MVP.

Role permissions must be explicit and easy to audit.

---

# 9. Document Classification

Documents may initially have the following classification levels:

* RESTRICTED
* CONFIDENTIAL
* HIGHLY_CONFIDENTIAL

Classification must affect authorization decisions.

A valid login alone does not automatically grant access to every document.

---

# 10. Case-Based Access Control

A user must not access a case simply because they have a valid account.

Access to case resources must depend on:

* User identity
* User role
* Case assignment
* Required permission
* Document classification where applicable

A user without access to a case must not be able to retrieve its documents by manually guessing or modifying an API endpoint or resource ID.

Authorization checks must occur in the backend for every protected request.

---

# 11. Document Storage Rules

Actual document files must be stored in Supabase Storage.

PostgreSQL must store document metadata and references, including:

* Document ID
* Case ID
* Document type
* Original file name
* Storage path
* Classification
* Current status
* Uploaded by
* Upload timestamp
* Current version reference

Do not store large document files directly inside PostgreSQL.

Do not expose unrestricted public URLs for confidential documents.

Document retrieval must be controlled through the backend or secure, time-limited access mechanisms after authorization.

---

# 12. Document Upload Workflow

The standard upload workflow is:

1. Authenticate the user.
2. Validate role and case access.
3. Validate file type and size.
4. Calculate the SHA-256 hash of the exact file bytes.
5. Store the document in Supabase Storage.
6. Create the document metadata record.
7. Create the first document version.
8. Store the trusted SHA-256 hash for that version.
9. Create an audit event.
10. Return a success response only after the required records are created.

For the MVP, validate at minimum:

* Allowed file extension
* MIME type
* File size

Do not trust only the file extension supplied by the client.

---

# 13. Document Integrity Rules

Each immutable document version must have its own SHA-256 hash.

The trusted hash must correspond to the exact bytes of the stored document version.

Integrity verification must compare:

**Stored trusted hash**

against

**SHA-256 hash calculated from the retrieved document bytes**

Conceptually:

```text
Retrieve Document Bytes
        ↓
Calculate SHA-256
        ↓
Compare With Trusted Stored Hash
        ↓
Match?
   ↙          ↘
YES          NO
 ↓            ↓
VERIFIED   COMPROMISED
```

A document must not be considered verified merely because a hash value exists in the database.

The actual bytes must be checked against the trusted hash.

---

# 14. Automatic Integrity Verification

Integrity verification should occur during important document lifecycle events.

Priority triggers include:

1. Document access or opening
2. Document download
3. Explicit integrity verification request

A scheduled background verification feature may be added later but is not required before the core MVP works.

If verification fails:

1. Mark the relevant document version as compromised or integrity-failed.
2. Create a security incident.
3. Create an audit event.
4. Prevent the system from silently treating the document as trusted.
5. Display a clear integrity warning to authorized users.

Do not silently ignore hash mismatches.

---

# 15. Document Versioning Rules

Existing document versions must never be overwritten.

A revision creates a new version.

Example:

```text
Document
├── Version 1 — Original
├── Version 2 — Revised
└── Version 3 — Approved Revision
```

Each version must have its own:

* Version number
* Storage path
* SHA-256 hash
* Created timestamp
* Created by
* Status

Version numbers must be generated safely to prevent duplicate version numbers under concurrent requests.

The previous version must remain preserved.

---

# 16. Modification and Approval Workflow

Document modifications must follow a controlled workflow.

Initial state model:

```text
DRAFT
  ↓
UNDER_REVIEW
  ↓
APPROVED
  ↓
SEALED
```

Rules:

* A sealed version must not be overwritten.
* Creating a revision creates a new version.
* Approval actions must be performed only by authorized roles.
* Every status transition must be recorded in the audit trail.

Do not allow arbitrary status changes without authorization.

---

# 17. Audit Trail Rules

Every important security or document lifecycle event must generate an audit event.

Audit events include:

* LOGIN
* LOGIN_FAILED
* DOCUMENT_UPLOADED
* DOCUMENT_VIEWED
* DOCUMENT_DOWNLOADED
* DOCUMENT_VERSION_CREATED
* DOCUMENT_STATUS_CHANGED
* DOCUMENT_APPROVED
* DOCUMENT_ACCESS_DENIED
* CASE_ACCESS_GRANTED
* CASE_ACCESS_REVOKED
* INTEGRITY_VERIFIED
* INTEGRITY_FAILED
* SECURITY_INCIDENT_CREATED

An audit event should contain, where relevant:

* Event ID
* User ID
* Case ID
* Document ID
* Document Version ID
* Action
* Timestamp
* Relevant metadata
* Previous event hash
* Current event hash

Sensitive information must not be unnecessarily duplicated in audit metadata.

---

# 18. Hash-Chained Audit Trail

Important audit events must be tamper-evident through hash chaining.

Conceptually:

```text
Event 1
Hash A
   ↓
Event 2
Previous Hash = Hash A
Hash B
   ↓
Event 3
Previous Hash = Hash B
Hash C
```

The current event hash should be derived from the event's canonical data and the previous event hash.

Changing a historical event should cause the chain verification to fail.

Hash chaining is a tamper-evident mechanism.

Do not falsely describe the audit system as a full blockchain.

The system must be able to verify the audit chain and report failures.

---

# 19. Security Incident Rules

A security incident must be created when a significant integrity or security event occurs.

Initial incident types may include:

* DOCUMENT_TAMPER_DETECTED
* AUDIT_CHAIN_VERIFICATION_FAILED
* REPEATED_UNAUTHORIZED_ACCESS
* SUSPICIOUS_DOCUMENT_ACTION

A security incident should contain:

* Incident ID
* Incident type
* Severity
* Related case
* Related document or version where applicable
* Detection timestamp
* Status
* Description

For the MVP, notification can be represented through an in-app security alert or dashboard indicator.

External email or SMS notification is not required.

---

# 20. Search Requirements

Search must support efficient document retrieval using metadata and PostgreSQL capabilities.

The MVP should support searching or filtering by:

* Case number
* Case name
* Document name
* Document type
* Date
* Status
* Classification
* Uploaded user

Do not make AI semantic search a dependency of the core product.

AI and OCR are optional enhancements after the core system is stable.

---

# 21. Database Design Principles

The database should initially include entities conceptually similar to:

* User
* Role
* Case
* CaseAssignment
* Document
* DocumentVersion
* AuditEvent
* Approval
* SecurityIncident

Prefer clear relational relationships.

Do not duplicate data unnecessarily.

Use database constraints where appropriate.

The backend authorization logic remains responsible for enforcing complex business permissions.

---

# 22. Frontend Rules

The frontend is responsible for:

* User interface
* User interaction
* Form validation
* Displaying authorized data
* Calling backend APIs
* Showing security and integrity status
* Displaying audit history

The frontend must not:

* Contain service-role credentials
* Decide final authorization
* Bypass backend security checks
* Directly expose unrestricted confidential files

Do not spend excessive development time on animations before the core security workflow works.

---

# 23. Backend Rules

The backend is responsible for:

* Authentication
* Authorization
* Case access validation
* Document metadata management
* Version creation
* File operation authorization
* Integrity verification
* Audit creation
* Audit chain verification
* Security incident creation
* Search APIs
* Approval workflow

Keep modules cohesive.

Do not introduce microservices.

Do not create unnecessary abstraction layers.

Prefer simple, maintainable NestJS modules and services.

---

# 24. API Development Rules

Use consistent REST API conventions.

Validate request data using DTOs and validation.

Return appropriate HTTP status codes.

Do not expose:

* Password hashes
* JWT secrets
* Refresh token internals
* Supabase service-role keys
* Internal stack traces in production responses

API endpoints must enforce authorization independently of the frontend.

---

# 25. Environment Variable Rules

Secrets must use environment variables.

Never hardcode:

* Database credentials
* Supabase service-role keys
* JWT secrets
* Refresh token secrets
* Production API secrets

`.env` files must not be committed.

Provide an `.env.example` file containing placeholder names only.

---

# 26. Development Workflow Rules

Before implementing a major feature:

1. Read this `PROJECT_RULES.md`.
2. Inspect the existing architecture.
3. Check the current Git status.
4. Create an implementation plan.
5. Implement only the requested feature.
6. Run the relevant application or tests.
7. Fix errors caused by the implementation.
8. Verify existing functionality is not broken.
9. Report changed files.
10. Commit the working milestone.

Do not implement unrelated features while working on a requested task.

---

# 27. Agent Instructions

When working as an AI coding agent:

1. Read `PROJECT_RULES.md` before major changes.
2. Do not change the locked technology stack.
3. Do not rewrite working modules unnecessarily.
4. Prefer the smallest correct change.
5. Do not delete files without explicit approval.
6. Do not run destructive commands without explicit approval.
7. Do not reset Git history.
8. Do not commit secrets.
9. Do not claim a feature works without running relevant verification.
10. Clearly state assumptions and blockers.
11. When uncertain, inspect existing code before inventing a new architecture.
12. Implement one logical feature at a time.

---

# 28. Testing Requirements

Each completed core feature should be tested.

Critical test scenarios include:

## Authentication

* Valid login succeeds.
* Invalid login fails.
* Protected routes reject unauthenticated users.

## Authorization

* Authorized users can access assigned cases.
* Unauthorized users cannot access unassigned cases.
* Backend rejects manually manipulated resource IDs.

## Documents

* Authorized upload succeeds.
* Unauthorized upload fails.
* Metadata is stored correctly.
* File is stored correctly.

## Versioning

* A new revision creates a new version.
* Previous versions remain available.
* Existing versions are not overwritten.

## Integrity

* Original document hash verifies successfully.
* Modified document bytes cause verification failure.
* Integrity failure creates an audit event.
* Integrity failure creates a security incident.

## Audit Chain

* A valid chain verifies successfully.
* Modification of a historical event causes chain verification failure.

---

# 29. Controlled Demo Scenario

The final prototype must support a clear demonstration.

## Scenario

1. An Investigating Officer logs in.
2. The officer accesses an assigned case.
3. The officer uploads a sensitive document.
4. The system generates and stores the SHA-256 hash.
5. The system records the upload in the audit trail.
6. An authorized stakeholder accesses the document.
7. The system verifies document integrity.
8. A controlled tampering scenario modifies the stored document outside the normal workflow.
9. The document is accessed or explicitly verified again.
10. The system detects the hash mismatch.
11. The document is flagged as compromised.
12. A security incident and audit event are displayed.

The tampering demonstration must use actual file-byte modification.

Do not fake tampering detection purely through the frontend UI.

---

# 30. MVP Priority Order

Development priority is:

```text
PHASE 1 — FOUNDATION
Repository Structure
Supabase Configuration
Prisma Configuration
Database Schema
Backend Health Check
Frontend Application Shell

PHASE 2 — ACCESS CONTROL
Authentication
JWT
Roles
RBAC
Case Assignments
Case-Level Authorization

PHASE 3 — DOCUMENT CORE
Case Management
Document Upload
Supabase Storage
Document Metadata
Document Listing

PHASE 4 — SECURITY CORE
SHA-256 Hashing
Document Versions
Audit Events
Hash-Chained Audit Trail
Integrity Verification
Security Incidents

PHASE 5 — PRODUCT COMPLETION
Search
Filtering
Approval Workflow
Dashboard
Audit Trail UI

PHASE 6 — POLISH
UI Improvements
Demo Data
Demo Scenario
Testing
Deployment
PPT and Final Presentation
```

Do not begin optional features until the previous core phase works.

---

# 31. Optional Features

The following are optional and must not delay the MVP:

* OCR using Tesseract.js
* AI semantic search
* Advanced analytics
* Automated scheduled integrity checks
* External system integration
* ICJS or CCTNS integration stubs

These may be presented as future enhancements if not completed.

---

# 32. Definition of Done

A feature is not considered complete merely because code has been generated.

A feature is complete only when:

1. The feature is implemented.
2. The application builds successfully.
3. Relevant tests or manual verification pass.
4. Authorization is enforced correctly.
5. Relevant audit events are created.
6. Existing functionality remains operational.
7. The changed files are documented.
8. The implementation follows this project constitution.

---

# 33. Final Project Principle

The primary goal is not to demonstrate the largest number of technologies.

The primary goal is to demonstrate a complete and trustworthy document lifecycle:

```text
AUTHORIZED USER
       ↓
CASE ACCESS VERIFIED
       ↓
DOCUMENT UPLOADED
       ↓
SHA-256 IDENTITY CREATED
       ↓
SECURE STORAGE
       ↓
VERSION PRESERVED
       ↓
EVERY ACTION AUDITED
       ↓
INTEGRITY AUTOMATICALLY VERIFIED
       ↓
TAMPERING DETECTED AND FLAGGED
```

**Build fewer features, but ensure that every core security workflow genuinely works end-to-end.**

NyayaVault must demonstrate that sensitive legal and investigation documents can be managed with controlled access, traceability, version preservation, tamper detection, and evidentiary accountability.
