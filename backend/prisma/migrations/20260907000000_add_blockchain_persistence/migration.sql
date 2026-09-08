-- CreateTable
CREATE TABLE "blockchain_chains" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "currentHeight" BIGINT NOT NULL DEFAULT 0,
    "currentBlockHash" TEXT NOT NULL,
    "genesisBlockHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blockchain_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockchain_blocks" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "height" BIGINT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "previousBlockHash" TEXT NOT NULL,
    "merkleRoot" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "proposerNode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blockchain_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockchain_transactions" (
    "id" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "txIndex" INTEGER NOT NULL,
    "txType" TEXT NOT NULL,
    "originatingNode" TEXT NOT NULL,
    "nonce" BIGINT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureHex" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "keyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blockchain_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockchain_consensus_proofs" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "consensusType" TEXT NOT NULL DEFAULT 'PROOF_OF_AUTHORITY',
    "consensusVersion" TEXT NOT NULL DEFAULT '1.0',
    "proposalId" TEXT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "blockHeight" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "requiredThreshold" INTEGER NOT NULL,
    "requiredNodeIds" JSONB NOT NULL,
    "collectedAt" TEXT NOT NULL,
    "commitTimestamp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blockchain_consensus_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockchain_endorsements" (
    "id" TEXT NOT NULL,
    "proofId" TEXT NOT NULL,
    "endorserNodeId" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "keyFingerprint" TEXT NOT NULL,
    "publicKeyPem" TEXT NOT NULL,
    "signatureHex" TEXT NOT NULL,
    "signedAt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blockchain_endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_chains_nodeId_chainId_key" ON "blockchain_chains"("nodeId", "chainId");

-- CreateIndex
CREATE INDEX "blockchain_blocks_nodeId_chainId_previousBlockHash_idx" ON "blockchain_blocks"("nodeId", "chainId", "previousBlockHash");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_blocks_nodeId_chainId_height_key" ON "blockchain_blocks"("nodeId", "chainId", "height");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_blocks_nodeId_chainId_blockHash_key" ON "blockchain_blocks"("nodeId", "chainId", "blockHash");

-- CreateIndex
CREATE INDEX "blockchain_transactions_txId_idx" ON "blockchain_transactions"("txId");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_transactions_blockId_txIndex_key" ON "blockchain_transactions"("blockId", "txIndex");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_transactions_nodeId_chainId_txId_key" ON "blockchain_transactions"("nodeId", "chainId", "txId");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_consensus_proofs_blockId_key" ON "blockchain_consensus_proofs"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_endorsements_proofId_endorserNodeId_key" ON "blockchain_endorsements"("proofId", "endorserNodeId");

-- AddForeignKey
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blockchain_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockchain_consensus_proofs" ADD CONSTRAINT "blockchain_consensus_proofs_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blockchain_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockchain_endorsements" ADD CONSTRAINT "blockchain_endorsements_proofId_fkey" FOREIGN KEY ("proofId") REFERENCES "blockchain_consensus_proofs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
