# NyayaVault — Complete Testing Guide

This guide provides exhaustive instructions for verifying, testing, and validating the **NyayaVault v1.0.0** Secure Digital Evidence Management System.

It covers automated test suite execution, step-by-step local role-based testing, security & cryptographic integrity checks, tamper simulation, permissioned blockchain network verification, API testing, negative security scenarios, and safe production read-only smoke testing.

---

## 1. Testing Objectives

Executing this testing guide validates the following core guarantees of NyayaVault:
* **System & Service Availability:** Backend API and Frontend SPA operational readiness.
* **Authentication Security:** Argon2id hashing, short-lived JWT access tokens, HttpOnly/Secure refresh token rotation, RFC 6238 TOTP MFA, and password reset flows.
* **Access Control Enforcement:** Multi-tenant Role-Based Access Control (RBAC) and dynamic Case-Based Access Control (CBAC).
* **Cryptographic Evidence Integrity:** Direct SHA-256 calculation at ingestion and automated byte-level verification prior to streaming downloads.
* **Envelope Encryption at Rest:** Verification of AES-256-GCM binary payload encryption using the authenticated `NYEV` binary envelope header format.
* **Evidence Lifecycle Governance:** Unidirectional state machine transitions (`DRAFT` &rarr; `UNDER_REVIEW` &rarr; `APPROVED` &rarr; `SEALED`) and version immutability.
* **Tamper-Evident Audit Logging:** Cryptographic SHA-256 hash chaining of sequence-numbered audit events and linear log verification scan.
* **Automated Incident Response:** Immediate creation of `CRITICAL` security incident records upon checksum mismatches or unauthorized access attempts.
* **Secure Evidence Sharing:** Recipient-bound, time-restricted, revocable share links with SHA-256 hashed token storage.
* **Distributed Blockchain Consensus:** Four-node Proof-of-Authority (PoA) block anchoring, secp256k1 signature validation, Merkle root verification, and state synchronization.

---

## 2. Testing Modes & Environment Boundaries

NyayaVault testing is classified into five distinct testing modes. Always adhere to the safety boundaries for each mode.

```text
+---------------------------------------------------------------------------------------+
| TESTING MODE              | PERMITTED ENVIRONMENTS | DATA MUTATION ALLOWED            |
+---------------------------------------------------------------------------------------+
| A. Automated Test Suite   | Local / CI Container   | Yes (Isolated Test DB / Mocks)   |
| B. Local Manual Role Flow | Local Development      | Yes (Development Seeded DB)      |
| C. Cryptographic & Security| Local Development     | Yes (Local Storage / Test Data)  |
| D. Blockchain Verification| Local Development      | Yes (Local Node Instances)       |
| E. Production Read-Only   | Staging / Production   | NO (STRICTLY READ-ONLY SMOKE)    |
+---------------------------------------------------------------------------------------+
```

> [!CAUTION]
> Mode E (Production Read-Only Smoke Testing) **MUST NEVER** mutate data, run migrations, invoke tamper simulation endpoints, upload test evidence, or reset database tables.

---

## 3. Environment Prerequisites

Ensure the testing host has the following tools installed and verified:

| Tool / Dependency | Required Version | Verification Command |
| :--- | :--- | :--- |
| **Node.js** | `v20.x.x` (LTS recommended) | `node -v` |
| **npm** | `v10.x.x` or higher | `npm -v` |
| **Git** | `v2.40+` | `git --version` |
| **PostgreSQL** | `v15+` (Local or Supabase) | `psql --version` |
| **cURL** | Any modern build | `curl --version` |

---

## 4. Local Installation & Environment Setup

Follow this step-by-step sequence to prepare a clean local testing environment.

### Step 1: Clone & Install Dependencies

```bash
# Clone repository
git clone https://github.com/PANTH2517/NyayaVault.git
cd NyayaVault

# Install Backend packages
cd backend
npm install

# Install Frontend packages
cd ../frontend
npm install
```

### Step 2: Configure Environment Variables

Create `backend/.env` (do NOT expose real credentials):

```ini
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/nyayavault_dev?schema=public"
DIRECT_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/nyayavault_dev?schema=public"
JWT_SECRET="YOUR_LOCAL_TEST_JWT_SECRET_32_CHARS_MIN"
JWT_REFRESH_SECRET="YOUR_LOCAL_TEST_REFRESH_SECRET_32_CHARS_MIN"
DOCUMENT_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
SUPABASE_URL="https://YOUR_SUPABASE_PROJECT_ID.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="YOUR_LOCAL_SUPABASE_SERVICE_ROLE_KEY"
SUPABASE_STORAGE_BUCKET="documents"
TAMPER_SIMULATION_ENABLED=true
CORS_ORIGIN="http://localhost:5173"
```

Create `frontend/.env`:

```ini
VITE_API_BASE_URL="http://localhost:3000/api/v1"
```

---

## 5. Database Initialization & Seeding

Run the safe database setup pipeline to generate Prisma client models, apply database schema migrations, and populate local seed personas.

```bash
cd backend

# Generate Prisma Client
npx prisma generate

# Execute migrations on development database
npx prisma migrate dev --name init

# Seed development test personas and initial case data
npm run seed
```

---

## 6. Seed Personas & Test Credentials

> [!IMPORTANT]
> The credentials below are **LOCAL DEVELOPMENT SEED CREDENTIALS ONLY** populated by `prisma/seed.ts` for local offline testing. They must **NEVER** be used in staging or production environments.

| Role | Name | Email | Password | Primary Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | System Administrator | `admin@nyayavault.gov.in` | `Admin@Nyaya2026` | User management, audit log scan, security incidents |
| **INVESTIGATING_OFFICER** | Officer Rajesh Sharma | `io.sharma@nyayavault.gov.in` | `Officer@Nyaya2026` | Case creation, evidence upload, versioning, review submit |
| **SUPERVISOR** | ACP Vikram Verma | `super.verma@nyayavault.gov.in` | `Super@Nyaya2026` | Evidence review, approval, comment logging, sealing |
| **PROSECUTOR** | Adv. Ananya Mehta | `prosecutor.mehta@nyayavault.gov.in` | `Prosecutor@Nyaya2026` | Evidence inspection, byte verification download, share redemption |

---

## 7. Starting Local Application Servers

```bash
# Terminal 1: Launch Backend API Server
cd backend
npm run start:dev

# Terminal 2: Launch Frontend Client Server
cd frontend
npm run dev
```

### Verification Endpoints
Verify local server health prior to proceeding:
* **Frontend Web App:** `http://localhost:5173`
* **Backend Health Check:** `http://localhost:3000/health`
* **API Health Endpoint:** `http://localhost:3000/api/v1/health`

Expected response from `GET /api/v1/health`:
```json
{
  "status": "ok",
  "timestamp": "2026-09-12T23:20:15.000Z",
  "uptime": 12.45
}
```

---

## 8. Mode A: Automated Test Suites

NyayaVault includes Jest automated test suites covering encryption key parsing, authenticated envelope construction, authentication logic, integrity checking, and hash chain verification.

### Run All Automated Backend Unit/Integration Tests

```bash
cd backend
npm test
```

### Run Specific Core Service Unit Tests

```bash
# Document Encryption & NYEV Envelope Specification Tests
npx jest src/documents/test/document-encryption.service.spec.ts

# Authentication, Password Hashing & Refresh Token Tests
npx jest src/auth/auth.service.spec.ts

# Document Integrity & SHA-256 Checksum Verification Tests
npx jest src/documents/test/document-integrity.service.spec.ts

# Cryptographic Audit Chain Verification Tests
npx jest src/audit/audit.service.spec.ts
```

### Run TypeScript Compilation & Code Quality Verification

```bash
# Backend static type check & linting
cd backend
npx tsc --noEmit
npm run lint

# Frontend static type check & linting
cd ../frontend
npx tsc --noEmit
npm run lint
```

---

## 9. Mode B: Manual Role-Based Workflows

### Test Suite 1: System Administrator Workflow

1. Open `http://localhost:5173/login` in your browser.
2. Log in using `admin@nyayavault.gov.in` / `Admin@Nyaya2026`.
3. **Dashboard Verification:** Confirm administrative metrics panel displays Total Cases, System Security Incidents, Pending User Approvals, and Blockchain Status.
4. **User Management:**
   * Navigate to `/admin/users`.
   * Register a new user on `/register` in an incognito window (`test.officer@nyayavault.gov.in`).
   * As Admin, locate `test.officer@nyayavault.gov.in` in the user list and click **Approve**. Confirm status updates to `ACTIVE`.
5. **Audit Ledger Inspection:**
   * Navigate to `/audit`.
   * Click **Verify Audit Integrity**.
   * Confirm green notification: `AUDIT TRAIL INTEGRITY VERIFIED (0 Tamper Anomalies Detected)`.
6. **Blockchain Observability:**
   * Navigate to `/blockchain`.
   * Verify all 4 authority nodes (`POLICE_NODE`, `PROSECUTION_NODE`, `COURT_NODE`, `ADMIN_NODE`) display `ACTIVE` or `READY` status.

### Test Suite 2: Investigating Officer (IO) Workflow

1. Log in as `io.sharma@nyayavault.gov.in` / `Officer@Nyaya2026`.
2. **Assigned Case Navigation:**
   * Navigate to `/cases`.
   * Verify access is restricted to cases explicitly assigned to Officer Sharma (e.g., `CASE-2026-001`).
3. **Evidence Upload (`DRAFT` State):**
   * Open assigned case details page (`/cases/<case-id>`).
   * Click **Upload New Evidence**.
   * Select a test file (e.g., `forensic_disk_image.raw` or `cctv_footage.mp4`).
   * Enter document title and classification metadata. Click **Upload**.
   * Verify uploaded document displays status tag **`DRAFT`** and SHA-256 hash preview.
4. **Version Creation:**
   * Open the uploaded document details page (`/documents/<doc-id>`).
   * Click **Upload New Version**. Select an updated version of the test file.
   * Confirm Version `v2` is appended while Version `v1` remains accessible and immutable in version history.
5. **Submit for Review:**
   * Click **Submit for Review**.
   * Confirm document lifecycle status updates from `DRAFT` to **`UNDER_REVIEW`**.

### Test Suite 3: Supervisor Review & Sealing Workflow

1. Log in as `super.verma@nyayavault.gov.in` / `Super@Nyaya2026`.
2. **Review Queue Inspection:**
   * Navigate to `/documents`. Filter or select documents with status `UNDER_REVIEW`.
   * Open the submitted evidence document from Test Suite 2.
3. **Evidence Approval:**
   * Review file metadata, version history, and SHA-256 hashes.
   * Enter review comment: *"Forensic acquisition procedure validated according to standard protocol."*
   * Click **Approve Document**.
   * Confirm document lifecycle status transitions to **`APPROVED`**.
4. **Permanent Sealing:**
   * Click **Seal Evidence**.
   * Confirm modal warning: *"Sealing permanently locks evidence versioning and metadata."*
   * Click **Confirm Cryptographic Seal**.
   * Verify document lifecycle status transitions to **`SEALED`**. Verify **Upload New Version** button is permanently disabled.

### Test Suite 4: Prosecutor Inspection & Verified Download

1. Log in as `prosecutor.mehta@nyayavault.gov.in` / `Prosecutor@Nyaya2026`.
2. **Case Evidence Inspection:**
   * Navigate to `/cases` and select assigned case `CASE-2026-001`.
   * Select the sealed evidence document.
3. **Verified Evidence Download:**
   * Click **Download Verified Binary**.
   * Observe client verification toast: **`BYTE VERIFIED`**.
   * Compute SHA-256 of downloaded file locally (`sha256sum downloaded_file.ext`) and verify it matches the SHA-256 displayed in the UI exactly.

---

## 10. Mode C: Cryptographic Integrity & Security Tests

### Scenario 1: Cryptographic Integrity Verification Pass

```bash
# 1. Create a dummy evidence test payload
echo "CRITICAL_FORENSIC_EVIDENCE_PAYLOAD_2026" > /tmp/evidence_test.txt

# 2. Compute local SHA-256 checksum
# On Linux/macOS:
sha256sum /tmp/evidence_test.txt
# On Windows PowerShell:
Get-FileHash -Algorithm SHA256 /tmp/evidence_test.txt

# 3. Upload file via IO portal interface
# 4. Download file via Prosecutor interface
# 5. Compute SHA-256 of downloaded binary
# 6. VERIFY: Output hash of step 2 and step 5 are IDENTICAL.
```

### Scenario 2: Controlled Tamper Simulation (Dev Only)

> [!NOTE]
> Requires `TAMPER_SIMULATION_ENABLED=true` in `backend/.env`.

1. Log in as `admin@nyayavault.gov.in` or `io.sharma@nyayavault.gov.in`.
2. Open a disposable test document in `DRAFT` or `APPROVED` status.
3. Obtain Document ID from the URL (`/documents/<document-id>`).
4. Invoke tamper simulation API via cURL:

```bash
curl -X POST http://localhost:3000/api/v1/security/tamper-simulate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"documentId": "YOUR_TARGET_DOCUMENT_ID"}'
```

5. Attempt to download the document via the web interface or API (`GET /api/v1/documents/<document-id>/download`).
6. **EXPECTED SYSTEM RESPONSE:**
   * Server returns **HTTP 403 Forbidden** (Integrity Check Failure).
   * Web UI displays prominent red alert: **`EVIDENCE INTEGRITY FAILURE DETECTED`**.
   * DocumentVersion status changes to **`COMPROMISED`**.
   * A **`CRITICAL`** security incident is created in `/security/incidents`.
   * An entry is written to the audit log recording the hash discrepancy.

---

## 11. Mode D: Permissioned Blockchain Network Tests

### Scenario 1: Blockchain Status & Telemetry Check

Send a GET request to the blockchain observability endpoint:

```bash
curl -s http://localhost:3000/api/v1/blockchain/status | jq .
```

**EXPECTED RESPONSE STRUCTURE:**
```json
{
  "success": true,
  "data": {
    "networkName": "NyayaVault-PoA-Main",
    "consensus": "Proof-of-Authority",
    "blockHeight": 42,
    "tipHash": "0x8f3c7...b2a1",
    "activeNodes": [
      { "nodeId": "POLICE_NODE", "status": "ACTIVE" },
      { "nodeId": "PROSECUTION_NODE", "status": "ACTIVE" },
      { "nodeId": "COURT_NODE", "status": "ACTIVE" },
      { "nodeId": "ADMIN_NODE", "status": "ACTIVE" }
    ],
    "totalAnchors": 128,
    "mempoolSize": 0
  }
}
```

### Scenario 2: Evidence State Anchor Verification
1. Upload a new evidence file as Investigating Officer.
2. Check `GET /api/v1/blockchain/status`.
3. Confirm `totalAnchors` count increments by 1.
4. Verify that a new block header containing the transaction Merkle Root has been created and signed by authority node secp256k1 keys.

---

## 12. Case-Based Access Control (CBAC) Positive/Negative Matrix

Execute the following test matrix to confirm access isolation across assigned vs unassigned users:

| Request Scenario | Actor Role | Case Assignment | Target Action | Expected Result |
| :--- | :--- | :---: | :--- | :--- |
| **Scenario A** | Investigating Officer | Assigned | View Case Details | **HTTP 200 OK** (Access Granted) |
| **Scenario B** | Investigating Officer | Unassigned | View Case Details | **HTTP 403 Forbidden** |
| **Scenario C** | Prosecutor | Assigned | Download Evidence | **HTTP 200 OK** (Bytes Streamed) |
| **Scenario D** | Prosecutor | Unassigned | Download Evidence | **HTTP 403 Forbidden** |
| **Scenario E** | Prosecutor | Assigned | Upload New Version | **HTTP 403 Forbidden** (RBAC Deny) |
| **Scenario F** | Investigating Officer | Assigned | Seal Document | **HTTP 403 Forbidden** (RBAC Deny) |
| **Scenario G** | Admin | Unassigned | View Case Details | **HTTP 200 OK** (Admin Global Bypass) |

---

## 13. Secure Evidence Sharing Verification

1. Log in as `io.sharma@nyayavault.gov.in`.
2. Open an approved document and click **Share Evidence**.
3. Set Recipient Email (`advocate.external@lawfirm.in`), Expiration Hours (`24`), and Maximum Access Count (`3`).
4. Click **Generate Secure Share Link**. Copy generated token URL.
5. In an incognito window (unauthenticated), navigate to the share URL.
6. **EXPECTED BEHAVIOR:**
   * File payload can be viewed/downloaded without logging in.
   * Access count increments in database.
7. Return to IO browser session and click **Revoke Share**.
8. Refresh incognito window.
9. **EXPECTED BEHAVIOR:** Server returns **HTTP 403 Forbidden / Share Expired or Revoked**.

---

## 14. API Reference cURL Examples

Replace `<ACCESS_TOKEN>` with your active JWT token obtained from `POST /api/v1/auth/login`.

### 1. User Login Request
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "io.sharma@nyayavault.gov.in", "password": "Officer@Nyaya2026"}'
```

### 2. Audit Trail Verification Request
```bash
curl -X GET http://localhost:3000/api/v1/audit/verify \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### 3. Fetch Case Evidence List
```bash
curl -X GET http://localhost:3000/api/v1/cases/CASE_ID_HERE/documents \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## 15. Mode E: Production Read-Only Smoke Test Guidelines

> [!WARNING]
> Production smoke testing must strictly be observational. Follow these rigid constraints:

### Permitted Production Verification Actions
* Load production login page (`https://nyayavault.vercel.app`).
* Execute health check endpoint (`https://nyayavault-ot1f.onrender.com/health`).
* Log in using valid authorized credentials.
* View Dashboard metrics, case lists, document metadata, audit logs, and blockchain status.
* Download authorized evidence files to verify production SHA-256 client verification.
* Log out and confirm session termination.

### Strictly Prohibited Production Actions
* ❌ DO NOT run database migrations (`npx prisma migrate dev`).
* ❌ DO NOT run database seed scripts (`npm run seed`).
* ❌ DO NOT invoke tamper simulation API (`POST /api/v1/security/tamper-simulate`).
* ❌ DO NOT create dummy/test cases or upload test files.
* ❌ DO NOT modify environment variables or secret keys.
* ❌ DO NOT execute write/update/delete requests directly against database.

---

## 16. Comprehensive Troubleshooting Matrix

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **`npm test` fails with connection error** | Test DB connection string missing or PostgreSQL unavailable. | Ensure PostgreSQL service is running locally. Set `DATABASE_URL` in environment. |
| **`HTTP 401 Unauthorized` on API requests** | JWT access token expired (15m limit) or refresh cookie missing. | Re-authenticate via `/auth/login` or execute refresh token call `/auth/refresh`. |
| **`HTTP 403 Forbidden` on Case Access** | Requesting user is not assigned to target case in `CaseAssignment`. | Log in as Admin and assign user to case via `/api/v1/cases/:id/assignments`. |
| **`BYTE VERIFICATION FAILED` on Download** | Local encryption key mismatch or file payload corruption. | Verify `DOCUMENT_ENCRYPTION_KEY` matches upload key. Check server logs for decryption errors. |
| **Audit Verification Fails (`HASH_CHAIN_BROKEN`)** | Direct database modification detected in `AuditEvent` table. | Re-seed local development database (`npm run seed`). Never modify `AuditEvent` manually. |
| **Blockchain Nodes Offline / Desynchronized** | Node initialization error or missing anchor transaction. | Check `GET /api/v1/blockchain/status`. Restart backend server to run `ChainSynchronizer`. |

---

## 17. QA Verification Checklist Template

Use this reusable template for recording official QA testing passes:

```text
================================================================================
NYAYAVAULT QA TEST EXECUTION REPORT
================================================================================
Date: ________________________   Environment: [ ] Local  [ ] Staging  [ ] Prod
Tester: ______________________   Commit Hash: __________________________________

[ ] 1. ENVIRONMENT & BUILD VERIFICATION
    [ ] Node.js & npm version check passed
    [ ] TypeScript compilation clean (Backend & Frontend)
    [ ] ESLint clean (Backend & Frontend)

[ ] 2. AUTOMATED TEST SUITE EXECUTION
    [ ] All Jest unit & integration tests passing (`npm test`)
    [ ] Document encryption unit tests passed
    [ ] Auth & Argon2id unit tests passed
    [ ] Audit chain unit tests passed

[ ] 3. ROLE-BASED ACCESS CONTROL (RBAC & CBAC)
    [ ] Admin user management & approvals verified
    [ ] IO case isolation & assigned case upload verified
    [ ] Supervisor approval & sealing workflow verified
    [ ] Prosecutor read-only access & verified download verified
    [ ] CBAC negative test matrix (HTTP 403 on unassigned cases) verified

[ ] 4. CRYPTOGRAPHIC EVIDENCE INTEGRITY & SECURITY
    [ ] Raw file SHA-256 matching post-download verified
    [ ] AES-256-GCM NYEV binary envelope structure confirmed
    [ ] Version immutability (v1 preserved when v2 added) verified
    [ ] Sealed evidence immutability verified
    [ ] Controlled tamper simulation failure (HTTP 403 + Incident) verified

[ ] 5. AUDIT LEDGER & BLOCKCHAIN
    [ ] Audit hash chain scan clean (`GET /api/v1/audit/verify`)
    [ ] Blockchain telemetry healthy (`GET /api/v1/blockchain/status`)
    [ ] 4 PoA authority nodes ACTIVE and synchronized

[ ] 6. PRODUCTION SAFETY COMPLIANCE
    [ ] Zero secrets exposed in configuration or logs
    [ ] No production mutations executed

OVERALL VERDICT: [ ] PASS   [ ] FAIL   [ ] CONDITIONAL PASS
Notes: _________________________________________________________________________
================================================================================
```

---

## 18. Testing Philosophy & Multi-Layered Controls

A passing UI test alone does not establish legal or forensic chain of custody. 

NyayaVault's security model relies on interlocking, multi-layered defensive controls:

```text
[ Authentication (Argon2id + JWT + MFA) ]
           |
           v
[ Access Control (RBAC + Dynamic CBAC) ]
           |
           v
[ Envelope Encryption (AES-256-GCM NYEV Header) ]
           |
           v
[ Payload Integrity Verification (SHA-256 Dual-Pass) ]
           |
           v
[ Cryptographic Audit Ledger (SHA-256 Hash Chaining) ]
           |
           v
[ Distributed Provenance (4-Node PoA Blockchain Anchoring) ]
```

Every layer acts as an independent security boundary. If one boundary is breached or bypassed, subsequent cryptographic controls (hash chains, authenticated encryption tags, and permissioned blockchain signatures) immediately flag the anomaly and block evidence access.

---

## 19. Documentation Cross-References

* 📖 **[Primary Repository Documentation (README.md)](README.md)**
* 📋 **[Engineering Constitution (PROJECT_RULES.md)](PROJECT_RULES.md)**
