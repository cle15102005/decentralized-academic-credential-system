/**
 * frontend/src/pages/AdminPage.tsx — Contract owner only
 * Add / remove registered universities. No credential management.
 */

import { useState, useCallback, useEffect } from 'react'
import { useAccount, usePublicClient, useWalletClient, useChainId, useSwitchChain } from 'wagmi'
import { hardhat, sepolia } from 'wagmi/chains'
import { getAddress, isAddress } from 'viem'
import { useRegistryOwner } from '../hooks/useRegistry'
import { fetchActiveIssuers, cacheIssuerAddress, uncacheIssuerAddress, type IssuerEntry } from '../lib/registryEvents'
import { REGISTRY_ABI, REGISTRY_ADDRESS, VERIFIER_ADDRESS } from '../constants/contracts'
import { APP_NETWORK, NETWORK_LABEL } from '../constants/network'

const trunc = (s: string, n = 10) =>
  s.length <= n * 2 + 1 ? s : `${s.slice(0, n)}…${s.slice(-6)}`

const EXPECTED_CHAIN_ID = APP_NETWORK === 'localhost' ? 31337 : sepolia.id
const CHAIN = APP_NETWORK === 'localhost' ? hardhat : sepolia

export default function AdminPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: switchingChain } = useSwitchChain()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { data: owner } = useRegistryOwner()

  const wrongChain = isConnected && chainId !== EXPECTED_CHAIN_ID

  const isOwner = isConnected && owner && address
    ? (owner as string).toLowerCase() === address.toLowerCase()
    : false

  const [issuers, setIssuers]     = useState<IssuerEntry[]>([])
  const [loading, setLoading]     = useState(false)
  const [loadErr, setLoadErr]     = useState<string | null>(null)
  const [newIssuer, setNewIssuer] = useState('')
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [txPending, setTxPending] = useState(false)

  const refresh = useCallback(async () => {
    if (!publicClient) return
    setLoading(true)
    setLoadErr(null)
    try {
      setIssuers(await fetchActiveIssuers(publicClient))
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [publicClient])

  useEffect(() => { refresh() }, [refresh])

  const busy = txPending || switchingChain
  const canTransact = isOwner && !wrongChain && !busy && !!walletClient

  const handleAddIssuer = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setActionErr(null)

    if (!isConnected) { setActionErr('Connect wallet first (top-right)'); return }
    if (wrongChain) { setActionErr(`Switch MetaMask to ${NETWORK_LABEL[APP_NETWORK]}`); return }
    if (!isOwner) { setActionErr('Only the contract owner can add universities'); return }
    if (!walletClient || !address) {
      setActionErr('Wallet not ready — disconnect and reconnect MetaMask')
      return
    }
    if (!newIssuer.trim()) {
      setActionErr('Enter the university wallet address (0x…) in the field above')
      return
    }
    if (!isAddress(newIssuer.trim())) {
      setActionErr('Invalid address — must start with 0x and be 42 characters')
      return
    }

    const checksum = getAddress(newIssuer.trim())
    setTxPending(true)
    try {
      const hash = await walletClient.writeContract({
        account: address,
        chain:    CHAIN,
        address:  REGISTRY_ADDRESS,
        abi:      REGISTRY_ABI,
        functionName: 'addIssuer',
        args:     [checksum],
      })
      await publicClient!.waitForTransactionReceipt({ hash })
      cacheIssuerAddress(checksum)
      setNewIssuer('')
      await refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('user rejected')) {
        setActionErr('Transaction cancelled in MetaMask')
      } else {
        setActionErr(msg)
      }
    } finally {
      setTxPending(false)
    }
  }

  const handleRemove = async (addr: string) => {
    setActionErr(null)
    if (!walletClient || !address) return
    if (wrongChain) { setActionErr(`Switch MetaMask to ${NETWORK_LABEL[APP_NETWORK]}`); return }

    setTxPending(true)
    try {
      const hash = await walletClient.writeContract({
        account: address,
        chain:    CHAIN,
        address:  REGISTRY_ADDRESS,
        abi:      REGISTRY_ABI,
        functionName: 'removeIssuer',
        args:     [getAddress(addr)],
      })
      await publicClient!.waitForTransactionReceipt({ hash })
      uncacheIssuerAddress(addr)
      await refresh()
    } catch (err: unknown) {
      setActionErr(err instanceof Error ? err.message : String(err))
    } finally {
      setTxPending(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: 24 }}>
        <div className="badge badge-violet" style={{ marginBottom: 12 }}>System Admin</div>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>Manage Universities</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          Contract owner adds or removes university wallets on {NETWORK_LABEL[APP_NETWORK]}.
          Credential lookup and revoke are on the <strong>Credentials</strong> page (university role).
        </p>
      </div>

      <section className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, marginBottom: 14 }}>Deployment</h3>
        <div className="grid-2" style={{ gap: 10 }}>
          {[
            { label: 'Network', value: NETWORK_LABEL[APP_NETWORK] },
            { label: 'Registry', value: trunc(REGISTRY_ADDRESS, 14) },
            { label: 'Verifier', value: trunc(VERIFIER_ADDRESS, 14) },
            { label: 'Owner', value: owner ? trunc(owner as string, 14) : '…' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{value}</div>
            </div>
          ))}
        </div>
        {!isConnected && (
          <div className="alert alert-warn" style={{ marginTop: 14 }}>
            Connect the deployer wallet (top-right) to add or remove universities.
          </div>
        )}
        {wrongChain && (
          <div className="alert alert-warn" style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            MetaMask is on the wrong network. Switch to {NETWORK_LABEL[APP_NETWORK]} to send transactions.
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={switchingChain}
              onClick={() => switchChain({ chainId: EXPECTED_CHAIN_ID })}
            >
              {switchingChain ? 'Switching…' : `Switch to ${NETWORK_LABEL[APP_NETWORK]}`}
            </button>
          </div>
        )}
        {isConnected && !wrongChain && !isOwner && (
          <div className="alert alert-info" style={{ marginTop: 14 }}>
            Connected wallet is not the contract owner ({owner ? trunc(owner as string, 10) : '…'}).
            Import or switch to the deployer wallet that ran <code>deploy:sepolia</code>.
          </div>
        )}
        {isOwner && !wrongChain && (
          <div className="badge badge-green" style={{ marginTop: 14 }}>✓ Contract owner connected</div>
        )}
      </section>

      {(loadErr || actionErr) && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠ {loadErr || actionErr}</div>
      )}

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16 }}>Registered Universities ({issuers.length})</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
            {loading ? 'Loading…' : '↺ Refresh'}
          </button>
        </div>

        {issuers.length === 0 && !loading && (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
            No universities yet — paste a wallet address below and click Add (MetaMask will ask to confirm).
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {issuers.map(({ address: addr }) => (
            <div key={addr} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 8,
              border: '1px solid var(--border)',
            }}>
              <div>
                <span className="badge badge-violet" style={{ marginRight: 10 }}>University</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{addr}</span>
              </div>
              {isOwner && (
                <button type="button" className="btn btn-danger btn-sm" disabled={!canTransact} onClick={() => handleRemove(addr)}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {isConnected && isOwner && (
          <form onSubmit={handleAddIssuer} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              className="form-input mono"
              style={{ flex: 1, minWidth: 280 }}
              placeholder="0x… university wallet address (paste full address)"
              value={newIssuer}
              onChange={e => { setNewIssuer(e.target.value); setActionErr(null) }}
              disabled={busy}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canTransact}
            >
              {busy ? 'Confirm in MetaMask…' : '+ Add University'}
            </button>
          </form>
        )}
        {isConnected && !isOwner && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 10 }}>
            Add form requires the owner wallet shown above.
          </p>
        )}
      </section>
    </div>
  )
}
