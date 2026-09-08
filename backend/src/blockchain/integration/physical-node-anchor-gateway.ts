/**
 * NYAYAVAULT PERMISSIONED BLOCKCHAIN INTEGRATION
 * File: backend/src/blockchain/integration/physical-node-anchor-gateway.ts
 *
 * Machine-to-Machine Application -> Physical Node Anchor Gateway Client
 */

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { BlockchainAnchorIntentParams } from './types';

export interface PhysicalNodeAnchorGatewayConfig {
  gatewayUrl: string;
  appServiceSecret?: string;
  timeoutMs?: number;
}

export interface AnchorSubmissionResult {
  success: boolean;
  txId?: string;
  blockHash?: string;
  blockHeight?: string;
  error?: string;
}

export class PhysicalNodeAnchorGateway {
  private readonly gatewayUrl: string;
  private readonly appServiceSecret?: string;
  private readonly timeoutMs: number;

  constructor(config: PhysicalNodeAnchorGatewayConfig) {
    this.gatewayUrl = config.gatewayUrl;
    this.appServiceSecret = config.appServiceSecret;
    this.timeoutMs = config.timeoutMs || 15000;
  }

  /**
   * Submit an application anchor request over authenticated HTTP to a physical node process
   */
  async submitAnchor(
    params: BlockchainAnchorIntentParams,
    policyId = 'STANDARD_ANCHOR',
  ): Promise<AnchorSubmissionResult> {
    const targetUrl = new URL('/api/v1/node/anchor-submission', this.gatewayUrl);
    const bodyStr = JSON.stringify({
      params,
      policyId,
      timeoutMs: this.timeoutMs,
    });

    const isHttps = targetUrl.protocol === 'https:';
    const requestFn = isHttps ? https.request : http.request;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Connection': 'close',
      'Content-Length': Buffer.byteLength(bodyStr).toString(),
    };

    if (this.appServiceSecret) {
      headers['x-app-service-auth'] = this.appServiceSecret;
    }

    return new Promise((resolve) => {
      const req = requestFn(
        targetUrl,
        {
          method: 'POST',
          headers,
          timeout: this.timeoutMs,
        },
        (res) => {
          let resData = '';
          res.on('data', (chunk) => {
            resData += chunk;
          });

          res.on('end', () => {
            if (res.statusCode !== 200) {
              try {
                const parsedErr = JSON.parse(resData);
                resolve({
                  success: false,
                  error: parsedErr.reason || parsedErr.error || `HTTP ${res.statusCode}`,
                });
              } catch (_) {
                resolve({
                  success: false,
                  error: `HTTP ${res.statusCode}: ${resData}`,
                });
              }
              return;
            }

            try {
              const resObj = JSON.parse(resData);
              if (resObj.valid) {
                resolve({
                  success: true,
                  txId: resObj.txId || resObj.block?.transactions?.[0]?.txId,
                  blockHash: resObj.blockHash || resObj.block?.blockHash,
                  blockHeight: resObj.blockHeight || resObj.block?.header?.height,
                });
              } else {
                resolve({
                  success: false,
                  error: resObj.reason || resObj.code || 'Anchor consensus rejected',
                });
              }
            } catch (err: any) {
              resolve({
                success: false,
                error: `Invalid response JSON from node gateway: ${err.message}`,
              });
            }
          });
        },
      );

      req.on('error', (err) => {
        resolve({
          success: false,
          error: `Gateway connection failed: ${err.message}`,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: `Gateway request timed out after ${this.timeoutMs}ms`,
        });
      });

      req.write(bodyStr);
      req.end();
    });
  }
}
