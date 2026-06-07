/**
 * scripts/holder/buildMerkleTree.ts
 *
 * CLI wrapper around @credchain/shared/merkle → buildMerkleTree().
 * Assigns random salts to courses and writes merkleRoot back into the credential JSON.
 *
 * Actor: University or Student — step 2 of CLI pipeline (after buildCredential).
 * Run:   npm run holder:tree -- <credential.json> [output.json]
 *
 * Browser equivalent: frontend IssuePage step 2 (before sign + anchor)
 */

import { buildMerkleTree, type MerkleTreeResult } from "@credchain/shared/merkle";

export type { MerkleTreeResult };
export { buildMerkleTree };

if (require.main === module) {
  const fs = require("fs");

  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: ts-node holder/buildMerkleTree.ts <credential.json>");
    process.exit(1);
  }

  const credential = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const courses = credential.bundle?.courses ?? credential.courses;
  if (!Array.isArray(courses)) {
    console.error("Credential must contain a courses array");
    process.exit(1);
  }

  const { root, courses: saltedCourses } = buildMerkleTree(courses);

  if (credential.bundle) {
    credential.bundle.courses = saltedCourses;
  } else {
    credential.courses = saltedCourses;
  }
  credential.merkleRoot = root;

  const outPath = process.argv[3] ?? inputPath;
  fs.writeFileSync(outPath, JSON.stringify(credential, null, 2));
  console.log(`Merkle root: ${root}`);
  console.log(`Updated credential written to ${outPath}`);
}
