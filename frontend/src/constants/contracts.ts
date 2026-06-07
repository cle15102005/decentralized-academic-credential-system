/**
 * Contract addresses (frontend/.env) and ABIs (shared/constants).
 */

import { CONTRACT_ADDRESSES, REGISTRY_ABI, VERIFIER_ABI } from '@credchain/shared/constants'
import { APP_NETWORK } from './network'

export { REGISTRY_ABI, VERIFIER_ABI }

const defaults = CONTRACT_ADDRESSES[APP_NETWORK === 'localhost' ? 'local' : 'sepolia']

export const REGISTRY_ADDRESS = (
  import.meta.env.VITE_REGISTRY_ADDRESS || defaults.registry
) as `0x${string}`

export const VERIFIER_ADDRESS = (
  import.meta.env.VITE_VERIFIER_ADDRESS || defaults.verifier
) as `0x${string}`
