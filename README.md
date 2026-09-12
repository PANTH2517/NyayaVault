# NyayaVault

**Secure Digital Evidence Management System**

NyayaVault is an enterprise-grade, cryptographically verifiable Digital Evidence Management System (DEMS) built for law enforcement agencies, prosecution authorities, judicial officers, and legal compliance teams. The system provides end-to-end evidence lifecycle management, multi-tenant role- and case-based access control, zero-trust server-side envelope encryption, cryptographic SHA-256 integrity verification, sequence-numbered hash-chained audit logging, automated security incident generation, and permissioned four-node Proof-of-Authority (PoA) blockchain anchoring.

*Current Release:* **v1.0.0** (Production Commit: `3027c3f25c7980ff982caed0b6ffc306dfdd0081`)

---

## 1. Product Overview

In modern legal and forensic workflows, digital evidence (CCTV footage, intercepted communications, digital forensics disk images, financial logs, and electronic certificates) requires far stronger controls than generic cloud storage or standard document management platforms. 

NyayaVault addresses the critical vulnerabilities of digital evidence handling:

* **Chain of Custody Assurance:** Records every operation—creation, inspection, lifecycle change, sharing, approval, and access attempts—into an immutable, sequence-numbered, hash-chained audit ledger.
* **Cryptographic Evidence Integrity:** Verifies raw evidence payload integrity at ingestion, storage, and retrieval using server-side SHA-256 hash calculation and byte-level comparison.
* **Controlled & Contextual Access:** Combines strict Role-Based Access Control (RBAC) with dynamic Case-Based Access Control (CBAC), ensuring non-administrative users access only evidence belonging to explicitly assigned cases.
* **Envelope Encryption at Rest:** Encrypts every evidence payload binary prior to storage using AES-256-GCM in an authenticated custom `NYEV` binary envelope, protecting sensitive forensic data even if the underlying storage bucket is compromised.
* **Distributed Blockchain Anchoring:** Anchors audit states, evidence version genesis hashes, and state transitions to a permissioned four-node Proof-of-Authority (PoA) blockchain network, creating an undeniable external provenance record.

### Architectural Separation of Responsibilities

To maintain strict operational clarity and security boundaries, NyayaVault separates system concerns:

| Subsystem | Responsibilities |
| :--- | :--- |
| **Evidence Storage** | Private, bucket-level storage (Supabase Storage / local driver) holding AES-256-GCM encrypted `NYEV` binary payloads. Files cannot be accessed directly or publicly. |
| **Evidence Integrity** | Engine responsible for computing raw payload SHA-256 checksums prior to encryption and after decryption during download, asserting zero bit rot or tampering. |
| **Evidence Lifecycle** | Strict finite state machine (`DRAFT` &rarr; `UNDER_REVIEW` &rarr; `APPROVED` &rarr; `SEALED`) governing document version modification, review, and permanent sealing. |
| **Audit Trail** | Monotonic sequence-numbered, SHA-256 hash-chained event ledger stored in PostgreSQL (`AuditEvent`), providing internal forensic tamper evidence. |
| **Blockchain Anchoring** | External cryptographic verification layer. Four independent authority nodes (`POLICE`, `PROSECUTION`, `COURT`, `ADMIN`) sign and consensus-anchor application state checkpoints into block headers using secp256k1 signatures and Merkle trees. |

---

## 2. Core Capabilities

* **Authentication & Session Security**
  * Argon2id password hashing with memory and parallelism parameters.
  * Short-lived 15-minute in-memory JWT Access Tokens.
  * 7-day HttpOnly, Secure, SameSite=None Refresh Token rotation with database session tracking (`UserSession`).
  * RFC 6238 TOTP Multi-Factor Authentication (MFA) with single-use emergency recovery codes.
  * Secure 256-bit hashed password reset tokens with mandatory session revocation upon reset.

* **Authorization & Access Control**
  * Hierarchical Role-Based Access Control (RBAC): `ADMIN`, `INVESTIGATING_OFFICER`, `SUPERVISOR`, `PROSECUTOR`.
  * Dynamic Case-Based Access Control (CBAC) restricting non-admin access to assigned cases (`CaseAssignment`).

* **Evidence & Version Management**
  * Immutable evidence versions (`DocumentVersion`). Uploading a new file version creates a distinct, numbered version record without overwriting previous versions.
  * Automated server-side SHA-256 hash computation during upload and download.
  * AES-256-GCM envelope encryption (`NYEV`) with unique 12-byte IVs and 16-byte authentication tags per version.

* **Lifecycle Governance & Sealing**
  * Four-stage lifecycle: `DRAFT`, `UNDER_REVIEW`, `APPROVED`, `SEALED`.
  * Transition guards enforcing role privileges (e.g., Officers submit for review, Supervisors approve, Supervisors/Admins seal).
  * Permanent immutability upon `SEALED` state; sealed evidence cannot accept new versions or metadata edits.

* **Audit Logging & Incident Automation**
  * Cryptographic hash-chained audit events (`previousEventHash` &rarr; `currentEventHash`).
  * Automated audit chain verification endpoint (`GET /api/v1/audit/verify`).
  * Automatic `SecurityIncident` creation on authentication failure spikes, integrity check failures, or unauthorized access attempts.
  * Controlled development tamper simulation engine (`TAMPER_SIMULATION_ENABLED=true`).

* **Secure External Sharing**
  * Cryptographically secure 256-bit random share tokens with database SHA-256 token hashing (`tokenHash`).
  * Recipient email binding, time-bound expiration, access limit tracking, and instant manual revocation.
  * CBAC re-validation and integrity checks executed prior to serving shared evidence payloads.

* **Permissioned Blockchain Network**
  * Four physical/logical authority nodes: `POLICE_NODE`, `PROSECUTION_NODE`, `COURT_NODE`, `ADMIN_NODE`.
  * Proof-of-Authority (PoA) consensus with secp256k1 ECDSA digital signatures.
  * Merkle root calculations for anchored application state transactions (`BlockchainApplicationAnchor`).
  * Automatic node state synchronization, block persistence, memory pool management, and rehydration on startup.
  * Blockchain status and telemetry monitoring (`GET /api/v1/blockchain/status`).

---

## 3. Security Model

NyayaVault implements a defense-in-depth security architecture designed around zero trust principles.

```
       +-----------------------------------------------------------------------+
       |                           CLIENT LAYER                                |
       |   React 18 SPA (In-Memory Access Token | HttpOnly Refresh Cookie)   |
       +-----------------------------------+-----------------------------------+
                                           | HTTPS / TLS 1.3
                                           v
       +-----------------------------------+-----------------------------------+
       |                           API GATEWAY                                 |
       |   NestJS API (Throttler / CORS / JwtAuthGuard / RolesGuard / CBAC)   |
       +-----------------------------------+-----------------------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
                    v                                             v
+-------------------+-------------------+       +-----------------+-----------------+
|         CORE APPLICATION LOGIC        |       |        BLOCKCHAIN NETWORK       |
|  - Argon2id Password Verification     |       |  - 4 PoA Authority Nodes        |
|  - AES-256-GCM Envelope Encryption    |       |  - secp256k1 ECDSA Signatures   |
|  - SHA-256 Integrity Verification     |       |  - Merkle Root Calculation      |
|  - Hash-Chained Audit Engine          |       |  - Block Persistence & Sync     |
+-------------------+-------------------+       +-----------------+-----------------+
                    |                                             |
                    v                                             v
+-------------------+-------------------+       +-----------------+-----------------+
|         DATABASE STORAGE              |       |     ENCRYPTED BLOB STORAGE        |
|  PostgreSQL / Supabase (Prisma ORM)   |       | Supabase Private Bucket (`NYEV`)  |
+---------------------------------------+       +-----------------------------------+
```

### Authentication Architecture
1. **Password Hashing:** Passwords are hashed using Argon2id (`argon2` module) with high memory costs, preventing GPU/ASIC rainbow table attacks.
2. **Access Tokens:** Short-lived (15 minutes) JWTs stored strictly in application memory. Never persisted in `localStorage` or `sessionStorage`.
3. **Refresh Tokens:** Cryptographically random tokens returned in `HttpOnly`, `Secure`, `SameSite=None` (or `Lax` in local dev) cookies (`nyaya_refresh_token`). Tokens are stored in hashed format in the `UserSession` database table and rotated on every use.
4. **Session Revocation:** Logging out invalidates the database session, clearing the refresh cookie and revoking all active refresh tokens for that session.

### Access Control Layers
* **Role-Based Access Control (RBAC):** `RolesGuard` verifies user roles against route decorators (`@Roles(...)`).
* **Case-Based Access Control (CBAC):** `CbacGuard` queries `CaseAssignment` to verify that the requesting user is explicitly assigned to the case housing the target evidence. Admin users bypass CBAC for global oversight.

### Cryptographic Security Disclaimer
> [!IMPORTANT]
> Cryptographic integrity guarantees depend on operational security. System integrity relies upon proper secret key management (`DOCUMENT_ENCRYPTION_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET`), secure HTTPS/TLS termination, database access isolation, non-root container deployment, and periodic independent security audits.

---

## 4. Evidence Security Pipeline

Every digital evidence file processed by NyayaVault undergoes a dual-pass cryptographic pipeline during upload and download.

### Evidence Upload Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Officer as Investigating Officer
    participant API as NestJS API Gateway
    participant Engine as Integrity & Crypto Service
    participant Bucket as Private Supabase Storage
    participant DB as PostgreSQL Database
    participant BC as PoA Blockchain Network

    Officer->>API: Upload Evidence File (Multipart Form)
    API->>Engine: Process Raw Bytes Buffer
    Engine->>Engine: Calculate SHA-256 Checksum (Trusted Hash)
    Engine->>Engine: Generate 12-byte IV & Encrypt (AES-256-GCM)
    Engine->>Engine: Construct NYEV Binary Envelope
    Engine->>Bucket: Write Encrypted NYEV Payload
    Bucket-->>Engine: Storage Path Confirmed
    Engine->>DB: Save Document & DocumentVersion (SHA-256, Metadata)
    Engine->>DB: Append Hash-Chained AuditEvent (UPLOAD_DOCUMENT)
    Engine->>BC: Propose Application Anchor (Genesis Merkle Root)
    BC-->>API: Transaction Anchored in Block
    API-->>Officer: Upload Success (SHA-256 Verified, HTTP 201)
```

### Evidence Download Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor User as Authorized User (IO/Prosecutor)
    participant API as NestJS API Gateway
    participant Guard as RBAC & CBAC Guards
    participant Bucket as Private Supabase Storage
    participant Engine as Integrity & Crypto Service
    participant DB as PostgreSQL Database

    User->>API: Request Document Download (GET /api/v1/documents/:id/download)
    API->>Guard: Verify JWT & Case Assignment
    Guard-->>API: Access Granted
    API->>Bucket: Retrieve Encrypted NYEV Payload Binary
    Bucket-->>API: Return Encrypted Bytes
    API->>Engine: Decrypt NYEV Envelope (AES-256-GCM)
    Engine->>Engine: Re-compute Decrypted SHA-256 Checksum
    Engine->>DB: Fetch Trusted SHA-256 Checksum from DocumentVersion
    alt Hashes Match Exactly
        Engine-->>API: Integrity Verified (BYTE VERIFIED)
        API->>DB: Append AuditEvent (DOWNLOAD_DOCUMENT)
        API-->>User: Stream Original Binary Payload
    else Hash Mismatch / Decryption Failure
        Engine->>DB: Mark Version Status as COMPROMISED
        Engine->>DB: Create CRITICAL SecurityIncident
        Engine->>DB: Append AuditEvent (INTEGRITY_FAILURE)
        API-->>User: Access Denied (HTTP 403 Forbidden / Integrity Violation)
    end
```

---

## 5. Binary Envelope Encryption (`NYEV`)

All evidence payloads stored in blob storage are wrapped in a proprietary binary envelope format designated by the magic header `NYEV`.

### `NYEV` Binary Envelope Specification

```text
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|   'N'   |   'Y'   |   'E'   |   'V'   | EnvVer(0x01) | KeyVer |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
| KeyVer  | Reserved|            12-Byte IV (Bytes 0-3)         |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                     12-Byte IV (Bytes 4-11)                   |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|               16-Byte Auth Tag (Bytes 0-7)                    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|               16-Byte Auth Tag (Bytes 8-15)                   |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                     AES-256-GCM Ciphertext                    +
|                                                               |
```

* **Magic Header (4 Bytes):** ASCII string `NYEV` (`0x4E 0x59 0x45 0x56`).
* **Envelope Version (1 Byte):** Version format indicator (`0x01`).
* **Key Version (2 Bytes):** Big-endian key rotation identifier (`0x0001`).
* **Reserved Byte (1 Byte):** Padding for byte alignment (`0x00`).
* **Initialization Vector (12 Bytes):** Cryptographically random IV generated per file using `crypto.randomBytes(12)`.
* **GCM Authentication Tag (16 Bytes):** Galois/Counter Mode authentication tag generated by AES-256-GCM.
* **Payload Ciphertext (Variable Bytes):** AES-256 encrypted raw evidence file bytes.

### Envelope Key Management
Key material is loaded from the environment variable `DOCUMENT_ENCRYPTION_KEY`. 
The key management engine resolves the key via two supported formats:
1. **Hexadecimal String (Preferred):** Exactly 64 hex characters representing 32 raw bytes (256 bits).
2. **Raw String (Fallback):** String converted to UTF-8 and padded/truncated to exactly 32 bytes.

> [!CAUTION]
> Never commit `DOCUMENT_ENCRYPTION_KEY` to source control. Changing the encryption key without re-encrypting existing database payloads will render legacy evidence binary payloads unreadable.

---

## 6. Cryptographic Audit Trail

All system activities are recorded in a tamper-evident audit ledger backed by the `AuditEvent` table in PostgreSQL.

### Hash Chaining Mechanics

Each `AuditEvent` record contains a SHA-256 checksum calculated from its payload concatenated with the `currentEventHash` of the preceding record:

$$\text{currentEventHash}_n = \text{SHA-256}\left(\text{previousEventHash}_{n-1} \parallel \text{sequenceNumber}_n \parallel \text{action}_n \parallel \text{userId}_n \parallel \text{documentId}_n \parallel \text{timestamp}_n\right)$$

```text
[ Genesis Event #1 ]
  previousHash: "0000000000000000000000000000000000000000000000000000000000000000"
  currentHash:  "a1b2c3d4..."
       |
       v
[ Audit Event #2 ]
  previousHash: "a1b2c3d4..."
  currentHash:  "e5f6g7h8..."
       |
       v
[ Audit Event #3 ]
  previousHash: "e5f6g7h8..."
  currentHash:  "i9j0k1l2..."
```

### Verification & Tamper Detection
Calling the verification API (`GET /api/v1/audit/verify`) executes a full linear scan of the audit log:
* Confirms sequence numbers are strictly monotonic without gaps or duplicates.
* Re-computes every `currentEventHash` and compares it against the stored hash.
* Verifies that `previousEventHash` matches the prior record's `currentEventHash`.

If any historical audit record is inserted, updated, or deleted directly via database queries, the hash chain breaks at that sequence number, causing verification to fail and raising an immediate `CRITICAL` security incident.

---

## 7. Controlled Tamper Detection Simulation

NyayaVault includes a controlled tamper detection simulation framework for security testing and live demonstration of integrity failure handling.

> [!WARNING]
> Tamper simulation is strictly a **DEVELOPMENT AND DEMONSTRATION FEATURE**. It requires setting `TAMPER_SIMULATION_ENABLED=true` in the backend environment. It must **NEVER** be enabled in production environments.

### Tamper Simulation Workflow

```text
1. Select Target Document Version (DRAFT / UNDER_REVIEW / APPROVED)
                      |
                      v
2. Trigger API: POST /api/v1/security/tamper-simulate
                      |
                      v
3. Simulation Engine alters binary bytes directly in private storage bucket
   (e.g., appends trailing noise bytes to the encrypted payload)
                      |
                      v
4. Subsequent Download Attempt: GET /api/v1/documents/:id/download
                      |
                      v
5. Integrity Engine decrypts binary and re-computes SHA-256 hash
                      |
                      v
6. Hash Mismatch Detected: Re-computed SHA-256 != Trusted SHA-256
                      |
                      v
7. SYSTEM RESPONSE:
   - Download blocked immediately (HTTP 403 Forbidden).
   - DocumentVersion status updated to "COMPROMISED".
   - CRITICAL SecurityIncident created in database.
   - AuditEvent logged recording integrity violation.
```

---

## 8. Permissioned Blockchain Architecture

NyayaVault incorporates a permissioned, lightweight, multi-node Proof-of-Authority (PoA) blockchain network running alongside the primary NestJS application.

### Four-Node Authority Network

```
+-----------------------------------------------------------------------------------+
|                            POA BLOCKCHAIN NETWORK                                 |
|                                                                                   |
|  +-------------------+   secp256k1   +-------------------+                        |
|  |    POLICE_NODE    | <-----------> |  PROSECUTION_NODE |                        |
|  | (Police Auth)     |               | (Prosecutor Auth) |                        |
|  +---------+---------+               +---------+---------+                        |
|            |                                   |                                  |
|            | ECDSA                             | ECDSA                            |
|            v                                   v                                  |
|  +---------+---------+               +---------+---------+                        |
|  |    COURT_NODE     | <-----------> |    ADMIN_NODE     |                        |
|  | (Judicial Auth)   |               | (System Admin)    |                        |
|  +-------------------+               +-------------------+                        |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v Merkle Root Anchoring
+-----------------------------------------+-----------------------------------------+
|                  POSTGRESQL / SUPABASE DATABASE                           |
|  Table: BlockchainApplicationAnchor (Height, BlockHash, TxHash, StateRoot)       |
+-----------------------------------------------------------------------------------+
```

### Consensus & Anchoring Rules
* **Nodes:** Four physical/logical nodes initialized with distinct secp256k1 keypairs (`POLICE_NODE`, `PROSECUTION_NODE`, `COURT_NODE`, `ADMIN_NODE`).
* **Consensus Engine:** Proof-of-Authority (PoA) requiring digital signatures from designated authority node keypairs before a block proposal is accepted into the ledger.
* **Merkle Root Verification:** Evidence upload events, status transitions, and sealing operations emit canonical anchor payloads. These transactions are organized into Merkle Trees; the calculated Merkle Root is stored in the block header.
* **State Synchronization & Rehydration:** On application boot, `ChainSynchronizer` checks memory state against database persistent records (`BlockchainApplicationAnchor`), rehydrating uncommitted blocks and resolving network state gaps.
* **Observability Endpoint:** Detailed network telemetry (node statuses, block height, tip hash, memory pool size, anchor counts) is accessible via `GET /api/v1/blockchain/status`.

---

## 9. System Architecture & Technology Stack

### End-to-End System Component Architecture

```
+-----------------------------------------------------------------------------------+
|                                  USER BROWSER                                     |
|  React 18 Single Page Application (Vite + TypeScript + Tailwind CSS)               |
+----------------------------------------+------------------------------------------+
                                         | HTTPS / TLS
                                         v
+----------------------------------------+------------------------------------------+
|                             API GATEWAY & BACKEND                                 |
|  NestJS Framework (TypeScript)                                                     |
|  - ThrottlerGuard (Rate Limiting)      - JwtAuthGuard & RolesGuard                |
|  - CbacGuard (Case Access)             - DocumentEncryptionService (AES-256-GCM)  |
|  - DocumentIntegrityService (SHA-256)  - AuditService (Hash Chaining)            |
|  - BlockchainGatewayService            - SecurityService (Incident Manager)       |
+-------------------+-----------------------------------+---------------------------+
                    |                                   |
                    v                                   v
+-------------------+-------------------+   +-----------+---------------------------+
|         PRIMARY DATABASE              |   |          BLOB STORAGE                 |
|  Supabase PostgreSQL (Prisma 5 ORM)   |   | Supabase Private Storage Bucket       |
|  - Users, Sessions, Cases             |   | - Holds encrypted `.nyev` binary       |
|  - Documents, Versions, Shares        |   |   payloads. Restricted to NestJS      |
|  - AuditEvents, SecurityIncidents     |   |   backend service-role client.        |
+---------------------------------------+   +---------------------------------------+
```

### Technology Stack Inventory

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^18.2.0` | UI Component Framework |
| **Build Tooling** | Vite | `^5.1.4` | Development Server & Production Bundler |
| **Language** | TypeScript | `^5.3.3` | Static Type Safety (Frontend & Backend) |
| **Styling Engine** | Tailwind CSS | `^3.4.1` | Utility-First Responsive Styling |
| **Animation Engine** | Framer Motion | `^11.0.8` | UI Motion & Page Transition System |
| **Icon Library** | Lucide React | `^0.344.0` | Production Icon Set |
| **Backend Framework** | NestJS | `^10.0.0` | Modular Enterprise API Server |
| **Database ORM** | Prisma | `^5.10.2` | Database Modeling, Migrations, Query Engine |
| **Database Engine** | PostgreSQL / Supabase | `PostgreSQL 15+` | Relational Persistence & JSON B-Tree Storage |
| **Blob Storage** | Supabase Storage | `S3 Compatible` | Private Evidence Binary Store |
| **Password Hashing** | Argon2id | `^0.44.0` | High-Memory Key Derivation |
| **Cryptography** | Node.js `crypto` | Native | AES-256-GCM & SHA-256 Computation |
| **Blockchain Crypto** | Elliptic (secp256k1) | `^6.5.5` | ECDSA Signature & Key Management |

---

## 10. Repository Structure

```text
NyayaVault/
├── backend/                             # NestJS API Application
│   ├── prisma/
│   │   ├── migrations/                  # Database migration history
│   │   ├── schema.prisma                # Database schema definition
│   │   └── seed.ts                      # Development seed data script
│   ├── src/
│   │   ├── admin/                       # User management & system admin endpoints
│   │   ├── audit/                       # Hash-chained audit trail & verification
│   │   ├── auth/                        # Argon2id, JWT, Refresh Token & MFA logic
│   │   ├── blockchain/                  # 4-node PoA blockchain network & anchors
│   │   ├── cases/                       # Case management & CBAC assignments
│   │   ├── common/                      # Guards, decorators, filters & utilities
│   │   ├── documents/                   # Evidence upload, encryption, download & lifecycle
│   │   ├── health/                      # System health check controllers
│   │   ├── security/                    # Incident management & tamper simulation
│   │   ├── shares/                      # Time-bound secure evidence sharing
│   │   ├── app.module.ts                # Root application NestJS module
│   │   └── main.ts                      # Application bootstrap file
│   ├── test/                            # E2E integration test suites
│   ├── package.json                     # Backend dependencies & scripts
│   └── tsconfig.json                    # Backend TypeScript configuration
├── frontend/                            # React 18 + Vite Frontend Application
│   ├── src/
│   │   ├── components/                  # Reusable UI component hierarchy
│   │   ├── context/                     # Global state (AuthContext, ThemeContext)
│   │   ├── pages/                       # Application view containers
│   │   ├── services/                    # API client layer (Axios instance)
│   │   ├── types/                       # Shared TypeScript interface definitions
│   │   ├── App.tsx                      # Main routing & application wrapper
│   │   └── main.tsx                     # React DOM mount entrypoint
│   ├── package.json                     # Frontend dependencies & scripts
│   └── vite.config.ts                   # Vite build configuration
├── HOW_TO_TEST.md                       # Comprehensive Quality Assurance & Verification Guide
├── README.md                            # Primary Repository Documentation
└── PROJECT_RULES.md                     # Engineering Rules & Architecture Guiding Principles
```

---

## 11. Environment Variables Reference

### Backend Configuration (`backend/.env`)

| Variable | Purpose | Type | Required | Default / Example Value |
| :--- | :--- | :--- | :---: | :--- |
| `PORT` | NestJS server port | Number | Optional | `3000` |
| `NODE_ENV` | Runtime environment mode | String | Required | `development` / `production` |
| `DATABASE_URL` | PostgreSQL connection string | Secret | Required | `postgresql://user:pass@host:5432/db` |
| `DIRECT_URL` | Direct DB connection (Prisma migrations) | Secret | Required | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | 256-bit secret for Access Tokens | Secret | Required | `YOUR_SUPER_SECRET_JWT_KEY` |
| `JWT_REFRESH_SECRET` | 256-bit secret for Refresh Tokens | Secret | Required | `YOUR_SUPER_SECRET_REFRESH_KEY` |
| `DOCUMENT_ENCRYPTION_KEY` | 64-char Hex key for AES-256-GCM | Secret | Required | `64_CHAR_HEXADECIMAL_STRING_HERE` |
| `SUPABASE_URL` | Supabase API Endpoint URL | String | Required | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key | Secret | Required | `YOUR_SUPABASE_SERVICE_ROLE_KEY` |
| `SUPABASE_STORAGE_BUCKET` | Private Evidence Bucket Name | String | Required | `documents` |
| `TAMPER_SIMULATION_ENABLED` | Enable tamper demo endpoint | Boolean | Required | `false` (Set `true` ONLY in dev) |
| `CORS_ORIGIN` | Allowed Client Origin URL | String | Required | `http://localhost:5173` |
| `SMTP_HOST` | Mail Server Hostname | String | Optional | `smtp.mailtrap.io` |
| `SMTP_PORT` | Mail Server Port | Number | Optional | `587` |
| `SMTP_USER` | Mail Server Username | Secret | Optional | `YOUR_SMTP_USER` |
| `SMTP_PASS` | Mail Server Password | Secret | Optional | `YOUR_SMTP_PASSWORD` |
| `SMTP_FROM` | Sender Email Address | String | Optional | `noreply@nyayavault.gov.in` |

### Frontend Configuration (`frontend/.env`)

| Variable | Purpose | Type | Required | Default / Example Value |
| :--- | :--- | :--- | :---: | :--- |
| `VITE_API_BASE_URL` | Base API URL for backend calls | String | Required | `http://localhost:3000/api/v1` |

---

## 12. Quick Start Guide (Local Setup)

Follow these exact A-to-Z steps to set up and run NyayaVault locally.

### Step 1: Prerequisites Verification
Ensure your environment meets the following requirements:
* **Node.js:** `v20.x.x` (LTS) or higher
* **npm:** `v10.x.x` or higher
* **Git:** Installed and available on system path
* **PostgreSQL Database:** Local instance or Supabase cloud instance

### Step 2: Repository Installation

```bash
# 1. Clone repository
git clone https://github.com/PANTH2517/NyayaVault.git
cd NyayaVault

# 2. Install Backend Dependencies
cd backend
npm install

# 3. Install Frontend Dependencies
cd ../frontend
npm install
```

### Step 3: Environment Configuration

Create `backend/.env` file with appropriate configuration values:

```bash
cd ../backend
cp .env.example .env
```

Update `backend/.env` with your PostgreSQL database connection strings and generate cryptographically random keys for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `DOCUMENT_ENCRYPTION_KEY`.

### Step 4: Database Generation & Migration

```bash
# Run from backend directory
npx prisma generate
npx prisma migrate dev --name init

# Seed development personas and initial case data
npm run seed
```

### Step 5: Start Local Development Servers

```bash
# Terminal 1: Start NestJS Backend API
cd backend
npm run start:dev

# Terminal 2: Start Vite Frontend Client
cd frontend
npm run dev
```

### Step 6: Access & Verification
* **Frontend Portal:** `http://localhost:5173`
* **Backend API Base:** `http://localhost:3000/api/v1`
* **Health Check Endpoints:**
  * `http://localhost:3000/health`
  * `http://localhost:3000/api/v1/health`

---

## 13. User Roles & Access Matrix

NyayaVault enforces four explicit user roles alongside Case-Based Access Control (CBAC).

```text
+------------------------+------------------------------------------------------------------------+
| ROLE                   | PRIMARY RESPONSIBILITIES                                               |
+------------------------+------------------------------------------------------------------------+
| ADMIN                  | System administration, user approvals, MFA resets, blockchain audits   |
| INVESTIGATING_OFFICER  | Case creation, evidence upload, version creation, submission for review |
| SUPERVISOR             | Evidence review, approval, comment logging, evidence sealing           |
| PROSECUTOR             | Read-only evidence inspection, verified downloads, share generation    |
+------------------------+------------------------------------------------------------------------+
```

### Granular Feature Permission Matrix

| Capability / Action | ADMIN | INVESTIGATING_OFFICER | SUPERVISOR | PROSECUTOR |
| :--- | :---: | :---: | :---: | :---: |
| **User Approval & Management** | Yes | No | No | No |
| **System Security Incidents** | Yes | No | Read Only | No |
| **Blockchain Observability** | Yes | Read Only | Read Only | Read Only |
| **Create New Cases** | Yes | Yes | No | No |
| **View Assigned Cases** | All Cases | Assigned Only | Assigned Only | Assigned Only |
| **Upload Evidence (`DRAFT`)** | Yes | Assigned Only | No | No |
| **Create New File Version** | Yes | Assigned Only | No | No |
| **Submit Evidence for Review**| Yes | Assigned Only | No | No |
| **Approve Evidence (`APPROVED`)**| Yes | No | Assigned Only | No |
| **Seal Evidence (`SEALED`)** | Yes | No | Assigned Only | No |
| **Download Evidence Binary** | Yes | Assigned Only | Assigned Only | Assigned Only |
| **Create Secure Share Link** | Yes | Assigned Only | Assigned Only | Assigned Only |

---

## 14. Evidence Lifecycle Governance

Digital evidence transitions through a strict, unidirectional state machine.

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Initial Upload (IO / Admin)
    DRAFT --> UNDER_REVIEW : Submit for Review (IO / Admin)
    UNDER_REVIEW --> APPROVED : Supervisor Approval
    UNDER_REVIEW --> DRAFT : Supervisor Rejection / Revisions Requested
    APPROVED --> SEALED : Permanent Sealing (Supervisor / Admin)
    SEALED --> [*] : Immutable Forensic Lock

    note right of SEALED
        SEALED State Properties:
        - No new versions allowed.
        - Payload bytes immutable.
        - Metadata frozen.
        - Deletion strictly prohibited.
    end note
```

1. **`DRAFT`:** File uploaded by Investigating Officer. Metadata can be edited, new versions added. Visible only to assigned IOs and Admins.
2. **`UNDER_REVIEW`:** Submitted for supervisory check. Editing locked; Supervisor review pending.
3. **`APPROVED`:** Reviewed and validated by Supervisor. Readable by Prosecutors assigned to the case.
4. **`SEALED`:** Permanently locked. Cryptographically sealed. Immutable for lifetime retention.

---

## 15. API Reference Summary

### Authentication (`/api/v1/auth`)
* `POST /auth/register` — Submit user registration request
* `POST /auth/login` — Authenticate user, set refresh cookie, return access token
* `POST /auth/refresh` — Rotate refresh token cookie, issue new access token
* `POST /auth/logout` — Invalidate session and clear refresh cookie
* `GET  /auth/me` — Retrieve current authenticated user profile
* `POST /auth/mfa/setup` — Initialize TOTP MFA enrollment
* `POST /auth/mfa/enable` — Confirm MFA TOTP code and generate recovery codes
* `POST /auth/mfa/disable` — Disable MFA TOTP authentication
* `POST /auth/password-reset/request` — Request password reset link via email
* `POST /auth/password-reset/confirm` — Reset password using cryptographically secure token

### Administration (`/api/v1/admin`)
* `GET  /admin/users` — List pending and active users
* `PATCH /admin/users/:id/approve` — Approve pending registration
* `PATCH /admin/users/:id/status` — Update user status (`ACTIVE` / `SUSPENDED`)
* `POST /admin/users/:id/reset-mfa` — Administrative reset of user MFA

### Cases (`/api/v1/cases`)
* `GET  /cases` — List accessible cases (CBAC filtered)
* `POST /cases` — Create new case file
* `GET  /cases/:id` — Retrieve detailed case overview and assignments
* `POST /cases/:id/assignments` — Assign user to case (Admin / IO)

### Documents & Evidence (`/api/v1/documents`)
* `GET  /documents` — List evidence documents (CBAC filtered)
* `POST /documents/upload` — Ingest new evidence payload (SHA-256 + `NYEV` encryption)
* `GET  /documents/:id` — Retrieve document metadata and version history
* `POST /documents/:id/versions` — Upload new version to existing document
* `PATCH /documents/:id/status` — Advance lifecycle status (`UNDER_REVIEW`, `APPROVED`, `SEALED`)
* `GET  /documents/:id/download` — Decrypt and stream verified evidence payload

### Audit & Security (`/api/v1/audit`, `/api/v1/security`)
* `GET  /audit/events` — Retrieve paginated audit ledger
* `GET  /audit/verify` — Execute cryptographic SHA-256 hash-chain verification scan
* `GET  /security/incidents` — List system security incidents
* `PATCH /security/incidents/:id` — Update incident status (`RESOLVED`, `INVESTIGATING`)
* `POST /security/tamper-simulate` — Controlled tamper demonstration endpoint (Dev Only)

### Secure Shares (`/api/v1/shares`)
* `POST /shares` — Generate time-bound, recipient-restricted evidence share token
* `GET  /shares/access/:token` — Access evidence payload via secure share token
* `POST /shares/:id/revoke` — Revoke active evidence share token

### Blockchain & System Health
* `GET  /api/v1/blockchain/status` — View 4-node PoA blockchain status & metrics
* `GET  /health` & `GET /api/v1/health` — Primary application health endpoints

---

## 16. Troubleshooting & Operational Guidance

| Problem / Error | Cause | Resolution |
| :--- | :--- | :--- |
| **Backend fails to start (`PrismaClientInitializationError`)** | Database connection string invalid or PostgreSQL server unreachable. | Verify `DATABASE_URL` and `DIRECT_URL` in `backend/.env`. Ensure PostgreSQL service is running. |
| **CORS Error on API Call** | Frontend URL mismatch with `CORS_ORIGIN`. | Update `CORS_ORIGIN` in `backend/.env` to match your frontend client URL exactly (e.g., `http://localhost:5173`). |
| **Decryption Failure / Authentication Tag Mismatch** | `DOCUMENT_ENCRYPTION_KEY` altered or key hex parsing mismatch. | Ensure `DOCUMENT_ENCRYPTION_KEY` is a valid 64-character hex string matching the key used during file upload. |
| **Audit Verification Fails (`HASH_CHAIN_BROKEN`)** | Database record inserted, modified, or deleted out of sequence. | Inspect breaking `sequenceNumber`. Audit log tampering detected. Do not modify `AuditEvent` table directly. |
| **Blockchain Nodes Out of Sync** | Node state file discrepancy or unpersisted anchor transaction. | Check `GET /api/v1/blockchain/status`. Restart backend server to trigger `ChainSynchronizer` auto-rehydration. |

---

## 17. Security Notice & Responsible Usage

NyayaVault is built for critical legal environments. Adhere strictly to the following security protocols:
1. **Production Deployment:** Always terminate TLS/HTTPS at the load balancer or API gateway. Never serve API endpoints over unencrypted HTTP.
2. **Secret Management:** Utilize dedicated secret management solutions (e.g., AWS Secrets Manager, HashiCorp Vault) for production credentials.
3. **Database Guardrails:** Never execute `npx prisma migrate reset` or `npx prisma db push --force-reset` on production databases.
4. **Tamper Simulation:** Ensure `TAMPER_SIMULATION_ENABLED` is explicitly set to `false` in production environments.

---

## 18. Testing & Quality Assurance

Comprehensive testing instructions, automated unit/integration test commands, manual role-based QA flows, security verification scenarios, and production smoke testing guidelines are fully documented in:

👉 **[HOW_TO_TEST.md](HOW_TO_TEST.md)**

To run automated backend test suites locally:

```bash
cd backend
npm test
```

---

## 19. License & Release Information

* **Release Version:** `v1.0.0`
* **Release Status:** Production Release (Verified Commit `3027c3f25c7980ff982caed0b6ffc306dfdd0081`)
* **License:** Not currently specified. All rights reserved.
