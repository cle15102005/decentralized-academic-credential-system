/**
 * Wagmi config — Sepolia first (default chain). Hardhat localhost available as fallback.
 */

import { createConfig, http } from 'wagmi'
import { hardhat, sepolia } from 'wagmi/chains'
import { injected, metaMask } from 'wagmi/connectors'

const localhost = {
  ...hardhat,
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
}

export const config = createConfig({
  chains:     [sepolia, localhost],
  connectors: [injected(), metaMask()],
  transports: {
    [sepolia.id]:   http(
      import.meta.env.VITE_SEPOLIA_RPC_URL ||
      'https://ethereum-sepolia-rpc.publicnode.com'
    ),
    [localhost.id]: http('http://127.0.0.1:8545'),
  },
})

declare module 'wagmi' {
  interface Register { config: typeof config }
}
