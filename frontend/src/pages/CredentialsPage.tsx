/**
 * frontend/src/pages/CredentialsPage.tsx — University (issuer)
 * View anchored credentials, lookup by hash, revoke credentials this university issued.
 */

import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, usePublicClient } from 'wagmi'
import { useIsIssuer, useRevoke, useMerkleRoot, useRevocation } from '../hooks/useRegistry'
import { fetchAnchoredByIssuer, type AnchoredEntry } from '../lib/registryEvents'

const trunc = (s: string, n = 10) =>
  s.length <= n * 2 + 1 ? s : `${s.slice(0, n)}…${s.slice(-6)}`

const ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000'

export default function CredentialsPage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: isIssuer, isLoading: checkingIssuer } = useIsIssuer(address)

  const [anchored, setAnchored]       = useState<AnchoredEntry[]>([])
  const [loading, setLoading]         = useState(false)
  const [loadErr, setLoadErr]         = useState<string | null>(null)
  const [actionErr, setActionErr]     = useState<string | null>(null)
  const [lookupHash, setLookupHash]   = useState('')
  const [lookupQuery, setLookupQuery] = useState<`0x${string}` | undefined>()

  const { revoke, isPending: revoking, isConfirming: revokingConfirm, isConfirmed: revoked } = useRevoke()
  const { data: lookupRoot } = useMerkleRoot(lookupQuery)
  const { data: lookupRevoke } = useRevocation(lookupQuery)
  const revokeStatus = lookupRevoke as readonly [boolean, bigint] | undefined

  const refresh = useCallback(async () => {
    if (!publicClient || !address) return
    setLoading(true)
    setLoadErr(null)
    try {
      setAnchored(await fetchAnchoredByIssuer(publicClient, address))
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [publicClient, address])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    if (revoked) refresh()
  }, [revoked, refresh])

  const busy = revoking || revokingConfirm

  const handleRevoke = async (hash: string) => {
    setActionErr(null)
    if (!confirm('Revoke this credential? Employers will no longer accept it.')) return
    try {
      await revoke(hash as `0x${string}`)
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : String(e))
    }
  }

  const handleLookup = () => {
    const h = lookupHash.trim()
    if (!/^0x[0-9a-fA-F]{64}$/.test(h)) {
      setActionErr('credentialHash must be 32-byte hex (0x + 64 chars)')
      return
    }
    setActionErr(null)
    setLookupQuery(h as `0x${string}`)
  }

  if (!isConnected) return (
    <div className="animate-fade-up">
      <PageHeader />
      <div className="card" style={{ textAlign: 'center', padding: 48, marginTop: 24 }}>
        <p style={{ color: 'var(--text-secondary)' }}>Connect your university wallet to manage credentials.</p>
      </div>
    </div>
  )

  if (!checkingIssuer && isIssuer === false) return (
    <div className="animate-fade-up">
      <PageHeader />
      <div className="alert alert-error" style={{ marginTop: 24 }}>
        This wallet is not a registered university. Ask the system admin to add it on the{' '}
        <Link to="/admin" style={{ color: 'var(--cyan)' }}>Admin</Link> page.
      </div>
    </div>
  )

  return (
    <div className="animate-fade-up">
      <PageHeader />

      {checkingIssuer && (
        <div className="badge badge-amber" style={{ marginBottom: 16 }}>Checking issuer status…</div>
      )}

      {(loadErr || actionErr) && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠ {loadErr || actionErr}</div>
      )}

      <section className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, marginBottom: 14 }}>Look Up Credential</h3>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            className="form-input mono"
            style={{ flex: 1, minWidth: 280 }}
            placeholder="credentialHash (0x…)"
            value={lookupHash}
            onChange={e => setLookupHash(e.target.value)}
          />
          <button className="btn btn-secondary" onClick={handleLookup}>Search</button>
        </div>
        {lookupQuery && lookupRoot !== undefined && (
          <div style={{ background: 'var(--bg-surface)', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
            {lookupRoot === ZERO ? (
              <p style={{ color: 'var(--amber)' }}>Not found on-chain.</p>
            ) : (
              <>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)' }}>merkleRoot: </span>
                  <span className="mono">{lookupRoot as string}</span>
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                  {revokeStatus?.[0]
                    ? <span style={{ color: 'var(--red)' }}>Revoked</span>
                    : <span style={{ color: 'var(--green)' }}>Active</span>}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16 }}>My Anchored Credentials ({anchored.length})</h3>
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
            {loading ? 'Loading…' : '↺ Refresh'}
          </button>
        </div>

        {anchored.length === 0 && !loading && (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            No credentials yet. <Link to="/issue" style={{ color: 'var(--cyan)' }}>Issue one</Link>.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {anchored.map(row => (
            <div key={row.credentialHash} style={{
              padding: 14, background: 'var(--bg-surface)', borderRadius: 8,
              border: `1px solid ${row.revoked ? 'rgba(248,113,113,.3)' : 'var(--border)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>credentialHash</div>
                  <div className="mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>{row.credentialHash}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    merkleRoot: <span className="mono">{trunc(row.merkleRoot, 12)}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {row.revoked
                    ? <span className="badge badge-red">Revoked</span>
                    : <span className="badge badge-green">Active</span>}
                  {!row.revoked && (
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ display: 'block', marginTop: 8, marginLeft: 'auto' }}
                      disabled={busy}
                      onClick={() => handleRevoke(row.credentialHash)}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function PageHeader() {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="badge badge-violet" style={{ marginBottom: 12 }}>University · Issuer</div>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>Manage Credentials</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
        View credentials your university anchored and revoke if needed.
      </p>
    </div>
  )
}
