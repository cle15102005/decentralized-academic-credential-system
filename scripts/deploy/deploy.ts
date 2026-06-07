/**
 * Deploy MerkleVerifier + CredentialRegistry.
 *
 * Account used:
 *   sepolia   → PRIVATE_KEY in contracts/.env
 *   localhost → PRIVATE_KEY if set, else Hardhat node's default account #0
 *
 * NOT read from scripts/.env (UNIVERSITY_PRIVATE_KEY is CLI-only).
 */

import path from "path";
import * as dotenv from "dotenv";
import { Wallet } from "ethers";
import hre from "hardhat";

// Load contracts/.env here too (deploy script path is scripts/deploy/, not contracts/)
dotenv.config({ path: path.join(__dirname, "../../contracts/.env") });

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const [deployer] = await hre.ethers.getSigners();
  const envKey = process.env.PRIVATE_KEY?.trim() ?? "";
  const expectedAddress = envKey
    ? new Wallet(envKey).address
    : null;

  console.log("Network:  ", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer: ", deployer.address);
  if (expectedAddress) {
    console.log("From contracts/.env PRIVATE_KEY →", expectedAddress);
    if (deployer.address.toLowerCase() !== expectedAddress.toLowerCase()) {
      console.warn(
        "⚠️  Deployer ≠ address from PRIVATE_KEY — check for duplicate .env or system env override"
      );
    }
  } else {
    console.log(
      "Key source: no PRIVATE_KEY in contracts/.env (localhost uses Hardhat node default account)"
    );
  }

  if (network.chainId === 11155111n && !envKey) {
    throw new Error(
      "Sepolia deploy requires PRIVATE_KEY in contracts/.env (not scripts/.env UNIVERSITY_PRIVATE_KEY)"
    );
  }

  const Verifier = await hre.ethers.getContractFactory("MerkleVerifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("✅ MerkleVerifier deployed to:", verifierAddress);

  const Registry = await hre.ethers.getContractFactory("CredentialRegistry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  const deployTx = registry.deploymentTransaction();
  const receipt = deployTx ? await deployTx.wait() : null;
  const deployBlock = receipt?.blockNumber ?? "?";
  console.log("✅ CredentialRegistry deployed to:", registryAddress);
  console.log("✅ Registry owner (admin):", deployer.address);
  console.log("✅ Registry deploy block:", deployBlock);

  console.log("\n🚀 DEPLOYMENT COMPLETE!");
  console.log("Update frontend/.env:");
  console.log(`  VITE_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`  VITE_VERIFIER_ADDRESS=${verifierAddress}`);
  console.log(`  VITE_REGISTRY_DEPLOY_BLOCK=${deployBlock}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
