// shared/constants.ts

export const CONTRACT_ADDRESSES = {
  // My honies, run this command to deploy on your local Hardhat network to test your next code: 
  // terminal 1: "cd contracts; npx hardhat node" (1 command not 2)
  // terminal 2: "cd contracts; npx hardhat run ../scripts/deploy/deploy.ts --network localhost"
  // After you deploy, copy the addresses from the terminal output and paste them into the "local" section below

  local: {
    registry: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", // This is just a test address from the local Hardhat network, it will be different for each of you when you deploy
    verifier: "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  }, 
  sepolia: {
    registry: "0x8AF83A4F2d5B4584d6cb9C85b5D018326eb94cf3", // We will fill this in later when deploying to the live testnet
    verifier: "0x0F79D6c7B3BC1138fb47318c77FfD777057d3241"
  }
};

export const VERIFIER_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "courseName", "type": "string" },
      { "internalType": "string", "name": "grade", "type": "string" },
      { "internalType": "bytes32", "name": "salt", "type": "bytes32" }
    ],
    "name": "hashLeaf",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32[]", "name": "proof", "type": "bytes32[]" },
      { "internalType": "bytes32", "name": "root", "type": "bytes32" },
      { "internalType": "bytes32", "name": "leaf", "type": "bytes32" }
    ],
    "name": "verify",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "pure",
    "type": "function"
  }
];

export const REGISTRY_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "initialOwner", "type": "address" }],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "credentialHash", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes32", "name": "merkleRoot", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "issuer", "type": "address" }
    ],
    "name": "CredentialAnchored",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "credentialHash", "type": "bytes32" },
      { "indexed": false, "internalType": "uint256", "name": "revokedAt", "type": "uint256" }
    ],
    "name": "CredentialRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": true, "internalType": "address", "name": "issuer", "type": "address" }],
    "name": "IssuerAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": true, "internalType": "address", "name": "issuer", "type": "address" }],
    "name": "IssuerRemoved",
    "type": "event"
  },
  {
    "inputs": [{ "internalType": "address", "name": "uni", "type": "address" }],
    "name": "addIssuer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "credentialHash", "type": "bytes32" },
      { "internalType": "bytes32", "name": "merkleRoot", "type": "bytes32" }
    ],
    "name": "anchor",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "credentialHash", "type": "bytes32" },
      { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "isValidAt",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "name": "issuers",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "name": "merkleRoots",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "uni", "type": "address" }],
    "name": "removeIssuer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "name": "revocations",
    "outputs": [
      { "internalType": "bool", "name": "revoked", "type": "bool" },
      { "internalType": "uint256", "name": "revokedAt", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "credentialHash", "type": "bytes32" }],
    "name": "revoke",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];