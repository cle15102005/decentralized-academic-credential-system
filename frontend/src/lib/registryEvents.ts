/**
 * Issuer list + anchored credentials from CredentialRegistry events.
 * Admin issuer list also uses localStorage cache (works when RPC log limits block scans).
 */

import type { PublicClient } from 'viem'
import { parseAbiItem } from 'viem'
import { REGISTRY_ABI, REGISTRY_ADDRESS } from '../constants/contracts'
import { getLogsChunked, getRegistryLogFromBlock, hasRegistryDeployBlock } from './chunkedLogs'

export interface IssuerEntry {
  address: string
  active:  boolean
}

export interface AnchoredEntry {
  credentialHash: string
  merkleRoot:     string
  issuer:         string
  blockNumber:      bigint
  revoked:          boolean
  revokedAt:        bigint | null
}

const issuerAdded = parseAbiItem(
  'event IssuerAdded(address indexed issuer)'
)
const issuerRemoved = parseAbiItem(
  'event IssuerRemoved(address indexed issuer)'
)
const credentialAnchored = parseAbiItem(
  'event CredentialAnchored(bytes32 indexed credentialHash, bytes32 merkleRoot, address indexed issuer)'
)

const issuerCacheKey = () =>
  `credchain:issuers:${REGISTRY_ADDRESS.toLowerCase()}`

function readIssuerCache(): string[] {
  try {
    const raw = localStorage.getItem(issuerCacheKey())
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function writeIssuerCache(addresses: string[]) {
  const uniq = [...new Set(addresses.map(a => a.toLowerCase()))]
  localStorage.setItem(issuerCacheKey(), JSON.stringify(uniq))
}

/** Call after addIssuer tx confirms (same browser). */
export function cacheIssuerAddress(address: string) {
  writeIssuerCache([...readIssuerCache(), address.toLowerCase()])
}

/** Call after removeIssuer tx confirms (same browser). */
export function uncacheIssuerAddress(address: string) {
  const rm = address.toLowerCase()
  writeIssuerCache(readIssuerCache().filter(a => a.toLowerCase() !== rm))
}

function envKnownIssuers(): string[] {
  const raw = import.meta.env.VITE_KNOWN_ISSUERS?.trim()
  if (!raw) return []
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

async function scanIssuerEvents(client: PublicClient): Promise<Set<string>> {
  const fromBlock = await getRegistryLogFromBlock(client)
  const [added, removed] = await Promise.all([
    getLogsChunked(client, { address: REGISTRY_ADDRESS, event: issuerAdded }, fromBlock),
    getLogsChunked(client, { address: REGISTRY_ADDRESS, event: issuerRemoved }, fromBlock),
  ])

  const ordered = [
    ...added.map(log => ({ log, kind: 'add' as const })),
    ...removed.map(log => ({ log, kind: 'remove' as const })),
  ].sort((a, b) => {
    const d = Number(a.log.blockNumber! - b.log.blockNumber!)
    return d !== 0 ? d : (a.log.logIndex ?? 0) - (b.log.logIndex ?? 0)
  })

  const set = new Set<string>()
  for (const { log, kind } of ordered) {
    const addr = (log.args as { issuer: string }).issuer.toLowerCase()
    if (kind === 'add') set.add(addr)
    else set.delete(addr)
  }
  return set
}

async function verifyActiveIssuers(
  client: PublicClient,
  candidates: Iterable<string>,
): Promise<IssuerEntry[]> {
  const entries = await Promise.all(
    [...new Set([...candidates].map(a => a.toLowerCase()))].map(async (address) => {
      const active = await client.readContract({
        address:      REGISTRY_ADDRESS,
        abi:          REGISTRY_ABI,
        functionName: 'issuers',
        args:         [address as `0x${string}`],
      }) as boolean
      return { address, active }
    })
  )
  return entries.filter(e => e.active)
}

export async function fetchActiveIssuers(client: PublicClient): Promise<IssuerEntry[]> {
  const candidates = new Set<string>([
    ...readIssuerCache(),
    ...envKnownIssuers(),
  ])

  // Event scan only when deploy block is set — public RPCs reject wide log queries
  if (hasRegistryDeployBlock()) {
    try {
      for (const addr of await scanIssuerEvents(client)) candidates.add(addr)
    } catch {
      // cache/env + on-chain verify still work
    }
  }

  const active = await verifyActiveIssuers(client, candidates)

  // Keep cache in sync with chain
  writeIssuerCache(active.map(e => e.address))

  return active
}

export async function fetchAnchoredCredentials(client: PublicClient): Promise<AnchoredEntry[]> {
  const fromBlock = await getRegistryLogFromBlock(client)
  const logs = await getLogsChunked(
    client,
    { address: REGISTRY_ADDRESS, event: credentialAnchored },
    fromBlock,
  )
  return mapAnchoredLogs(client, logs)
}

/** Filter by indexed issuer — avoids loading every credential on the contract. */
export async function fetchAnchoredByIssuer(
  client: PublicClient,
  issuerAddress: string
): Promise<AnchoredEntry[]> {
  const fromBlock = await getRegistryLogFromBlock(client)
  const issuer = issuerAddress as `0x${string}`
  const logs = await getLogsChunked(
    client,
    {
      address: REGISTRY_ADDRESS,
      event:   credentialAnchored,
      args:    { issuer },
    },
    fromBlock,
  )
  return mapAnchoredLogs(client, logs)
}

async function mapAnchoredLogs(
  client: PublicClient,
  logs: Awaited<ReturnType<typeof getLogsChunked>>,
): Promise<AnchoredEntry[]> {
  const entries = await Promise.all(
    logs.map(async (log) => {
      const args = log.args as {
        credentialHash: string
        merkleRoot: string
        issuer: string
      }
      const [revoked, revokedAt] = await client.readContract({
        address:      REGISTRY_ADDRESS,
        abi:          REGISTRY_ABI,
        functionName: 'revocations',
        args:         [args.credentialHash as `0x${string}`],
      }) as readonly [boolean, bigint]

      return {
        credentialHash: args.credentialHash,
        merkleRoot:     args.merkleRoot,
        issuer:         args.issuer,
        blockNumber:    log.blockNumber ?? 0n,
        revoked,
        revokedAt:      revoked ? revokedAt : null,
      }
    })
  )

  return entries.sort((a, b) => Number(b.blockNumber - a.blockNumber))
}
