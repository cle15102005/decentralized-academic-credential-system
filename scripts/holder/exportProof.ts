/**
 * scripts/holder/exportProof.ts
 *
 * Build a ProofPackage JSON file for selective disclosure.
 * Combines signed credential metadata with Merkle proofs for chosen courses.
 *
 * Actor: Student (holder) — produces proof.json for employers.
 * Run:   npm run holder:export -- <signedCredential.json> <course1,course2> <output/proof.json>
 *
 * Uses:  generateProofFromCourses (shared/merkle), buildProofPackage (this file)
 * Browser equivalent: frontend/src/pages/ProvePage.tsx (download proof.json)
 */

import * as fs from "fs";
import * as path from "path";
import {
  DisclosedCourse,
  ProofPackage,
  SignedCredential,
} from "@credchain/shared/types";
import { generateProofFromCourses } from "./generateProof";

/**
 * Assemble ProofPackage from signed credential + disclosed courses.
 * Used by: CLI main block and any library consumer.
 */
export function buildProofPackage(
  signedCredential: SignedCredential,
  disclosedCourses: DisclosedCourse[]
): ProofPackage {
  return {
    credentialHash: signedCredential.bundle.credentialHash,
    signerAddress: signedCredential.signerAddress,
    signature: signedCredential.signature,
    expiresAt: signedCredential.bundle.expiresAt,
    merkleRoot: signedCredential.merkleRoot,
    disclosedCourses,
  };
}

/** Write ProofPackage JSON to disk. */
export function exportProof(
  proofPackage: ProofPackage,
  outputPath: string
): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(proofPackage, null, 2));
}

if (require.main === module) {
  const inputPath = process.argv[2];
  const coursesArg = process.argv[3];
  const outputPath = process.argv[4];

  if (!inputPath || !coursesArg || !outputPath) {
    console.error(
      "Usage: ts-node holder/exportProof.ts <signedCredential.json> <course1,course2,...> <output/proof.json>"
    );
    process.exit(1);
  }

  const signedCredential: SignedCredential = JSON.parse(
    fs.readFileSync(inputPath, "utf8")
  );
  const selectedNames = coursesArg.split(",").map((s) => s.trim()).filter(Boolean);
  const disclosedCourses = generateProofFromCourses(
    signedCredential.bundle.courses,
    selectedNames
  );
  const proofPackage = buildProofPackage(signedCredential, disclosedCourses);
  exportProof(proofPackage, outputPath);

  console.log(`Proof exported to ${outputPath}`);
  console.log(`Disclosed ${disclosedCourses.length} course(s): ${selectedNames.join(", ")}`);
}
