# Credential System Instructions

> **Start here:** [scripts/README.md](./README.md) — overview, when to use CLI vs frontend, quick commands.  
> This file is the **extended reference** (schemas, verification steps, troubleshooting).

This guide covers the full off-chain pipeline: **issuer** (build, sign, anchor), **holder** (Merkle tree + selective disclosure), and **verifier** (6-step validation).

## Task ownership (team division)

| Area | Owner | Paths |
|------|-------|-------|
| Cryptography & credential issuance | **Hai** | `scripts/issuer/*` |
| Merkle tree & selective disclosure | **Cuong** | `scripts/holder/*`, `scripts/verifier/*`, `shared/types.ts` |
| Smart contracts | **Linh** | `contracts/src/*`, `contracts/test/*`, `scripts/deploy/*`, `shared/constants.ts` |
| Frontend + integration + docs | **Huy** | `frontend/*`, `docs/*`, `README.md` |

---

## Overview

The credential system lets a student prove selected course grades without revealing their full transcript.

1. Each course grade is a **salted Merkle leaf** (salt prevents brute-force guessing).
2. The university anchors the **Merkle root** on-chain via `CredentialRegistry`.
3. The student shares a **`proof.json`** that discloses only chosen courses.
4. A verifier runs a **6-step check** (signature, issuer, revocation, expiry, Merkle proofs).

```
Issuer                         Holder                         Verifier
  │                              │                               │
  ├─ build credential            ├─ build Merkle tree (+ salts)  │
  ├─ sign credential             ├─ generate selective proof     ├─ read proof.json
  └─ anchor merkleRoot on-chain  └─ export proof.json ──────────►└─ verify (6 steps)
```

---

## Prerequisites

1. Install dependencies from the repo root:

   ```bash
   npm install
   ```

2. Start a local Hardhat node and deploy contracts (required for on-chain verification steps):

   ```bash
   npm run node      # terminal 1
   npm run deploy    # terminal 2
   ```

3. Copy `scripts/.env.example` to `scripts/.env` and set your university wallet:

   ```env
   UNIVERSITY_PRIVATE_KEY=0x...   # Hardhat account #1 works for local testing
   REGISTRY_ADDRESS=0x...         # optional — defaults to shared/constants.ts
   VERIFIER_ADDRESS=0x...         # optional
   RPC_URL=http://127.0.0.1:8545
   NETWORK=localhost
   ```

4. Register the university wallet as an issuer (one-time, owner only):

   ```bash
   cd contracts
   npx hardhat console --network localhost
   ```

   ```javascript
   const Registry = await ethers.getContractFactory("CredentialRegistry");
   const registry = Registry.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"); // your deployed address
   await registry.addIssuer("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"); // Hardhat account #1
   ```

5. Create data directories (if they do not exist):

   ```bash
   mkdir -p data/issued data/proofs
   ```

---

## Full end-to-end flow

All commands below are run from the `scripts/` folder:

```bash
cd scripts
```

### 1. Build the credential bundle (issuer)

Creates a `CredentialBundle` with expiry (graduation + 50 years) and an initial `credentialHash`. Courses start with zero salts — salts are added in step 2.

```bash
npm run issuer:build -- ../data/sample-student-input.json ../data/issued/STU001.json
```

### 2. Build the salted Merkle tree (holder)

Adds a random 32-byte salt per course and computes `merkleRoot`.

```bash
npm run holder:tree -- ../data/issued/STU001.json
```

### 3. Sign the credential (issuer)

Recomputes `credentialHash` (now includes salts), signs with the university wallet, and produces a `SignedCredential`.

```bash
npm run issuer:sign -- ../data/issued/STU001.json
```

### 4. Anchor on-chain (issuer)

Calls `registry.anchor(credentialHash, merkleRoot)` and saves the final credential to `data/issued/{studentId}.json`.

```bash
npm run issuer:anchor -- ../data/issued/STU001.json
```

### 5. Preview a selective proof (holder)

Prints disclosed courses and their Merkle proofs to stdout (useful for debugging):

```bash
npm run holder:proof -- ../data/issued/STU001.json "Web Development" "Blockchain"
```

### 6. Export `proof.json` (holder)

Creates a shareable proof file for the verifier:

```bash
npm run holder:export -- ../data/issued/STU001.json "Web Development,Blockchain" ../data/proofs/STU001_proof.json
```

### 7. Verify the proof (verifier)

Runs all six verification checks against the local chain:

```bash
npm run verify -- ../data/proofs/STU001_proof.json
```

Exit code `0` = valid, `1` = failed (details printed as JSON).

---

## `proof.json` schema

```json
{
  "credentialHash": "0x...",
  "signerAddress": "0x...",
  "signature": "0x...",
  "expiresAt": 1234567890,
  "merkleRoot": "0x...",
  "disclosedCourses": [
    {
      "name": "Web Development",
      "grade": "A",
      "salt": "0x...",
      "proof": ["0x...", "0x..."]
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `credentialHash` | `keccak256` of the signed credential bundle |
| `signerAddress` | University wallet that issued the credential |
| `signature` | ECDSA signature over `credentialHash` |
| `expiresAt` | Unix timestamp — credential expiry |
| `merkleRoot` | Root anchored on `CredentialRegistry` |
| `disclosedCourses` | Only the courses the holder chose to reveal |

---

## Verification steps (6-step flow)

`verifier/verifyCredential.ts` performs these checks in order:

| Step | Check | Where | Pass condition |
|------|-------|-------|----------------|
| 1 | Signature | Off-chain | `ethers.verifyMessage(credentialHash, signature)` matches `signerAddress` |
| 2 | Issuer | On-chain | `registry.issuers(signerAddress)` is `true` |
| 3 | Revocation | On-chain | `registry.revocations(credentialHash).revoked` is `false` |
| 4 | Expiry | Off-chain | `Date.now() / 1000 <= expiresAt` |
| 5 | Merkle proofs | On-chain | Each disclosed course verifies via `MerkleVerifier.verify()` against the anchored root |
| 6 | Result | Off-chain | Returns `VerificationResult` with per-check booleans and a human-readable `reason` |

Step 5 compares `proofPackage.merkleRoot` to `registry.merkleRoots(credentialHash)` before calling `MerkleVerifier` (the registry contract does not expose a combined `verify()` function).

---

## File summary

### Shared (`shared/`)

| File | What it does |
|------|--------------|
| `types.ts` | Exported TypeScript interfaces: `Course`, `CredentialBundle`, `SignedCredential`, `DisclosedCourse`, `ProofPackage`, `VerificationResult`. Used by holder, verifier, and frontend. |
| `constants.ts` | Contract addresses (`local` / `sepolia`) and ABIs for `CredentialRegistry` and `MerkleVerifier`. *(Pre-existing — not part of this task.)* |

### Issuer (`scripts/issuer/`)

| File | What it does |
|------|--------------|
| `buildCredential.ts` | CLI wrapper around `@credchain/shared/logic` → `buildCredentialBundle()`. |
| `signCredential.ts` | Recomputes hash after salts are added, signs `credentialHash` with EIP-191 (`signMessage` over 32-byte hash), returns `SignedCredential`. Loads `UNIVERSITY_PRIVATE_KEY` from `.env`. |
| `anchorCredential.ts` | Calls `registry.anchor(credentialHash, merkleRoot)` on-chain and saves the signed credential to `data/issued/{studentId}.json`. |

### Holder (`scripts/holder/`)

| File | What it does |
|------|--------------|
| `@credchain/shared/logic` | Shared crypto: `computeCredentialHash`, `buildCredentialBundle`, `hashLeaf`, `standardTreeLeaf`. Used by scripts and frontend. |
| `@credchain/shared/merkle` | Shared Merkle tree: `buildMerkleTree`, `generateProof`, `generateProofFromCourses`. Used by scripts and frontend. |
| `buildMerkleTree.ts` | Generates a random 32-byte salt per course, builds an OpenZeppelin `StandardMerkleTree`, and returns `{ tree, root, courses }`. CLI mode reads a credential JSON, adds salts, and writes back `merkleRoot`. |
| `generateProof.ts` | Selective disclosure: given a tree and a list of course names, returns `DisclosedCourse[]` with name, grade, salt, and sibling proof hashes. Unselected courses stay private. |
| `exportProof.ts` | Combines a `SignedCredential` with disclosed courses into a `ProofPackage` and writes `proof.json` to disk. |

### Verifier (`scripts/verifier/`)

| File | What it does |
|------|--------------|
| `verifyCredential.ts` | Reads `proof.json`, runs the 6-step verification flow, and returns a `VerificationResult`. Callable as a library (`verifyCredential()`) or CLI (`npm run verify`). |

### On-chain contracts (reference)

| Contract | Role in this flow |
|----------|-------------------|
| `MerkleVerifier.sol` | `hashLeaf()` and `verify(proof, root, leaf)` — pure Merkle proof validation |
| `CredentialRegistry.sol` | `anchor(credentialHash, merkleRoot)`, issuer whitelist, and revocation list |

---

## npm scripts reference

Run from `scripts/`:

| Script | Command | Description |
|--------|---------|-------------|
| `issuer:build` | `ts-node issuer/buildCredential.ts` | Build credential bundle |
| `issuer:sign` | `ts-node issuer/signCredential.ts` | Sign credential (ECDSA) |
| `issuer:anchor` | `ts-node issuer/anchorCredential.ts` | Anchor Merkle root on-chain |
| `holder:tree` | `ts-node holder/buildMerkleTree.ts` | Build salted Merkle tree |
| `holder:proof` | `ts-node holder/generateProof.ts` | Preview selective proof (stdout) |
| `holder:export` | `ts-node holder/exportProof.ts` | Export `proof.json` |
| `verify` | `ts-node verifier/verifyCredential.ts` | Verify a proof file |

---

## Merkle leaf design (P5)

Each leaf encodes three fields: `(courseName, grade, salt)`.

```
inner hash  = keccak256(abi.encode(courseName, grade, salt))   ← MerkleVerifier.hashLeaf
tree leaf   = keccak256(inner hash)                            ← StandardMerkleTree node
```

The per-course **salt** stops verifiers from guessing grade combinations by brute force. Only disclosed courses reveal their salt in `proof.json`.

---

## Importing as a library

```typescript
import { buildCredentialBundle, computeCredentialHash } from "@credchain/shared/logic";
import { buildMerkleTree, generateProof } from "@credchain/shared/merkle";
import { signCredential } from "./issuer/signCredential";
import { anchorCredential } from "./issuer/anchorCredential";
import { buildProofPackage, exportProof } from "./holder/exportProof";
import { verifyCredential } from "./verifier/verifyCredential";
import type { ProofPackage, VerificationResult } from "@credchain/shared/types";
```

---

## Troubleshooting

| Problem | Likely cause |
|---------|--------------|
| `UNIVERSITY_PRIVATE_KEY is not set` | Copy `scripts/.env.example` → `scripts/.env` and set the key |
| `not a registered issuer` | Run `registry.addIssuer(walletAddress)` from the contract owner |
| `merkleRoot is required` | Run `holder:tree` before `issuer:sign` |
| `Courses must have salts` | Run `holder:tree` before `holder:proof` or `holder:export` |
| `Credential is not anchored on-chain` | Issuer has not called `registry.anchor()` yet |
| `Merkle root does not match` | Tree was rebuilt after anchoring (salts changed the root) |
| `Signer is not an authorized issuer` | Deploy script did not add the issuer, or wrong `signerAddress` |
| Connection refused on verify | Hardhat node is not running (`npm run node`) |
