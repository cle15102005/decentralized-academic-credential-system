/**
 * Network config from frontend/.env (VITE_NETWORK).
 * Default: sepolia — set VITE_NETWORK=localhost only if using local Hardhat.
 */

export type AppNetwork = 'sepolia' | 'localhost'

export const APP_NETWORK = (
  import.meta.env.VITE_NETWORK === 'localhost' ? 'localhost' : 'sepolia'
) as AppNetwork

export const NETWORK_LABEL: Record<AppNetwork, string> = {
  sepolia:   'Sepolia Testnet',
  localhost: 'Local Hardhat',
}
