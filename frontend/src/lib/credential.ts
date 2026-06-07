/**
 * frontend/src/lib/credential.ts
 *
 * Browser-only wallet operations that cannot live in shared/ (need MetaMask).
 *
 * Used by:
 *   - frontend/src/pages/IssuePage.tsx  → signAndBuildCredential()
 *   - frontend/src/pages/VerifyPage.tsx → recoverSignerAddress()
 *
 * Hashing/signing input uses @credchain/shared/logic (computeCredentialHash).
 * CLI equivalent for signing: scripts/issuer/signCredential.ts (ethers + .env key).
 */

import { recoverMessageAddress, toBytes } from 'viem'
import type { WalletClient } from 'viem'
import type { CredentialBundle, SignedCredential } from '@credchain/shared/types'
import { computeCredentialHash } from '@credchain/shared/logic'

/**
 * Recompute hash with final salts, EIP-191 sign via MetaMask, return SignedCredential.
 * Called by IssuePage after buildMerkleTree().
 *
 * @param bundle       CredentialBundle with real salts from buildMerkleTree()
 * @param walletClient from wagmi useWalletClient() on IssuePage
 * @param merkleRoot   tree.root from buildMerkleTree()
 */
export async function signAndBuildCredential(
  bundle: CredentialBundle,
  walletClient: WalletClient,
  merkleRoot: string
): Promise<SignedCredential> {
  const { credentialHash: _ignored, ...bundleWithoutHash } = bundle
  const credentialHash = computeCredentialHash(bundleWithoutHash)

  const signature = await walletClient.signMessage({
    account: walletClient.account!,
    message:  { raw: toBytes(credentialHash) },
  })

  const signerAddress = walletClient.account!.address

  return {
    bundle: { ...bundleWithoutHash, credentialHash },
    signature,
    signerAddress,
    merkleRoot,
  }
}

/**
 * Recover university address from credentialHash + signature (VerifyPage step 1).
 * CLI equivalent: ethers.verifyMessage() in scripts/verifier/verifyCredential.ts
 */
export async function recoverSignerAddress(
  credentialHash: string,
  signature: string
): Promise<string> {
  return recoverMessageAddress({
    message:   { raw: toBytes(credentialHash as `0x${string}`) },
    signature: signature as `0x${string}`,
  })
}
