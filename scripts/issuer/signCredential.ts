/**
 * scripts/issuer/signCredential.ts
 *
 * ECDSA-sign a credential bundle with the university wallet (EIP-191 personal_sign).
 * Requires courses to already have real salts and a merkleRoot from holder:tree.
 *
 * Actor: University (issuer) — step 3 of the CLI pipeline.
 * Run:   npm run issuer:sign -- <credential-with-merkle.json> [output.json]
 *
 * Uses:  @credchain/shared/logic (computeCredentialHash)
 * Env:   UNIVERSITY_PRIVATE_KEY, RPC_URL in scripts/.env
 *
 * Browser equivalent: frontend/src/lib/credential.ts → signAndBuildCredential()
 */

import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { CredentialBundle, SignedCredential } from "@credchain/shared/types";
import { computeCredentialHash, ZERO_HASH } from "@credchain/shared/logic";
import { walletFromEnv } from "./walletFromEnv";

dotenv.config();

/**
 * Recompute credentialHash with final salts, sign with wallet, return SignedCredential.
 * Used by: CLI main block. Same logic as frontend IssuePage (sign step).
 */
export async function signCredential(
  bundle: CredentialBundle,
  wallet: ethers.Wallet,
  merkleRoot: string
): Promise<SignedCredential> {
  if (!merkleRoot || merkleRoot === ZERO_HASH) {
    throw new Error("merkleRoot is required — run holder:tree first");
  }
  if (!bundle.courses.every((c) => c.salt && c.salt !== ZERO_HASH)) {
    throw new Error("All courses must have salts — run holder:tree first");
  }

  const { credentialHash: _ignored, ...bundleWithoutHash } = bundle;
  const credentialHash = computeCredentialHash(bundleWithoutHash);
  const signature = await wallet.signMessage(ethers.getBytes(credentialHash));

  return {
    bundle: { ...bundleWithoutHash, credentialHash },
    signature,
    signerAddress: wallet.address,
    merkleRoot,
  };
}

/** Parse credential JSON from buildCredential + buildMerkleTree output. */
function loadBundleFromFile(filePath: string): { bundle: CredentialBundle; merkleRoot: string } {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (data.bundle && data.merkleRoot) {
    return { bundle: data.bundle, merkleRoot: data.merkleRoot };
  }
  if (data.credentialHash && data.courses) {
    const { merkleRoot, ...bundleFields } = data;
    if (!merkleRoot) {
      throw new Error("merkleRoot missing — run holder:tree first");
    }
    return { bundle: bundleFields as CredentialBundle, merkleRoot };
  }

  throw new Error("Unrecognized credential file format");
}

if (require.main === module) {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath) {
    console.error(
      "Usage: ts-node issuer/signCredential.ts <credential-with-merkle.json> [output.json]"
    );
    process.exit(1);
  }

  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  let wallet: ethers.Wallet;
  try {
    wallet = walletFromEnv(provider);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const { bundle, merkleRoot } = loadBundleFromFile(inputPath);

  signCredential(bundle, wallet, merkleRoot)
    .then((signed) => {
      const out = outputPath ?? inputPath;
      const dir = path.dirname(out);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(out, JSON.stringify(signed, null, 2));
      console.log(`Signed credential for ${signed.bundle.studentId}`);
      console.log(`signerAddress: ${signed.signerAddress}`);
      console.log(`merkleRoot: ${signed.merkleRoot}`);
      console.log(`Written to ${out}`);
    })
    .catch((err) => {
      console.error(err.message ?? err);
      process.exit(1);
    });
}
