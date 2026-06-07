/**
 * scripts/issuer/anchorCredential.ts
 *
 * Anchor a signed credential on CredentialRegistry (on-chain tx).
 * Calls registry.anchor(credentialHash, merkleRoot) from the issuer wallet.
 *
 * Actor: University (issuer) — step 4 of the CLI pipeline.
 * Run:   npm run issuer:anchor -- <signed-credential.json> [output-dir]
 *
 * Uses:  @credchain/shared/constants (REGISTRY_ABI, CONTRACT_ADDRESSES)
 * Env:   UNIVERSITY_PRIVATE_KEY, RPC_URL, REGISTRY_ADDRESS, NETWORK
 *
 * Browser equivalent: frontend/src/hooks/useRegistry.ts → useAnchor()
 */

import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { CONTRACT_ADDRESSES, REGISTRY_ABI } from "@credchain/shared/constants";
import { SignedCredential } from "@credchain/shared/types";
import { walletFromEnv } from "./walletFromEnv";

dotenv.config();

/**
 * Submit anchor transaction. Verifies wallet is a registered issuer first.
 * Used by: CLI main block.
 */
export async function anchorCredential(
  signedCredential: SignedCredential,
  wallet: ethers.Wallet,
  registryAddress: string
): Promise<ethers.ContractTransactionReceipt> {
  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, wallet);

  const isIssuer = await registry.issuers(wallet.address);
  if (!isIssuer) {
    throw new Error(
      `Wallet ${wallet.address} is not a registered issuer. ` +
        `Call registry.addIssuer("${wallet.address}") from the contract owner first.`
    );
  }

  const tx = await registry.anchor(
    signedCredential.bundle.credentialHash,
    signedCredential.merkleRoot
  );
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Anchor transaction failed — no receipt");
  }

  return receipt;
}

/** Save SignedCredential JSON to data/issued/ (or custom output dir). */
export function saveIssuedCredential(
  signedCredential: SignedCredential,
  outputDir: string
): string {
  const fileName = `${signedCredential.bundle.studentId}.json`;
  const outputPath = path.join(outputDir, fileName);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(signedCredential, null, 2));
  return outputPath;
}

if (require.main === module) {
  const inputPath = process.argv[2];
  const outputDir = process.argv[3] ?? path.join(__dirname, "../../data/issued");

  if (!inputPath) {
    console.error(
      "Usage: ts-node issuer/anchorCredential.ts <signed-credential.json> [output-dir]"
    );
    process.exit(1);
  }

  const networkEnv = process.env.NETWORK ?? "local";
  const networkKey: keyof typeof CONTRACT_ADDRESSES =
    networkEnv === "localhost" || networkEnv === "local" ? "local" : "sepolia";
  const addresses = CONTRACT_ADDRESSES[networkKey];
  const registryAddress = process.env.REGISTRY_ADDRESS ?? addresses.registry;
  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  let wallet: ethers.Wallet;
  try {
    wallet = walletFromEnv(provider);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const signedCredential: SignedCredential = JSON.parse(fs.readFileSync(inputPath, "utf8"));

  anchorCredential(signedCredential, wallet, registryAddress)
    .then((receipt) => {
      const savedPath = saveIssuedCredential(signedCredential, outputDir);
      console.log(`Anchored credential for ${signedCredential.bundle.studentId}`);
      console.log(`tx hash: ${receipt.hash}`);
      console.log(`block: ${receipt.blockNumber}`);
      console.log(`Saved to ${savedPath}`);
    })
    .catch((err) => {
      console.error(err.message ?? err);
      process.exit(1);
    });
}
