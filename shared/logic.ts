/**
 * shared/logic.ts
 *
 * Single source of truth for off-chain credential cryptography.
 * Runs identically in Node.js (scripts) and the browser (frontend).
 *
 * Used by:
 *   - scripts/issuer/buildCredential.ts, scripts/issuer/signCredential.ts
 *   - scripts/verifier/verifyCredential.ts  (standardTreeLeaf for on-chain verify)
 *   - frontend/src/pages/IssuePage.tsx       (buildCredentialBundle)
 *   - frontend/src/lib/credential.ts         (computeCredentialHash before signing)
 *   - frontend/src/pages/VerifyPage.tsx        (standardTreeLeaf)
 *
 * On-chain counterpart: MerkleVerifier.hashLeaf() in contracts/src/MerkleVerifier.sol
 */

import { keccak256, stringToBytes, encodeAbiParameters } from 'viem'
import type { Course, CredentialBundle } from './types'

/** Input shape for building a new credential (no salts or hash yet). */
export interface BuildCredentialInput {
  studentName:    string
  studentId:      string
  university:     string
  graduationDate: string
  courses:        { name: string; grade: string }[]
}

/** Placeholder salt before the Merkle tree step assigns random 32-byte salts. */
export const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000' as const

/**
 * Recursively sort object keys so JSON.stringify produces a deterministic string.
 * Used by: computeCredentialHash — both scripts and frontend must hash the same bytes.
 */
export function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys)
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortObjectKeys(obj[key])
    }
    return sorted
  }
  return value
}

/**
 * Hash the credential bundle (excluding credentialHash field).
 * Algorithm: keccak256(UTF-8 bytes of sorted JSON).
 * Used by: buildCredentialBundle, signCredential (scripts), signAndBuildCredential (frontend).
 */
export function computeCredentialHash(
  bundle: Omit<CredentialBundle, 'credentialHash'>
): `0x${string}` {
  const json = JSON.stringify(sortObjectKeys(bundle))
  return keccak256(stringToBytes(json))
}

/**
 * Validate student input before building a credential.
 * Used by: buildCredentialBundle. Throws on missing/invalid fields.
 */
export function validateCredentialInput(input: BuildCredentialInput): void {
  const required = ['studentName', 'studentId', 'university', 'graduationDate'] as const
  for (const field of required) {
    if (!input[field]?.trim()) {
      throw new Error(`Missing or empty field: ${field}`)
    }
  }
  if (!Array.isArray(input.courses) || input.courses.length === 0) {
    throw new Error('At least one course is required')
  }
  if (Number.isNaN(Date.parse(input.graduationDate))) {
    throw new Error(`Invalid graduationDate: ${input.graduationDate}`)
  }
  for (const course of input.courses) {
    if (!course.name?.trim() || !course.grade?.trim()) {
      throw new Error('Each course must have a name and grade')
    }
  }
}

/**
 * Build a CredentialBundle with placeholder salts and computed credentialHash.
 * Expiry = graduationDate + 50 years (Unix seconds).
 *
 * Used by:
 *   - scripts/issuer/buildCredential.ts  (CLI: npm run issuer:build)
 *   - frontend/src/pages/IssuePage.tsx   (University issues via browser)
 */
export function buildCredentialBundle(input: BuildCredentialInput): CredentialBundle {
  validateCredentialInput(input)

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

/**
 * Inner Merkle leaf hash — matches MerkleVerifier.hashLeaf() on-chain.
 * Used by: standardTreeLeaf. Formula: keccak256(abi.encode(name, grade, salt)).
 */
export function hashLeaf(name: string, grade: string, salt: string): `0x${string}` {
  return keccak256(encodeAbiParameters(
    [{ type: 'string' }, { type: 'string' }, { type: 'bytes32' }],
    [name, grade, salt as `0x${string}`]
  ))
}

/**
 * OpenZeppelin StandardMerkleTree leaf node (double hash).
 * Used by:
 *   - scripts/verifier/verifyCredential.ts  (compute leaf before on-chain verify)
 *   - frontend/src/pages/VerifyPage.tsx       (same, via publicClient.readContract)
 */
export function standardTreeLeaf(name: string, grade: string, salt: string): `0x${string}` {
  return keccak256(hashLeaf(name, grade, salt))
}
