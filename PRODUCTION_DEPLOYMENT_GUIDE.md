# NYAYAVAULT PRODUCTION DEPLOYMENT & READINESS GUIDE
**Phase 1O — Production Deployment Readiness + Controlled Cloud Deployment**

---

## 1. Executive Summary & Architecture Overview

NyayaVault is an enterprise-grade Digital Evidence Management System (DEMS) built on a zero-trust, permissioned Proof-of-Authority (PoA) blockchain framework. The system architecture is distributed across four production service tiers:

```
┌────────────────────────────────────────────────────────┐
│                   Vercel Frontend                      │
│            https://nyayavault.vercel.app               │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ HTTPS / REST API
                            ▼
┌────────────────────────────────────────────────────────┐
│               Render Application Backend               │
│        https://nyayavault-backend.onrender.com         │
│     (NestJS: Auth, RBAC, CBAC, Integrity Monitor)      │
└──────────────┬───────────────────────────┬─────────────┘
               │                           │
  HTTPS Gateway Submission                 │ Prisma ORM / AES-256 Storage
  (x-app-service-auth)                     ▼
               │                ┌────────────────────────┐
               │                │  Supabase Cloud DB     │
               │                │ PostgreSQL + Encrypted │
               │                │ Storage Buckets        │
               │                └────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────┐
│      Four-Node Permissioned PoA Blockchain Network     │
│             (Render Private Web Services)              │
│                                                        │
│  1. nyayavault-police-node     (Port 5001)             │
│  2. nyayavault-prosecution-node (Port 5002)            │
│  3. nyayavault-court-node       (Port 5003)            │
│  4. nyayavault-admin-node       (Port 5004)            │
└────────────────────────────────────────────────────────┘
```

---

## 2. Production Environment Inventory & Variable Mapping

### A. Application Backend Service (`nyayavault-backend`)

| Environment Variable | Description | Security Rule |
|---|---|---|
| `NODE_ENV` | Application runtime environment | Must be `production` |
| `PORT` | HTTP listen port | Set by Render (`10000`) |
| `DATABASE_URL` | PostgreSQL connection pooler URL | Pooled Supabase connection string |
| `DIRECT_URL` | Direct PostgreSQL connection URL | Direct Supabase connection string (for migrations) |
| `JWT_SECRET` | Access token signing secret | High entropy 256-bit hex secret |
| `JWT_EXPIRATION` | Access token TTL | `15m` |
| `REFRESH_TOKEN_SECRET` | Refresh token signing secret | High entropy 256-bit hex secret |
| `REFRESH_TOKEN_EXPIRATION` | Refresh token TTL | `7d` |
| `FRONTEND_URL` | Allowed CORS origin | Exact Vercel URL (e.g. `https://nyayavault.vercel.app`) |
| `SUPABASE_URL` | Supabase API endpoint | `https://<ref>.supabase.co` |
| `SUPABASE_KEY` | Supabase service role key | Service role key with bucket access |
| `SUPABASE_STORAGE_BUCKET` | Evidence file bucket name | `nyayavault-documents` |
| `DOCUMENT_ENCRYPTION_KEY` | AES-256-GCM master encryption key | 32-byte (64 hex character) key |
| `MFA_ENCRYPTION_KEY` | TOTP secret encryption key | 32-byte (64 hex character) key |
| `MFA_CHALLENGE_SECRET` | Auth challenge token secret | High entropy 256-bit secret |
| `BLOCKCHAIN_GATEWAY_URL` | Physical node gateway URL | `https://nyayavault-police-node.onrender.com` |
| `BLOCKCHAIN_APP_SERVICE_SECRET` | Machine-to-machine auth token | High entropy shared secret token |

### B. Blockchain Node Services (x4 Services)

Each blockchain node service (`nyayavault-police-node`, `nyayavault-prosecution-node`, `nyayavault-court-node`, `nyayavault-admin-node`) requires:

| Environment Variable | Description | Example / Node-Specific Value |
|---|---|---|
| `BLOCKCHAIN_NODE_ID` | Node identity | `POLICE_NODE` \| `PROSECUTION_NODE` \| `COURT_NODE` \| `ADMIN_NODE` |
| `BLOCKCHAIN_CHAIN_ID` | Network chain identifier | `nyayavault-mainnet-1` |
| `BLOCKCHAIN_LISTEN_HOST` | Bind interface | `0.0.0.0` |
| `BLOCKCHAIN_LISTEN_PORT` | Listen port | `5001` (Police), `5002` (Pros), `5003` (Court), `5004` (Admin) |
| `BLOCKCHAIN_PEER_URLS` | Peer URL mapping | `POLICE_NODE=https://nyayavault-police-node.onrender.com,...` |
| `BLOCKCHAIN_PEER_ALLOWLIST` | Allowlisted node IDs | `POLICE_NODE,PROSECUTION_NODE,COURT_NODE,ADMIN_NODE` |
| `BLOCKCHAIN_NODE_KEY_PEM` | Node secp256k1 private key | PEM format private key string |
| `BLOCKCHAIN_APP_SERVICE_SECRET` | Gateway auth token | Same shared secret as backend service |
| `DATABASE_URL` | Persistent store database | Supabase connection string |

### C. Frontend Web Application (`nyayavault-frontend`)

| Environment Variable | Description | Production Value |
|---|---|---|
| `VITE_API_BASE_URL` | Backend REST API endpoint | `https://nyayavault-backend.onrender.com/api` |

---

## 3. Secret Management & Security Policies

1. **Zero Secret Exposure**:
   - No private keys, JWT secrets, database credentials, or encryption keys are committed to Git or logged in API responses.
2. **Key Isolation**:
   - Each of the four blockchain authority nodes uses a distinct secp256k1 key pair. Keys are injected via environment variables (`BLOCKCHAIN_NODE_KEY_PEM`).
3. **Entropy Requirements**:
   - `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `DOCUMENT_ENCRYPTION_KEY`, `MFA_ENCRYPTION_KEY`, `MFA_CHALLENGE_SECRET`, and `BLOCKCHAIN_APP_SERVICE_SECRET` must be generated using cryptographically secure random number generators (e.g. `crypto.randomBytes(32).toString('hex')`).

---

## 4. CORS & HTTPS Network Security

- **Strict CORS**: `backend/src/main.ts` enforces `origin: process.env.FRONTEND_URL` with `credentials: true`. Wildcards (`*`) and arbitrary origin reflection are strictly prohibited.
- **HTTPS Enforcement**: All production traffic (Vercel -> Render, Render -> Supabase, Render -> Node Services) passes over TLS 1.3 / HTTPS.
- **Peer Connection Isolation**: Internal node HTTP endpoints (`/api/v1/node/message`) enforce peer allowlisting and domain-separated message envelope signatures under `NYAYAVAULT_CONSENSUS_V1`.

---

## 5. Health & Readiness Probe Configuration

Render services must configure health check probes as follows:

| Service | Health Check Path | Expected Status | Readiness Logic |
|---|---|---|---|
| `nyayavault-backend` | `/api/health` | HTTP 200 | Alive & DB connected |
| `nyayavault-police-node` | `/api/v1/node/ready` | HTTP 200 | Returns 200 if `READY`, 503 if `INITIALIZING` / `REHYDRATING` / `FAILED` / `DIVERGED` |
| `nyayavault-prosecution-node` | `/api/v1/node/ready` | HTTP 200 | Returns 200 if `READY`, 503 if not ready |
| `nyayavault-court-node` | `/api/v1/node/ready` | HTTP 200 | Returns 200 if `READY`, 503 if not ready |
| `nyayavault-admin-node` | `/api/v1/node/ready` | HTTP 200 | Returns 200 if `READY`, 503 if not ready |

---

## 6. Database Migration & Schema Safety

1. **Additive-Only Migrations**:
   - All 6 Prisma migrations (`20260903000000_add_password_reset_tokens`, `20260904000000_add_registration_requests`, `20260907000000_add_blockchain_persistence`, `20260907010000_add_blockchain_application_anchors`, `20260907020000_add_mfa_authentication`, `20260907030000_add_document_encryption_metadata`) are non-destructive and additive.
2. **Migration Command**:
   ```bash
   npx prisma migrate deploy
   ```
3. **Prohibited Commands**: `prisma migrate reset`, `DROP DATABASE`, and `TRUNCATE` are strictly forbidden in production.

---

## 7. Supabase Shared Database Trust Model Analysis

> [!IMPORTANT]
> **Logical Isolation vs Physical Database Isolation**
> - In multi-node deployments sharing a single Supabase PostgreSQL instance, physical node ledgers enforce logical isolation using composite keys: `@@unique([nodeId, chainId, height])` and `@@unique([nodeId, chainId, txId])`.
> - **Logical Isolation**: `POLICE_NODE` cannot query `COURT_NODE` local ledger state as its own, and identical committed blocks exist in separate table rows.
> - **Infrastructure Trust**: The single database administrator holds physical credentials to all tables.
> - **Production Hardening Recommendation**: For true zero-trust jurisdictional separation, each authority node should connect to an independently administered PostgreSQL instance.

---

## 8. Rollback Strategy & Emergency Procedures

1. **Frontend Rollback**: Instant one-click deployment rollback in Vercel dashboard.
2. **Backend & Node Rollback**: Revert deployment commit in Render dashboard.
3. **Database Safety**: Never run down-migrations destructively. Schema updates are forward-compatible.
4. **Blockchain State Protection**: If a node enters `DIVERGED` state, consensus halts automatically. Ledger history is never forcibly deleted or overwritten.

---

## 9. Production Readiness Checklist

- [x] Backend TypeScript compilation clean (`0 errors`)
- [x] Full backend Jest regression suite passing (`46/46 suites`, `412/412 tests`)
- [x] Focused Phase 1N physical HTTP node suite passing (`34/34 tests`)
- [x] Frontend production build clean (`dist/index.html`, `built in 56.69s`)
- [x] All 6 Prisma migrations verified safe & additive
- [x] 0 secrets committed in source code or Git tracking
- [x] Strict CORS origin configuration enforced
- [x] AES-256-GCM document encryption & RFC 6238 MFA enabled
- [x] Node health & readiness endpoints (`/health`, `/ready`, `/status`) implemented
- [x] Live database baseline counts preserved (`0 delta`)
