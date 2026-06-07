/**
 * Wagmi hooks for CredentialRegistry — Issue page + Admin page.
 */

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { REGISTRY_ABI, REGISTRY_ADDRESS } from '../constants/contracts'

export function useIsIssuer(address?: `0x${string}`) {
  return useReadContract({
    address:      REGISTRY_ADDRESS,
    abi:          REGISTRY_ABI,
    functionName: 'issuers',
    args:         address ? [address] : undefined,
    query:        { enabled: !!address },
  })
}

export function useRegistryOwner() {
  return useReadContract({
    address:      REGISTRY_ADDRESS,
    abi:          REGISTRY_ABI,
    functionName: 'owner',
  })
}

export function useMerkleRoot(credentialHash?: `0x${string}`) {
  return useReadContract({
    address:      REGISTRY_ADDRESS,
    abi:          REGISTRY_ABI,
    functionName: 'merkleRoots',
    args:         credentialHash ? [credentialHash] : undefined,
    query:        { enabled: !!credentialHash },
  })
}

export function useRevocation(credentialHash?: `0x${string}`) {
  return useReadContract({
    address:      REGISTRY_ADDRESS,
    abi:          REGISTRY_ABI,
    functionName: 'revocations',
    args:         credentialHash ? [credentialHash] : undefined,
    query:        { enabled: !!credentialHash },
  })
}

function useRegistryWrite() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })
  return { writeContractAsync, hash, isPending, isConfirming, isConfirmed, error }
}

export function useAnchor() {
  const w = useRegistryWrite()
  const anchor = (credentialHash: `0x${string}`, merkleRoot: `0x${string}`) =>
    w.writeContractAsync({
      address: REGISTRY_ADDRESS, abi: REGISTRY_ABI,
      functionName: 'anchor', args: [credentialHash, merkleRoot],
    })
  return { anchor, hash: w.hash, isPending: w.isPending, isConfirming: w.isConfirming, isConfirmed: w.isConfirmed, error: w.error }
}

export function useAddIssuer() {
  const w = useRegistryWrite()
  const addIssuer = (uni: `0x${string}`) =>
    w.writeContractAsync({
      address: REGISTRY_ADDRESS, abi: REGISTRY_ABI,
      functionName: 'addIssuer', args: [uni],
    })
  return { addIssuer, hash: w.hash, isPending: w.isPending, isConfirming: w.isConfirming, isConfirmed: w.isConfirmed, error: w.error }
}

export function useRemoveIssuer() {
  const w = useRegistryWrite()
  const removeIssuer = (uni: `0x${string}`) =>
    w.writeContractAsync({
      address: REGISTRY_ADDRESS, abi: REGISTRY_ABI,
      functionName: 'removeIssuer', args: [uni],
    })
  return { removeIssuer, hash: w.hash, isPending: w.isPending, isConfirming: w.isConfirming, isConfirmed: w.isConfirmed, error: w.error }
}

export function useRevoke() {
  const w = useRegistryWrite()
  const revoke = (credentialHash: `0x${string}`) =>
    w.writeContractAsync({
      address: REGISTRY_ADDRESS, abi: REGISTRY_ABI,
      functionName: 'revoke', args: [credentialHash],
    })
  return { revoke, hash: w.hash, isPending: w.isPending, isConfirming: w.isConfirming, isConfirmed: w.isConfirmed, error: w.error }
}
