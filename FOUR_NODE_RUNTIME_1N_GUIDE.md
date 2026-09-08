# PHYSICAL FOUR-NODE RUNTIME DEPLOYMENT & INTEGRATION GUIDE
**NyayaVault Digital Evidence Management System — Phase 1N Architecture Document**

---

## 1. Executive Summary & Four-Node Physical Network Topology

Phase 1N establishes a fully operational, executable Proof-of-Authority (PoA) blockchain network with four distinct authority node processes:

```
                  ┌───────────────────────────────┐
                  │          ADMIN_NODE           │
                  │ NyayaVault Governance Council │
                  │     Default Port: 5004        │
                  └──────────────┬────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   POLICE_NODE   │ ◄─► │PROSECUTION_NODE │ ◄─► │   COURT_NODE    │
│ Law Enforcement │     │  Prosecution    │     │ Judicial High   │
│ Agency (P:5001) │     │ Office (P:5002) │     │ Court (P:5003)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

Each authority node operates as an independent Node.js process executing `src/blockchain-node.main.ts` with its own:
- Dedicated secp256k1 identity and cryptographic domain signer (`NYAYAVAULT_CONSENSUS_V1`).
- Node-scoped persistent ledger (`nodeId` + `chainId`).
- Authenticated HTTP transport over loopback or private network (`/api/v1/node/message`).
- HTTP application gateway entry point (`/api/v1/node/anchor-submission`).
- Lifecycle status machine (`INITIALIZING` -> `REHYDRATING` -> `READY` / `FAILED` / `DIVERGED`).

---

## 2. Local Four-Node Startup & Management Commands

Local npm scripts are provided in `backend/package.json`:

```bash
# Launch single dedicated node processes
npm run blockchain:police       # POLICE_NODE on port 5001
npm run blockchain:prosecution   # PROSECUTION_NODE on port 5002
npm run blockchain:court         # COURT_NODE on port 5003
npm run blockchain:admin         # ADMIN_NODE on port 5004

# Launch generic node process with environment variables
BLOCKCHAIN_NODE_ID=POLICE_NODE BLOCKCHAIN_LISTEN_PORT=5001 npm run blockchain:node

# Launch four-node local orchestrator (spawns 4 physical HTTP node servers on ports 7001-7004)
npm run blockchain:orchestrator
```

> [!NOTE]
> Environment scripts do NOT embed private key material or production secrets in `package.json`.

---

## 3. Environment Variable Configuration Reference

| Variable | Description | Example / Default |
|---|---|---|
| `BLOCKCHAIN_NODE_ID` | Physical node authority type | `POLICE_NODE` \| `PROSECUTION_NODE` \| `COURT_NODE` \| `ADMIN_NODE` |
| `BLOCKCHAIN_CHAIN_ID` | Network chain identifier | `nyayavault-mainnet-1` |
| `BLOCKCHAIN_LISTEN_HOST` | Network bind address | `0.0.0.0` or `127.0.0.1` |
| `BLOCKCHAIN_LISTEN_PORT` | HTTP RPC bind port | `5001` (Police), `5002` (Pros), `5003` (Court), `5004` (Admin) |
| `BLOCKCHAIN_PEER_URLS` | Peer URL mapping list | `POLICE_NODE=http://127.0.0.1:5001,PROSECUTION_NODE=http://127.0.0.1:5002,...` |
| `BLOCKCHAIN_PEER_ALLOWLIST` | Authorized peer node IDs | `POLICE_NODE,PROSECUTION_NODE,COURT_NODE,ADMIN_NODE` |
| `BLOCKCHAIN_NODE_KEY_PEM` | Node secp256k1 private key | `-----BEGIN PRIVATE KEY-----\n...` |
| `BLOCKCHAIN_APP_SERVICE_SECRET` | Machine auth token | `secret-app-service-auth-token` |
| `BLOCKCHAIN_GATEWAY_URL` | Application submission endpoint | `http://127.0.0.1:5001` |

---

## 4. Application to Blockchain Gateway Architecture

The main NyayaVault application service connects to the physical blockchain network via `PhysicalNodeAnchorGateway`:

```
┌─────────────────────────────────┐
│     nyayavault-backend          │
│ (User Auth, RBAC, CBAC, API)    │
└────────────────┬────────────────┘
                 │
                 │ Authenticated HTTP POST (/anchor-submission)
                 │ Header: x-app-service-auth: <BLOCKCHAIN_APP_SERVICE_SECRET>
                 ▼
┌─────────────────────────────────┐
│       POLICE_NODE Gateway       │
│     (Physical Node Process)     │
└────────────────┬────────────────┘
                 │
                 │ PoA Consensus Broadcast over HTTP (/message)
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐   ┌──────────────┐
│ PROSECUTION  │   │  COURT_NODE  │
└──────────────┘   └──────────────┘
```

### Key Gateway Properties:
1. **User Identity Isolation**: Ordinary user JWTs and session tokens cannot sign consensus endorsements or invoke internal peer RPC endpoints.
2. **Machine-to-Machine Auth**: The application service authenticates with the physical node gateway via `X-App-Service-Auth`.
3. **Idempotency**: Submitting identical evidence anchor intents yields idempotent confirmations without duplicate block forging.
4. **Fault Tolerance**: If the physical node gateway is temporarily offline, anchor intents transition safely to `FAILED` with retry capability without corrupting evidence storage.

---

## 5. Health & Readiness Probes

Nodes expose three operational endpoints for monitoring and orchestrator readiness:

- **`GET /api/v1/node/health`**: Returns HTTP 200 with `{ alive: true, ready: boolean, lifecycleState: string, nodeId: string }`.
- **`GET /api/v1/node/ready`**: Returns **HTTP 200** only when `lifecycleState === 'READY'`. Returns **HTTP 503 Service Unavailable** when in `INITIALIZING`, `REHYDRATING`, `FAILED`, `DIVERGED`, or `SHUTTING_DOWN`.
- **`GET /api/v1/node/status`**: Returns safe operational metadata (height, tip hash, peer health, uptime) without exposing private key material.

---

## 6. Restart, Rehydration & Chain Catch-up Lifecycle

1. **Fail-Closed Startup Rehydration**:
   - On boot, `ChainRehydrationService` revalidates genesis block hash, block height continuity, Merkle roots, signatures, and consensus proofs.
   - If persistent chain data is corrupted or tampered with, the process fails closed into `FAILED` state and refuses server binding.

2. **Peer Catch-Up Synchronization**:
   - If a peer process stops and misses committed blocks, upon restarting it discovers its lag via `connectAndSyncPeer`.
   - It fetches missing blocks over HTTP `/api/v1/node/message`, independently validates each block header and PoA proof, appends them to local persistence, and reconverges on the network tip block hash.

3. **Divergence Detection**:
   - If peer synchronization detects a conflicting block at the same height (`SAME_HEIGHT_DIFFERENT_HASH`), the node transitions to `DIVERGED`.
   - A `DIVERGED` node halts all consensus processing, refuses chain overwrites, and flags its health state.

---

## 7. Render Production Deployment Topology (5-Service Architecture)

For production deployment on Render:

- **Service 1**: `nyayavault-backend` (Web Service - NestJS API, handles user JWT auth, RBAC, CBAC).
- **Service 2**: `nyayavault-blockchain-police` (Private Web Service - `BLOCKCHAIN_NODE_ID=POLICE_NODE`, Port 5001).
- **Service 3**: `nyayavault-blockchain-prosecution` (Private Web Service - `BLOCKCHAIN_NODE_ID=PROSECUTION_NODE`, Port 5002).
- **Service 4**: `nyayavault-blockchain-court` (Private Web Service - `BLOCKCHAIN_NODE_ID=COURT_NODE`, Port 5003).
- **Service 5**: `nyayavault-blockchain-admin` (Private Web Service - `BLOCKCHAIN_NODE_ID=ADMIN_NODE`, Port 5004).

Render private network addresses (e.g. `http://nyayavault-police-node:5001`) are configured in `BLOCKCHAIN_PEER_URLS`.

---

## 8. Supabase Shared-Database Trust Analysis

> [!WARNING]
> **Trust Caveat: Shared Database vs Independent Nodes**
> - In early deployment tiers sharing a single Supabase PostgreSQL instance, physical node ledgers are logically isolated using composite primary/unique keys `@@unique([nodeId, chainId, height])`.
> - **Logical Isolation**: POLICE_NODE cannot read COURT_NODE's local chain state as its own, and identical committed blocks exist in distinct node-local table scopes.
> - **Infrastructure Dependency**: Sharing one database backend implies that a database administrator with full credentials has administrative access to all tables.
> - **Production Hardening Recommendation**: For true zero-trust jurisdictional separation, each authority node should connect to an independently administered database instance.
