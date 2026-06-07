/**
 * scripts/holder/generateProof.ts
 *
 * CLI wrapper around @credchain/shared/merkle → generateProofFromCourses().
 * Prints Merkle proofs for selected courses to stdout (preview before export).
 *
 * Actor: Student (holder) — after issuer:sign / holder:tree.
 * Run:   npm run holder:proof -- <credential.json> <courseName> [courseName...]
 *
 * Browser equivalent: frontend/src/pages/ProvePage.tsx → handleGenerate()
 */

import { Course, DisclosedCourse } from "@credchain/shared/types";
import {
  buildMerkleTree,
  generateProof,
  generateProofFromCourses,
  type MerkleTreeResult,
} from "@credchain/shared/merkle";

export type { MerkleTreeResult };
export { buildMerkleTree, generateProof, generateProofFromCourses };

if (require.main === module) {
  const fs = require("fs");

  const inputPath = process.argv[2];
  const selectedNames = process.argv.slice(3);

  if (!inputPath || selectedNames.length === 0) {
    console.error(
      "Usage: ts-node holder/generateProof.ts <credential.json> <courseName> [courseName...]"
    );
    process.exit(1);
  }

  const credential = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const courses: Course[] = credential.bundle?.courses ?? credential.courses;

  if (!courses?.every((c: Course) => c.salt)) {
    console.error("Courses must have salts — run holder:tree first");
    process.exit(1);
  }

  const disclosed = generateProofFromCourses(courses, selectedNames);
  const output = {
    merkleRoot: credential.merkleRoot,
    disclosedCourses: disclosed,
  };

  console.log(JSON.stringify(output, null, 2));
}
