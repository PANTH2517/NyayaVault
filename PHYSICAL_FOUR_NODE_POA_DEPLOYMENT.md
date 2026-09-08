# PHYSICAL FOUR-NODE PERMISSIONED PoA BLOCKCHAIN DEPLOYMENT GUIDE
**NyayaVault Digital Evidence Management System — Sub-Phase 1M Architecture Document**

---

## 1. Executive Summary & Topology
NyayaVault implements a private, permissioned Proof-of-Authority (PoA) blockchain network. The network consists of four logical and physical authority nodes, representing distinct jurisdictional and supervisory entities:

```
                  ┌───────────────────────────────┐
                  │          ADMIN_NODE           │
                  │ NyayaVault Governance Council │
                  └──────────────┬────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   POLICE_NODE   │ ◄─► │PROSECUTION_NODE │ ◄─► │   COURT_NODE    │
│ Law Enforcement │     │  Prosecution    │     │ Judicial High   │
│     Agency      │     │     Office      │     │      Court      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

Each authority node operates as an independent node process with its own secp256k1 identity, node-scoped persistent ledger, peer allowlist, and authenticated HTTP transport.

---

## 2. Node Identities & Cryptographic Key Management

| Node ID | Authority / Organization | Key Type | Signing Domain | Default Port |
|---|---|---|---|---|
| `POLICE_NODE` | State Law Enforcement Agency | ECDSA secp256k1 | `NYAYAVAULT_CONSENSUS_V1` | 5001 |
| `PROSECUTION_NODE` | Public Prosecutor Office | ECDSA secp256k1 | `NYAYAVAULT_CONSENSUS_V1` | 5002 |
| `COURT_NODE` | Judicial High Court Registry | ECDSA secp256k1 | `NYAYAVAULT_CONSENSUS_V1` | 5003 |
| `ADMIN_NODE` | NyayaVault Governance Council | ECDSA secp256k1 | `NYAYAVAULT_CONSENSUS_V1` | 5004 |

### Key Isolation & Security Rules:
- Private keys are loaded dynamically via `NodeKeyProvider` from environment variables (`BLOCKCHAIN_NODE_KEY_PEM`) or isolated key stores.
- Private key material is never exposed in JSON API responses, status endpoints, or logs.
- Node identity fingerprints are computed as `SHA-256(PublicKeyPem)` and verified across all signed envelopes.

---

## 3. Peer Trust Model & HTTP Transport

### `HttpNodeTransport` Architecture
- Node-to-node machine RPC requests are transmitted over authenticated HTTP POST to `/api/v1/node/message`.
- Requests carry structured `NetworkMessageEnvelope` payloads with `Content-Type: application/json` and `X-Correlation-ID`.
- Every envelope is cryptographically signed using `signDomainPayload` under `NYAYAVAULT_CONSENSUS_V1`.
- Timestamp freshness is strictly bounded (`MAX_MESSAGE_AGE_MS = 300000ms / 5 minutes`) for replay protection.
- Unknown peer node IDs or node IDs missing from `BLOCKCHAIN_PEER_ALLOWLIST` are rejected with HTTP 403 Forbidden.
- Malformed or forged envelope signatures are rejected with HTTP 401 Unauthorized.

---

## 4. Node-Scoped Ledger Persistence

Each physical node process reads and writes ledger data filtered by `nodeId` and `chainId`:
- `BlockchainChain`: `@@unique([nodeId, chainId])`
- `BlockchainBlock`: `@@unique([nodeId, chainId, height])`, `@@unique([nodeId, chainId, blockHash])`
- `BlockchainTransaction`: `@@unique([nodeId, chainId, txId])`
- `BlockchainConsensusProof`: `@@unique([blockId])`
- `BlockchainEndorsement`: `@@unique([proofId, endorserNodeId])`

This schema guarantees node-scoped isolation in multi-node deployments sharing a database backend.

---

## 5. PoA Consensus Policies & Quorum Rules

NyayaVault enforces three immutable Proof-of-Authority consensus policies:

1. **`STANDARD_ANCHOR`** (Evidence creation & standard updates):
   - Minimum Quorum Threshold: **2 valid signatures**
   - Required Organization Node: `POLICE_NODE`
   - Authorized Proposers: `POLICE_NODE`, `ADMIN_NODE`
2. **`SEALED_EVIDENCE`** (Judicial evidence sealing & restricted classification):
   - Minimum Quorum Threshold: **3 valid signatures**
   - Required Organization Nodes: `POLICE_NODE`, `PROSECUTION_NODE`, `COURT_NODE`
   - Authorized Proposers: `POLICE_NODE`, `PROSECUTION_NODE`, `ADMIN_NODE`
3. **`GOVERNANCE_CHECKPOINT`** (Audit log chain checkpointing & network governance):
   - Minimum Quorum Threshold: **3 valid signatures**
   - Required Organization Node: `ADMIN_NODE`
   - Authorized Proposers: `ADMIN_NODE`

---

## 6. Startup & Rehydration Lifecycle

```
[ Process Launch ]
        │
        ▼
 ┌──────────────┐
 │ INITIALIZING │  --> Parse & validate PhysicalNodeConfig env vars
 └──────┬───────┘
        │
        ▼
 ┌──────────────┐
 │ REHYDRATING  │  --> ChainRehydrationService revalidates genesis block,
 └──────┬───────┘      block hashes, Merkle roots, signatures, & proofs
        │
   ┌────┴────────────────────────┐
   ▼                             ▼
┌───────┐                   ┌────────┐
│ READY │                   │ FAILED │
└───────┘                   └────────┘
 (Listens for HTTP RPC)      (Startup aborted; rejects proposals)
```

- If database block hashes, Merkle roots, or transaction IDs fail revalidation, the node transitions to `FAILED` and aborts server binding.
- If network synchronization detects split history or conflicting blocks at the same height (`SAME_HEIGHT_DIFFERENT_HASH`), the peer sync state transitions to `DIVERGED` and rejects chain overwrites.

---

## 7. Required Environment Variables

To launch an independent physical node process, set the following environment variables:

```bash
# Node Identity & Type (Required: POLICE_NODE | PROSECUTION_NODE | COURT_NODE | ADMIN_NODE)
BLOCKCHAIN_NODE_ID=POLICE_NODE
BLOCKCHAIN_CHAIN_ID=nyayavault-mainnet-1

# HTTP Network Binds
BLOCKCHAIN_LISTEN_HOST=0.0.0.0
BLOCKCHAIN_LISTEN_PORT=5001

# Peer Topology Mapping
BLOCKCHAIN_PEER_URLS=POLICE_NODE=http://127.0.0.1:5001,PROSECUTION_NODE=http://127.0.0.1:5002,COURT_NODE=http://127.0.0.1:5003,ADMIN_NODE=http://127.0.0.1:5004
BLOCKCHAIN_PEER_ALLOWLIST=POLICE_NODE,PROSECUTION_NODE,COURT_NODE,ADMIN_NODE

# Operational Timeouts & Limits
BLOCKCHAIN_REQUEST_TIMEOUT_MS=10000
BLOCKCHAIN_MAX_MESSAGE_AGE_MS=300000

# Private Key (PEM format, required in production deployments)
# BLOCKCHAIN_NODE_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n..."
```

---

## 8. Local Four-Node Execution Procedure

To run all four permissioned authority nodes locally:

### Process 1 (Police Node):
```bash
BLOCKCHAIN_NODE_ID=POLICE_NODE BLOCKCHAIN_LISTEN_PORT=5001 BLOCKCHAIN_PEER_URLS="POLICE_NODE=http://127.0.0.1:5001,PROSECUTION_NODE=http://127.0.0.1:5002,COURT_NODE=http://127.0.0.1:5003,ADMIN_NODE=http://127.0.0.1:5004" node dist/blockchain/node-server.js
```

### Process 2 (Prosecution Node):
```bash
BLOCKCHAIN_NODE_ID=PROSECUTION_NODE BLOCKCHAIN_LISTEN_PORT=5002 BLOCKCHAIN_PEER_URLS="POLICE_NODE=http://127.0.0.1:5001,PROSECUTION_NODE=http://127.0.0.1:5002,COURT_NODE=http://127.0.0.1:5003,ADMIN_NODE=http://127.0.0.1:5004" node dist/blockchain/node-server.js
```

### Process 3 (Court Node):
```bash
BLOCKCHAIN_NODE_ID=COURT_NODE BLOCKCHAIN_LISTEN_PORT=5003 BLOCKCHAIN_PEER_URLS="POLICE_NODE=http://127.0.0.1:5001,PROSECUTION_NODE=http://127.0.0.1:5002,COURT_NODE=http://127.0.0.1:5003,ADMIN_NODE=http://127.0.0.1:5004" node dist/blockchain/node-server.js
```

### Process 4 (Admin Node):
```bash
BLOCKCHAIN_NODE_ID=ADMIN_NODE BLOCKCHAIN_LISTEN_PORT=5004 BLOCKCHAIN_PEER_URLS="POLICE_NODE=http://127.0.0.1:5001,PROSECUTION_NODE=http://127.0.0.1:5002,COURT_NODE=http://127.0.0.1:5003,ADMIN_NODE=http://127.0.0.1:5004" node dist/blockchain/node-server.js
```

---

## 9. Production Render / Cloud Topology Recommendation

When deploying to Render / cloud infrastructure:

1. **Main Web Application Service**: Runs the NestJS API application (`backend`) handling user JWT authentication, RBAC, CBAC, document uploads, and verification APIs.
2. **Four Render Background Services / Private Web Services**:
   - `nyayavault-police-node`
   - `nyayavault-prosecution-node`
   - `nyayavault-court-node`
   - `nyayavault-admin-node`
3. Each Render service is assigned its respective `BLOCKCHAIN_NODE_ID` and environment secret key (`BLOCKCHAIN_NODE_KEY_PEM`), communicating over Render internal private network URLs (`http://nyayavault-police-node:5001`).

---

## 10. Threat Model & Security Assumptions

- **Off-Chain Evidence Storage**: Sensitive evidence file content remains stored off-chain in private Supabase Storage buckets under `AES-256-GCM` encryption.
- **No Cryptocurrency / Tokens**: The network uses zero gas fees, tokens, mining, or staking.
- **Cryptographic Authority Isolation**: Nodes evaluate proposals strictly against authorized proposer roles and required organization thresholds. Compromise of a single node cannot forge high-security `SEALED_EVIDENCE` or `GOVERNANCE_CHECKPOINT` blocks.
- **No Public Writes**: Internal node endpoints (`/api/v1/node/message`) accept requests only from peer IPs in the configured allowlist with valid domain-separated signatures.
