/**
 * Public RPCs (thirdweb, etc.) limit eth_getLogs block range (~1000) and response size.
 */

import type { GetLogsParameters, Log, PublicClient } from 'viem'
import { APP_NETWORK } from '../constants/network'

/** thirdweb Sepolia cap is 1000 blocks per request. */
export const MAX_LOG_BLOCK_RANGE = 999n

/** Fallback scan window when VITE_REGISTRY_DEPLOY_BLOCK is unset (~8 hours on Sepolia). */
const SEPOLIA_LOOKBACK = 2_000n

function isLogLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('10,000') ||
    msg.includes('1000') ||
    msg.includes('response size') ||
    msg.includes('Log response size') ||
    msg.includes('query returned more than')
  )
}

export async function getRegistryLogFromBlock(client: PublicClient): Promise<bigint> {
  const envBlock = import.meta.env.VITE_REGISTRY_DEPLOY_BLOCK?.trim()
  if (envBlock) return BigInt(envBlock)

  if (APP_NETWORK === 'localhost') return 0n

  const latest = await client.getBlockNumber()
  return latest > SEPOLIA_LOOKBACK ? latest - SEPOLIA_LOOKBACK : 0n
}

export function hasRegistryDeployBlock(): boolean {
  return !!import.meta.env.VITE_REGISTRY_DEPLOY_BLOCK?.trim()
}

async function getLogsRange(
  client: PublicClient,
  args: Omit<GetLogsParameters, 'fromBlock' | 'toBlock'>,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<Log[]> {
  if (fromBlock > toBlock) return []

  const span = toBlock - fromBlock + 1n
  if (span <= MAX_LOG_BLOCK_RANGE) {
    try {
      return await client.getLogs({ ...args, fromBlock, toBlock })
    } catch (err) {
      if (!isLogLimitError(err) || fromBlock === toBlock) throw err
      const mid = fromBlock + span / 2n
      const [left, right] = await Promise.all([
        getLogsRange(client, args, fromBlock, mid),
        getLogsRange(client, args, mid + 1n, toBlock),
      ])
      return [...left, ...right]
    }
  }

  const logs: Log[] = []
  for (let start = fromBlock; start <= toBlock; start += MAX_LOG_BLOCK_RANGE + 1n) {
    const end =
      start + MAX_LOG_BLOCK_RANGE > toBlock ? toBlock : start + MAX_LOG_BLOCK_RANGE
    logs.push(...(await getLogsRange(client, args, start, end)))
  }
  return logs
}

export async function getLogsChunked(
  client: PublicClient,
  args: Omit<GetLogsParameters, 'fromBlock' | 'toBlock'>,
  fromBlock: bigint,
): Promise<Log[]> {
  const toBlock = await client.getBlockNumber()
  return getLogsRange(client, args, fromBlock, toBlock)
}
