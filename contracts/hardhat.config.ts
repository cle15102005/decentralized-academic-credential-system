import path from "path";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

// Always load contracts/.env (not scripts/.env)
dotenv.config({ path: path.join(__dirname, ".env") });

const PRIVATE_KEY = process.env.PRIVATE_KEY?.trim() ?? "";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL?.trim() ?? "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY?.trim() ?? "";

if (!PRIVATE_KEY) {
  console.warn(
    "WARNING: PRIVATE_KEY not set in contracts/.env — Sepolia deploy will fail; localhost deploy uses Hardhat node accounts instead."
  );
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      evmVersion: "paris",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      // If set, localhost deploy signs with YOUR key (must have ETH on the local node).
      // If empty, deploy uses Hardhat node's default test accounts — not your .env key.
      ...(PRIVATE_KEY ? { accounts: [PRIVATE_KEY] } : {}),
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },

  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
    },
  },

  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
