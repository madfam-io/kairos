/**
 * LTI Key Management Service
 * Handles RSA key generation and JWT operations for LTI 1.3
 */

import * as jose from 'jose';
import { log } from '../lib/logger';

interface LTIKeyPair {
  kid: string;
  privateKey: jose.KeyLike;
  publicKey: jose.KeyLike;
  publicKeyJwk: jose.JWK;
  createdAt: Date;
}

// Store keys in memory (in production, use secure storage like KMS)
let keyPairs: LTIKeyPair[] = [];
let initialized = false;

/**
 * Initialize LTI keys on startup
 * Generates a new RSA key pair if none exists
 */
export async function initializeLTIKeys(): Promise<void> {
  if (initialized) return;

  try {
    // Check if we have keys from environment (production)
    const privateKeyPem = process.env.LTI_PRIVATE_KEY;
    const publicKeyPem = process.env.LTI_PUBLIC_KEY;
    const keyId = process.env.LTI_KEY_ID || 'kairos-lti-key-1';

    if (privateKeyPem && publicKeyPem) {
      // Import existing keys from environment
      const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');
      const publicKey = await jose.importSPKI(publicKeyPem, 'RS256');
      const publicKeyJwk = await jose.exportJWK(publicKey);

      keyPairs.push({
        kid: keyId,
        privateKey,
        publicKey,
        publicKeyJwk: { ...publicKeyJwk, kid: keyId, alg: 'RS256', use: 'sig' },
        createdAt: new Date(),
      });

      log.info('LTI keys loaded from environment');
    } else {
      // Generate new keys (development mode)
      await generateNewKeyPair();
      log.warn('LTI keys generated dynamically - set LTI_PRIVATE_KEY and LTI_PUBLIC_KEY in production');
    }

    initialized = true;
  } catch (error) {
    log.error('Failed to initialize LTI keys', error as Error);
    throw error;
  }
}

/**
 * Generate a new RSA key pair for LTI signing
 */
export async function generateNewKeyPair(): Promise<LTIKeyPair> {
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256', {
    modulusLength: 2048,
  });

  const kid = `kairos-lti-key-${Date.now()}`;
  const publicKeyJwk = await jose.exportJWK(publicKey);

  const keyPair: LTIKeyPair = {
    kid,
    privateKey,
    publicKey,
    publicKeyJwk: { ...publicKeyJwk, kid, alg: 'RS256', use: 'sig' },
    createdAt: new Date(),
  };

  keyPairs.push(keyPair);

  // Keep only the last 2 key pairs for rotation
  if (keyPairs.length > 2) {
    keyPairs = keyPairs.slice(-2);
  }

  return keyPair;
}

/**
 * Get the current active key pair for signing
 */
export function getCurrentKeyPair(): LTIKeyPair | null {
  return keyPairs[keyPairs.length - 1] || null;
}

/**
 * Get all public keys as JWKS format
 */
export function getJWKS(): { keys: jose.JWK[] } {
  return {
    keys: keyPairs.map((kp) => kp.publicKeyJwk),
  };
}

/**
 * Create a remote JWKS fetcher for verifying platform tokens
 */
export function createPlatformJWKS(jwksUrl: string): jose.JWTVerifyGetKey {
  return jose.createRemoteJWKSet(new URL(jwksUrl), {
    cacheMaxAge: 600000, // Cache JWKS for 10 minutes
  });
}

/**
 * Verify a JWT from an LTI platform
 */
export async function verifyPlatformJWT(
  token: string,
  options: {
    jwksUrl?: string;
    publicKey?: string;
    expectedIssuer: string;
    expectedAudience: string;
  }
): Promise<jose.JWTVerifyResult> {
  let keyOrJWKS: jose.KeyLike | jose.JWTVerifyGetKey;

  if (options.publicKey) {
    // Use provided public key
    keyOrJWKS = await jose.importSPKI(options.publicKey, 'RS256');
  } else if (options.jwksUrl) {
    // Use remote JWKS
    keyOrJWKS = createPlatformJWKS(options.jwksUrl);
  } else {
    throw new Error('Either jwksUrl or publicKey must be provided');
  }

  const result = await jose.jwtVerify(token, keyOrJWKS, {
    algorithms: ['RS256'],
    issuer: options.expectedIssuer,
    audience: options.expectedAudience,
  });

  return result;
}

/**
 * Sign a JWT for sending to LTI platform (e.g., deep linking response)
 */
export async function signLTIJWT(
  payload: jose.JWTPayload,
  options: {
    audience: string;
    expiresIn?: string;
  }
): Promise<string> {
  const keyPair = getCurrentKeyPair();
  if (!keyPair) {
    throw new Error('No LTI keys available - call initializeLTIKeys() first');
  }

  const baseUrl = process.env.API_BASE_URL || 'https://api.kairos.dev';

  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: keyPair.kid })
    .setIssuedAt()
    .setIssuer(baseUrl)
    .setAudience(options.audience)
    .setExpirationTime(options.expiresIn || '5m')
    .sign(keyPair.privateKey);

  return jwt;
}

/**
 * Export current private key as PEM (for backup/migration)
 * WARNING: Only use for initial setup or key rotation
 */
export async function exportPrivateKeyPem(): Promise<string | null> {
  const keyPair = getCurrentKeyPair();
  if (!keyPair) return null;

  return jose.exportPKCS8(keyPair.privateKey);
}

/**
 * Export current public key as PEM
 */
export async function exportPublicKeyPem(): Promise<string | null> {
  const keyPair = getCurrentKeyPair();
  if (!keyPair) return null;

  return jose.exportSPKI(keyPair.publicKey);
}
