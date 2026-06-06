/**
 * useRegistry.ts
 * Wagmi hooks for CredentialRegistry (Linh's contract).
 *
 * Contract has ONE address (registry) + MerkleVerifier (verifier).
 * No separate IssuerRegistry — issuers() is a mapping on CredentialRegistry.
 */

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { REGISTRY_ABI, REGISTRY_ADDRESS } from '../constants/contracts'

// ─── Read: is address a registered issuer? ────────────────────────
export function useIsIssuer(address?: `0x${string}`) {
  return useReadContract({
    address:      REGISTRY_ADDRESS,
    abi:          REGISTRY_ABI,
    functionName: 'issuers',
    args:         address ? [address] : undefined,
    query:        { enabled: !!address },
  })
}

// ─── Read: get anchored Merkle root for a credential ──────────────
export function useMerkleRoot(credentialHash?: `0x${string}`) {
  return useReadContract({
    address:      REGISTRY_ADDRESS,
    abi:          REGISTRY_ABI,
    functionName: 'merkleRoots',
    args:         credentialHash ? [credentialHash] : undefined,
    query:        { enabled: !!credentialHash },
  })
}

// ─── Read: get revocation status ─────────────────────────────────
export function useRevocation(credentialHash?: `0x${string}`) {
  return useReadContract({
    address:      REGISTRY_ADDRESS,
    abi:          REGISTRY_ABI,
    functionName: 'revocations',
    args:         credentialHash ? [credentialHash] : undefined,
    query:        { enabled: !!credentialHash },
  })
}

// ─── Write: anchor(credentialHash, merkleRoot) ────────────────────
export function useAnchor() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })

  const anchor = (credentialHash: `0x${string}`, merkleRoot: `0x${string}`) =>
    writeContractAsync({
      address:      REGISTRY_ADDRESS,
      abi:          REGISTRY_ABI,
      functionName: 'anchor',
      args:         [credentialHash, merkleRoot],
    })

  return { anchor, hash, isPending, isConfirming, isConfirmed, error }
}

// ─── Write: revoke(credentialHash) ───────────────────────────────
export function useRevoke() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })

  const revoke = (credentialHash: `0x${string}`) =>
    writeContractAsync({
      address:      REGISTRY_ADDRESS,
      abi:          REGISTRY_ABI,
      functionName: 'revoke',
      args:         [credentialHash],
    })

  return { revoke, hash, isPending, isConfirming, isConfirmed, error }
}

// ─── Write: addIssuer(uni) — onlyOwner ───────────────────────────
export function useAddIssuer() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })

  const addIssuer = (uni: `0x${string}`) =>
    writeContractAsync({
      address:      REGISTRY_ADDRESS,
      abi:          REGISTRY_ABI,
      functionName: 'addIssuer',
      args:         [uni],
    })

  return { addIssuer, hash, isPending, isConfirming, isConfirmed, error }
}
