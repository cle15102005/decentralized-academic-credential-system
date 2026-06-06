# CredChain Frontend — Huy's Task

> **Frontend + Integration + Docs**
> Part of: Decentralized Academic Credential System with Selective Disclosure
> HUST Blockchain Capstone 2025.2

---

## What's in this folder

```
frontend/
├── src/
│   ├── lib/
│   │   ├── credential.ts     Browser port of scripts/issuer/ (build + sign)
│   │   └── merkle.ts         Browser port of scripts/holder/ (tree + proof)
│   ├── constants/
│   │   └── contracts.ts      Real ABIs from shared/constants.ts
│   ├── hooks/
│   │   └── useRegistry.ts    wagmi hooks for CredentialRegistry
│   ├── pages/
│   │   ├── HomePage.tsx      Landing / quick-start
│   │   ├── IssuePage.tsx     University flow
│   │   ├── ProvePage.tsx     Student flow
│   │   └── VerifyPage.tsx    Employer 5-step verification
│   ├── components/
│   │   ├── Layout.tsx        Nav + wrapper
│   │   └── WalletConnect.tsx MetaMask connect button
│   ├── App.tsx               Router + Wagmi + ReactQuery providers
│   ├── wagmi.config.ts       Chain config (Hardhat local + Sepolia)
│   └── index.css             Design system (dark cyber theme)
├── .env.example              Env var template
└── package.json              deps: wagmi v2, viem, ethers v6, @openzeppelin/merkle-tree
```

---

## Quick Start (Full Demo)

```bash
# From project root — one command does everything:
bash scripts/demo.sh
```

Or manually:

```bash
# Terminal 1: Start local chain
cd contracts && npx hardhat node

# Terminal 2: Deploy contracts
cd contracts && npx hardhat run ../scripts/deploy/deploy.ts --network localhost

# Copy the two addresses printed above into frontend/.env:
# VITE_REGISTRY_ADDRESS=0x...
# VITE_VERIFIER_ADDRESS=0x...

# Terminal 3: Start UI
cd frontend && npm install && npm run dev
```

---

## MetaMask Setup

| Field | Value |
|-------|-------|
| Network Name | Localhost |
| RPC URL | http://127.0.0.1:8545 |
| Chain ID | 31337 |
| Currency | ETH |

**Hardhat test accounts:**

| Role | Account # | Private Key |
|------|-----------|-------------|
| Owner (deploy) | #0 | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Issuer (university) | #1 | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |

After deploying, register the issuer wallet:
```bash
# In hardhat console or a quick script:
await registry.addIssuer("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
```

---

## Demo Walkthrough

### Step 1 — Issue (University wallet)
1. Connect MetaMask with Account #1 (issuer)
2. Open **/issue**
3. Fill: Student Name, Student ID, University, Graduation Date
4. Add courses (Name + Grade)
5. Click **Issue Credential** → MetaMask prompts:
   - `personal_sign` for ECDSA signature
   - `eth_sendTransaction` for `registry.anchor(credentialHash, merkleRoot)`
6. Download `STU001_signed.json`

### Step 2 — Prove (Student)
1. Open **/prove** (no wallet needed)
2. Upload `STU001_signed.json`
3. Select only the courses you want to reveal
4. Click **Generate Proof** → Merkle proofs computed in browser
5. Download `proof_<hash>.json`

### Step 3 — Verify (Employer)
1. Open **/verify** (wallet recommended for RPC access)
2. Upload `proof_<hash>.json`
3. Click **Run Verification** — 5 steps run:
   - ① ECDSA ecrecover (off-chain)
   - ② `registry.issuers(addr)` (on-chain)
   - ③ `registry.revocations(hash)` (on-chain)
   - ④ Expiry timestamp (off-chain)
   - ⑤ `verifier.verify(proof, root, leaf)` per course (on-chain)

---

## Architecture

```
IssuePage
  ├── buildCredentialBundle()     lib/credential.ts  (browser port of scripts/issuer/buildCredential.ts)
  ├── buildMerkleTree()           lib/merkle.ts       (browser port of scripts/holder/buildMerkleTree.ts)
  ├── signAndBuildCredential()    lib/credential.ts  (EIP-191, walletClient.signMessage)
  └── useAnchor()                 hooks/useRegistry.ts → registry.anchor(hash, root)

ProvePage
  ├── buildMerkleTree()           lib/merkle.ts      (rebuilds tree from existing salts)
  └── generateProof()             lib/merkle.ts      (StandardMerkleTree.getProof)

VerifyPage
  ├── recoverSignerAddress()      lib/credential.ts  (viem recoverMessageAddress)
  ├── publicClient.readContract() → registry.issuers()
  ├── publicClient.readContract() → registry.revocations()
  ├── expiry check                off-chain
  ├── publicClient.readContract() → registry.merkleRoots()
  └── publicClient.readContract() → verifier.verify(proof, root, leaf) × n
```

---

## Key Implementation Notes

**Merkle tree algorithm** (matches scripts exactly):
```
leaf = keccak256(keccak256(abi.encode(courseName, grade, salt)))
```
`StandardMerkleTree` double-hashes internally. `standardTreeLeaf()` in `lib/merkle.ts` mirrors `scripts/holder/merkleUtils.ts → standardTreeLeaf()`.

**Credential hash** (deterministic):
```
credentialHash = keccak256(JSON.stringify(sortObjectKeys(bundleWithoutHash)))
```
Mirrors `scripts/issuer/buildCredential.ts → computeCredentialHash()`.

**Signing** (EIP-191):
```
signature = wallet.signMessage(getBytes(credentialHash))
```
`walletClient.signMessage({ message: { raw: toBytes(hash) } })` is equivalent.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_REGISTRY_ADDRESS` | Deployed `CredentialRegistry` address |
| `VITE_VERIFIER_ADDRESS` | Deployed `MerkleVerifier` address |
| `VITE_NETWORK` | `localhost` or `sepolia` |

---

*Huy — Frontend + Integration + Docs — HUST 2025*
