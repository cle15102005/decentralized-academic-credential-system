/*
FILE: deploy/deploy.ts
  1. Deploy MerkleVerifier.sol
  2. Deploy CredentialRegistry.sol (passing MerkleVerifier address)
  3. Write deployed addresses to shared/constants.ts
  4. Verify on Etherscan (Sepolia) if --network sepolia flag
  */
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Deploy the MerkleVerifier (Stateless Library)
  const Verifier = await ethers.getContractFactory("MerkleVerifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("✅ MerkleVerifier deployed to:", verifierAddress);

  // 2. Deploy the CredentialRegistry (Main Contract)
  const Registry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ CredentialRegistry deployed to:", registryAddress);

  console.log("\n🚀 DEPLOYMENT COMPLETE!");
  console.log("Team, please copy the addresses above into shared/constants.ts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});