# Architecture: Decentralized Academic Credential System

This document outlines the architecture of the Decentralized Academic Credential System, which allows universities to issue tamper-evident credentials, students to selectively disclose specific courses/grades using Merkle proofs, and employers to verify authenticity without relying on a centralized database.

---

## 1. System Overview

The system is designed as a hybrid on-chain/off-chain application:
*   **Off-chain data storage:** Credentials (JSON files) are stored and transported off-chain (e.g., sent from university to student, and student to employer). This avoids storing sensitive PII on a public blockchain.
*   **On-chain verification:** Only cryptographic commitments (Merkle Roots) and digital signatures are anchored to the blockchain.
*   **Selective Disclosure:** Uses Merkle Trees with salted leaves to allow students to reveal only specific courses, without revealing other grades or allowing employers to brute-force the undisclosed grades.

---

## 2. Smart Contracts

The smart contracts are written in Solidity 0.8.20 and run on Ethereum (Sepolia / Localhost).

### `CredentialRegistry.sol`
The central on-chain registry mapping credential hashes to their anchored Merkle roots and revocation statuses. It uses Role-Based Access Control (RBAC).

*   **State / Mappings:**
    *   `issuers`: Maps address -> bool to track authorized university wallets. Managed by the contract `Owner` (admin).
    *   `merkleRoots`: Maps a `credentialHash` -> `merkleRoot`.
    *   `credentialIssuers`: Maps a `credentialHash` -> `address` (the university that anchored it).
    *   `revocations`: Maps a `credentialHash` -> `Revocation` struct (`revoked` boolean, and `revokedAt` timestamp).
*   **Core Functions:**
    *   `anchor(credentialHash, merkleRoot)`: Callable only by an authorized issuer. Anchors the root.
    *   `revoke(credentialHash)`: Timestamped revocation. Only the university that issued the credential can revoke it.
    *   `isValidAt(credentialHash, timestamp)`: Allows checking if a credential was valid at a specific point in time (e.g., time of hire).

### `MerkleVerifier.sol`
A pure, stateless library contract for Merkle proof verification.
*   **`verify(proof, root, leaf)`**: Wraps OpenZeppelin's `MerkleProof.verify()` using sorted pair hashing.
*   **`hashLeaf(courseName, grade, salt)`**: Computes `keccak256(abi.encode(courseName, grade, salt))`. The salt prevents brute-force enumeration of undisclosed grades.

---

## 3. Cryptography & Shared Logic (`shared/`)

The core cryptography is isomorphic—it runs identically in the browser (frontend) and Node.js (CLI scripts)—to guarantee the exact same hashes.

### Credential Hashing (`shared/logic.ts`)
*   **Deterministic JSON Hashing:** To compute the `credentialHash`, the JSON object is recursively key-sorted before hashing (`keccak256(stringToBytes(JSON.stringify(sorted)))`). This ensures the hash is identical regardless of how the JavaScript engine ordered the keys.
*   **Tree Leaf Generation:** `standardTreeLeaf` computes the double hash of the ABI-encoded course data, matching the Solidity implementation exactly.

### Merkle Tree Construction (`shared/merkle.ts`)
*   Uses `@openzeppelin/merkle-tree`'s `StandardMerkleTree`.
*   When a university prepares a credential, a random 32-byte hex salt is generated for every course via `crypto.getRandomValues()`.
*   The tree is built from `[name, grade, salt]` rows. The resulting root is signed and anchored on-chain.
*   When generating a proof, `tree.getProof(leafIndex)` provides the sibling hashes needed to reconstruct the path to the root.

---

## 4. Data Flow & Payload Types (`shared/types.ts`)

The lifecycle of a credential flows through three specific JSON payloads:

1.  **`CredentialBundle`** (Pre-issue)
    *   Contains `studentName`, `studentId`, `university`, `graduationDate`, `expiresAt`, the array of `courses`, and the `credentialHash`.
    *   Courses initially have a placeholder salt (`0x00...`).
2.  **`SignedCredential`** (Issued to Student)
    *   The University adds random salts to the courses, builds the Merkle tree, and signs the `credentialHash` (EIP-191 / EIP-712).
    *   Contains the `bundle`, `merkleRoot`, `signature`, and `signerAddress`.
3.  **`ProofPackage`** (Sent to Employer)
    *   The student selects specific courses to disclose.
    *   Contains `credentialHash`, `signerAddress`, `signature`, `merkleRoot`, `expiresAt`, and an array of **`DisclosedCourse`** objects (which include the `name`, `grade`, `salt`, and the Merkle `proof` array).
    *   PII (like student name) is intentionally removed or hashed out, exposing only the cryptographically proven subsets.

---

## 5. Frontend Architecture (`frontend/src/`)

The web application is built with React, Vite, Tailwind, **wagmi v2**, and **viem**.

*   **Wallet Integration:** `WagmiProvider` manages the connection to MetaMask. Contract reads/writes are performed using viem's clients and Wagmi hooks.
*   **Routing & Pages (`frontend/src/pages/`):**
    *   `IssuePage`: University portal to build a credential, generate salts, construct the Merkle tree, request wallet signature, and anchor the root on-chain.
    *   `ProvePage`: Student portal to load their `SignedCredential`, select courses to reveal, and export a `ProofPackage`. All Merkle computation runs locally in the browser.
    *   `VerifyPage`: Employer portal to upload a `ProofPackage`. It independently checks the ECDSA signature via `viem.verifyMessage`, rebuilds the leaf hashes, and queries the smart contract to ensure the root is anchored and not revoked.
    *   `AdminPage`: Owner portal to manage authorized issuer addresses.

---

## 6. Scripts (`scripts/`)

A suite of TypeScript CLI tools utilizing `ethers v6` for CI/CD and developer workflows.
*   Provides equivalent functionality to the frontend UI (`issuer`, `holder`, `verifier` pipelines).
*   End-to-End integration tests (`tests/integration/e2e.test.ts`) exercise the full lifecycle from issuing to proving to verifying on a local Hardhat node.
