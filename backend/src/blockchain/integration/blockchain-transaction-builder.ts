/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/blockchain/integration/blockchain-transaction-builder.ts
 *
 * Privacy-Preserving Canonical Transaction Payload Builder
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { createLedgerTransaction, signTransaction } from '../ledger/transaction';
import { LedgerTransaction, LedgerNodeIdentity, TransactionType } from '../ledger/types';
import { BlockchainAnchorIntentParams } from './types';

@Injectable()
export class BlockchainTransactionBuilder {
  /**
   * Build unsigned canonical LedgerTransaction for an application event
   */
  buildTransaction(
    params: BlockchainAnchorIntentParams,
    originatingNode: LedgerNodeIdentity['nodeId'],
    nonce: number,
    chainId = 'nyayavault-mainnet-1',
  ): LedgerTransaction {
    const txType: TransactionType =
      params.eventType === 'INTEGRITY_TAMPER_DETECTED'
        ? 'SECURITY_INCIDENT_ANCHOR'
        : params.eventType === 'AUDIT_CHECKPOINT'
        ? 'AUDIT_CHECKPOINT'
        : 'EVIDENCE_ANCHOR';

    // Privacy Verification: Filter payload to strictly metadata and cryptographic references
    const cleanPayload: Record<string, any> = {
      eventType: params.eventType,
      caseId: params.caseId || null,
      documentId: params.documentId || null,
      versionId: params.versionId || null,
      versionNumber: params.versionNumber || null,
      evidenceHash: params.evidenceHash || params.expectedHash || null,
      auditSequenceNumber: params.auditSequenceNumber ? params.auditSequenceNumber.toString() : null,
      incidentId: params.incidentId || null,
      approvalId: params.approvalId || null,
      actualHash: params.actualHash || null,
    };

    // Remove any undefined / empty null keys
    for (const key of Object.keys(cleanPayload)) {
      if (cleanPayload[key] === null) {
        delete cleanPayload[key];
      }
    }    // Safety Audit Check: Reject input params if raw file bytes or secrets are detected
    this.assertPayloadPrivacy(params);

    return createLedgerTransaction({
      chainId,
      txType,
      originatingNode,
      nonce,
      payload: cleanPayload,
    });
  }

  /**
   * Cryptographically sign transaction using node identity private key
   */
  signTransactionPayload(
    tx: LedgerTransaction,
    signerIdentity: LedgerNodeIdentity,
  ): LedgerTransaction {
    return signTransaction(tx, signerIdentity);
  }

  /**
   * Privacy Audit Guard: Ensure zero raw bytes or sensitive credentials enter transaction
   */
  private assertPayloadPrivacy(params: Record<string, any>) {
    if (params.fileBuffer || params.buffer || params.fileBytes) {
      throw new BadRequestException('Privacy violation: Transaction payload contains raw evidence bytes');
    }

    const jsonString = JSON.stringify(params, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ).toLowerCase();
    const forbiddenKeywords = ['password', 'jwt', 'token', 'privatekey', 'secret', 'smtp', 'supabase'];

    for (const kw of forbiddenKeywords) {
      if (jsonString.includes(kw)) {
        throw new BadRequestException(`Privacy violation: Transaction payload contains forbidden secret term '${kw}'`);
      }
    }
  }
}
