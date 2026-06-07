/**
 * scripts/issuer/walletFromEnv.ts
 *
 * Load the university issuer wallet from scripts/.env.
 * Shared by issuer/signCredential.ts and issuer/anchorCredential.ts.
 *
 * Env: UNIVERSITY_PRIVATE_KEY (64 hex chars, with or without 0x prefix)
 */

import { ethers } from "ethers";

/**
 * Create an ethers Wallet connected to the given RPC provider.
 * Throws if UNIVERSITY_PRIVATE_KEY is missing or malformed.
 */
export function walletFromEnv(provider: ethers.Provider): ethers.Wallet {
  const privateKey = process.env.UNIVERSITY_PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error("UNIVERSITY_PRIVATE_KEY is not set in scripts/.env");
  }

  const hex = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "UNIVERSITY_PRIVATE_KEY must be 64 hex characters (32 bytes). " +
        "You may have pasted a wallet address instead of the full private key."
    );
  }

  return new ethers.Wallet(privateKey, provider);
}
