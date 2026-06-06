/**
 * lib/credential.ts
 * Browser-compatible implementation of scripts/issuer/buildCredential.ts
 * and scripts/issuer/signCredential.ts.
 *
 * Uses viem (already in project via wagmi) — no Node.js fs or crypto needed.
 */

import { keccak256, stringToBytes, recoverMessageAddress, toBytes } from 'viem'
import type { WalletClient } from 'viem'
import type { Course, CredentialBundle, SignedCredential } from '@credchain/shared/types'

// ─── Helpers ─────────────────────────────────────────────────────

/** Mirrors scripts/issuer/buildCredential.ts → sortObjectKeys */
function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys)
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) sorted[key] = sortObjectKeys(obj[key])
    return sorted
  }
  return value
}

// ─── computeCredentialHash ────────────────────────────────────────
/**
 * Deterministic hash of the credential bundle.
 * Mirrors: keccak256(toUtf8Bytes(JSON.stringify(sortObjectKeys(bundle))))
 */
export function computeCredentialHash(
  bundle: Omit<CredentialBundle, 'credentialHash'>
): `0x${string}` {
  const json = JSON.stringify(sortObjectKeys(bundle))
  return keccak256(stringToBytes(json))
}

// ─── buildCredentialBundle ────────────────────────────────────────
/**
 * Build a CredentialBundle from raw form input.
 * Courses get placeholder salts (0x000…) — replaced by buildMerkleTree().
 * expiresAt is set to graduation date + 50 years (mirrors scripts logic).
 */
export function buildCredentialBundle(input: {
  studentName:    string
  studentId:      string
  university:     string
  graduationDate: string
  courses:        { name: string; grade: string }[]
}): CredentialBundle {
  const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000'

  const courses: Course[] = input.courses.map(c => ({
    name:  c.name.trim(),
    grade: c.grade.trim(),
    salt:  ZERO_HASH,
  }))

  const expires = new Date(input.graduationDate)
  expires.setUTCFullYear(expires.getUTCFullYear() + 50)
  const expiresAt = Math.floor(expires.getTime() / 1000)

  const bundleWithoutHash = {
    studentName:    input.studentName.trim(),
    studentId:      input.studentId.trim(),
    university:     input.university.trim(),
    graduationDate: input.graduationDate.trim(),
    expiresAt,
    courses,
  }

  return { ...bundleWithoutHash, credentialHash: computeCredentialHash(bundleWithoutHash) }
}

// ─── signAndBuildCredential ───────────────────────────────────────
/**
 * Sign the credential bundle with the university wallet (EIP-191 personal_sign).
 * Mirrors: wallet.signMessage(ethers.getBytes(credentialHash))
 *
 * @param bundle  — CredentialBundle after salts have been set by buildMerkleTree()
 * @param walletClient — from useWalletClient() wagmi hook
 * @param merkleRoot   — tree.root from buildMerkleTree()
 */
export async function signAndBuildCredential(
  bundle: CredentialBundle,
  walletClient: WalletClient,
  merkleRoot: string
): Promise<SignedCredential> {
  // Recompute hash with real salts (mirrors signCredential.ts)
  const { credentialHash: _ignored, ...bundleWithoutHash } = bundle
  const credentialHash = computeCredentialHash(bundleWithoutHash)

  // EIP-191: signMessage over raw 32-byte hash bytes
  const signature = await walletClient.signMessage({
    account: walletClient.account!,
    message:  { raw: toBytes(credentialHash) },
  })

  const signerAddress = walletClient.account!.address

  return {
    bundle: { ...bundleWithoutHash, credentialHash },
    signature,
    signerAddress,
    merkleRoot,
  }
}

// ─── recoverSignerAddress ─────────────────────────────────────────
/**
 * Recover the signer address from a credential signature.
 * Mirrors: ethers.verifyMessage(ethers.getBytes(credentialHash), signature)
 */
export async function recoverSignerAddress(
  credentialHash: string,
  signature: string
): Promise<string> {
  return recoverMessageAddress({
    message:   { raw: toBytes(credentialHash as `0x${string}`) },
    signature: signature as `0x${string}`,
  })
}
