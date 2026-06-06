import { createConfig, http } from 'wagmi'
import { hardhat, sepolia }   from 'wagmi/chains'
import { injected, metaMask } from 'wagmi/connectors'

// Localhost Hardhat chain (chain ID 31337)
const localhost = {
  ...hardhat,
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
}

export const config = createConfig({
  chains:     [localhost, sepolia],
  connectors: [injected(), metaMask()],
  transports: {
    [localhost.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]:   http(),
  },
})

declare module 'wagmi' {
  interface Register { config: typeof config }
}
