/**
 * scripts/tests/integration/e2e.test.ts
 *
 * Offline integration test for the shared cryptographic pipeline.
 * Does NOT require a running Hardhat node — tests shared/logic + shared/merkle only.
 *
 * Run: npm run test:e2e  (from project root)
 */

import assert from "assert";
import {
  buildCredentialBundle,
  computeCredentialHash,
  hashLeaf,
  standardTreeLeaf,
} from "@credchain/shared/logic";
import { buildMerkleTree, generateProof } from "@credchain/shared/merkle";

function run(): void {
  const bundle = buildCredentialBundle({
    studentName: "Jane Doe",
    studentId: "STU001",
    university: "ITE University",
    graduationDate: "2025-06-01",
    courses: [
      { name: "Web Development", grade: "A" },
      { name: "Blockchain", grade: "B+" },
    ],
  });
  assert.ok(bundle.credentialHash.startsWith("0x"), "credentialHash must be hex");
  assert.ok(bundle.expiresAt > 0, "expiresAt must be set");

  const coursesWithSalts = bundle.courses.map((c, i) => ({
    ...c,
    salt: `0x${String(i + 1).padStart(64, "0")}`,
  }));
  const { root, courses, tree } = buildMerkleTree(coursesWithSalts);
  assert.ok(root.startsWith("0x"), "merkle root must be hex");

  const { credentialHash: _ignored, ...withoutHash } = bundle;
  const withSalts = { ...withoutHash, courses };
  const recomputed = computeCredentialHash(withSalts);
  assert.notStrictEqual(
    recomputed,
    bundle.credentialHash,
    "hash must change after salts are assigned"
  );

  const disclosed = generateProof({ tree, root, courses }, ["Web Development"]);
  assert.strictEqual(disclosed.length, 1);
  assert.strictEqual(disclosed[0].name, "Web Development");
  assert.ok(disclosed[0].proof.length > 0, "proof must have siblings");

  const course = courses[0];
  const inner = hashLeaf(course.name, course.grade, course.salt);
  const leaf = standardTreeLeaf(course.name, course.grade, course.salt);
  assert.ok(inner.startsWith("0x"));
  assert.ok(leaf.startsWith("0x"));
  assert.notStrictEqual(leaf, inner, "tree leaf must double-hash inner leaf");

  console.log("e2e: all offline checks passed");
}

run();
