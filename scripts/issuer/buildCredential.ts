/**
 * scripts/issuer/buildCredential.ts
 *
 * CLI wrapper around @credchain/shared/logic → buildCredentialBundle().
 * Reads student JSON from disk and writes a CredentialBundle JSON file.
 *
 * Actor: University (issuer) — step 1 of the CLI pipeline.
 * Run:   npm run issuer:build -- <student-input.json> <output.json>
 *
 * Next step: scripts/holder/buildMerkleTree.ts (assign salts + Merkle root)
 */

import * as fs from "fs";
import * as path from "path";
import {
  buildCredentialBundle,
  computeCredentialHash,
  type BuildCredentialInput,
} from "@credchain/shared/logic";
import type { CredentialBundle } from "@credchain/shared/types";

export type { BuildCredentialInput };
export { computeCredentialHash, buildCredentialBundle };

/** Alias for scripts/INSTRUCTIONS.md and legacy imports. */
export function buildCredential(input: BuildCredentialInput): CredentialBundle {
  return buildCredentialBundle(input);
}

if (require.main === module) {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath || !outputPath) {
    console.error(
      "Usage: ts-node issuer/buildCredential.ts <student-input.json> <output.json>"
    );
    process.exit(1);
  }

  const input: BuildCredentialInput = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const bundle = buildCredentialBundle(input);

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2));
  console.log(`Credential built for ${bundle.studentId}`);
  console.log(`credentialHash: ${bundle.credentialHash}`);
  console.log(`expiresAt: ${bundle.expiresAt}`);
  console.log(`Written to ${outputPath}`);
}
