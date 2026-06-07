/**
 * scripts/verifier/verifyCredential.ts
 *
 * 5-step verification pipeline for a ProofPackage (employer / verifier).
 *
 * Steps:
 *   1. ECDSA — recover signer from credentialHash + signature (off-chain, ethers)
 *   2. Issuer  — registry.issuers(recovered) must be true (on-chain)
 *   3. Revoke  — registry.revocations(hash) must be false (on-chain)
 *   4. Expiry  — now <= expiresAt (off-chain)
 *   5. Merkle  — anchored root matches + verifier.verify per course (on-chain)
 *
 * Actor: Employer (verifier).
 * Run:   npm run verify -- <proof.json>
 *
 * Uses:  @credchain/shared/logic (standardTreeLeaf), @credchain/shared/constants (ABIs)
 * Browser equivalent: frontend/src/pages/VerifyPage.tsx
 */

import * as fs from "fs";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import {
  CONTRACT_ADDRESSES,
  REGISTRY_ABI,
  VERIFIER_ABI,
} from "@credchain/shared/constants";
import { ProofPackage, VerificationResult } from "@credchain/shared/types";
import { standardTreeLeaf } from "@credchain/shared/logic";

dotenv.config();

/**
 * Run the full verification pipeline and return a structured result.
 * Used by: CLI main block. Same checks as VerifyPage.run().
 */
export async function verifyCredential(
  proofPackage: ProofPackage,
  provider: ethers.Provider,
  registryAddress: string,
  verifierAddress: string
): Promise<VerificationResult> {
  const result: VerificationResult = {
    valid: false,
    signatureValid: false,
    issuerAuthorized: false,
    notRevoked: false,
    notExpired: false,
    merkleProofsValid: false,
    reason: "",
    issuerAddress: proofPackage.signerAddress,
    expiresAt: proofPackage.expiresAt,
  };

  // Step 1 — Signature check (off-chain)
  let recovered: string;
  try {
    recovered = ethers.verifyMessage(
      ethers.getBytes(proofPackage.credentialHash),
      proofPackage.signature
    );
    result.signatureValid = recovered.toLowerCase() === proofPackage.signerAddress.toLowerCase();
    if (!result.signatureValid) {
      result.reason = "Invalid signature";
      return result;
    }
    result.issuerAddress = recovered;
  } catch {
    result.reason = "Signature verification failed";
    return result;
  }

  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
  const verifier = new ethers.Contract(verifierAddress, VERIFIER_ABI, provider);

  // Step 2 — Issuer check (on-chain) — use recovered signer, not claimed address
  result.issuerAuthorized = await registry.issuers(recovered);
  if (!result.issuerAuthorized) {
    result.reason = "Signer is not an authorized issuer";
    return result;
  }

  // Step 3 — Revocation check (on-chain)
  const revocation = await registry.revocations(proofPackage.credentialHash);
  result.notRevoked = !revocation.revoked;
  if (!result.notRevoked) {
    result.reason = "Credential has been revoked";
    return result;
  }

  // Step 4 — Expiry check (off-chain)
  const nowSec = Math.floor(Date.now() / 1000);
  result.notExpired = nowSec <= proofPackage.expiresAt;
  if (!result.notExpired) {
    result.reason = "Credential expired";
    return result;
  }

  // Step 5 — Merkle proof check (on-chain)
  const anchoredRoot = await registry.merkleRoots(proofPackage.credentialHash);
  if (anchoredRoot === ethers.ZeroHash) {
    result.reason = "Credential is not anchored on-chain";
    return result;
  }
  if (anchoredRoot !== proofPackage.merkleRoot) {
    result.reason = "Merkle root does not match anchored root";
    return result;
  }

  let allProofsValid = true;
  for (const course of proofPackage.disclosedCourses) {
    const leaf = standardTreeLeaf(course.name, course.grade, course.salt);
    const valid = await verifier.verify(course.proof, proofPackage.merkleRoot, leaf);
    if (!valid) {
      allProofsValid = false;
      result.reason = `Invalid Merkle proof for course: ${course.name}`;
      break;
    }
  }
  result.merkleProofsValid = allProofsValid;
  if (!result.merkleProofsValid) {
    return result;
  }

  result.valid = true;
  result.reason = "All verification checks passed";
  return result;
}

if (require.main === module) {
  const proofPath = process.argv[2];
  if (!proofPath) {
    console.error("Usage: ts-node verifier/verifyCredential.ts <proof.json>");
    process.exit(1);
  }

  const networkEnv = process.env.NETWORK ?? "local";
  const networkKey: keyof typeof CONTRACT_ADDRESSES =
    networkEnv === "localhost" || networkEnv === "local" ? "local" : "sepolia";
  const addresses = CONTRACT_ADDRESSES[networkKey];
  const registryAddress = process.env.REGISTRY_ADDRESS ?? addresses.registry;
  const verifierAddress = process.env.VERIFIER_ADDRESS ?? addresses.verifier;
  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";

  const proofPackage: ProofPackage = JSON.parse(fs.readFileSync(proofPath, "utf8"));
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  verifyCredential(proofPackage, provider, registryAddress, verifierAddress)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.valid ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
