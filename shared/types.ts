/**
 * shared/types.ts
 *
 * Shared TypeScript interfaces for credential data passed between packages.
 *
 * Used by:
 *   - shared/logic.ts, shared/merkle.ts  (build & hash credentials)
 *   - scripts/issuer, scripts/holder, scripts/verifier  (CLI pipeline)
 *   - frontend/src/pages/*  (Issue, Prove, Verify UI)
 *
 * These types describe JSON files exchanged between actors:
 *   University → SignedCredential → Student → ProofPackage → Employer
 */

/** One course row inside a credential. Salt is zero until the Merkle tree step. */
export interface Course {
  name: string;
  grade: string;
  salt: string;
}

/**
 * Full academic credential payload before signing.
 * credentialHash is keccak256 of the bundle (without the hash field itself).
 */
export interface CredentialBundle {
  studentName: string;
  studentId: string;
  university: string;
  graduationDate: string;
  expiresAt: number;
  courses: Course[];
  credentialHash: string;
}

/**
 * Output of the Issue step: signed bundle + anchored Merkle root.
 * Downloaded by the student as *_signed.json.
 */
export interface SignedCredential {
  bundle: CredentialBundle;
  signature: string;
  signerAddress: string;
  merkleRoot: string;
}

/**
 * One selectively disclosed course with its Merkle sibling proof path.
 * Only disclosed courses appear in proof.json — others stay private.
 */
export interface DisclosedCourse {
  name: string;
  grade: string;
  salt: string;
  proof: string[];
}

/**
 * Output of the Prove step. Shared with employers for verification.
 * Contains signature + metadata + only the courses the student chose to reveal.
 */
export interface ProofPackage {
  credentialHash: string;
  signerAddress: string;
  signature: string;
  expiresAt: number;
  merkleRoot: string;
  disclosedCourses: DisclosedCourse[];
}

/** Structured result returned by scripts/verifier/verifyCredential.ts. */
export interface VerificationResult {
  valid: boolean;
  signatureValid: boolean;
  issuerAuthorized: boolean;
  notRevoked: boolean;
  notExpired: boolean;
  merkleProofsValid: boolean;
  reason: string;
  issuerAddress: string;
  expiresAt: number;
}
