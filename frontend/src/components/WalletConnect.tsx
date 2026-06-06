import { useState } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId } from 'wagmi'

const trunc = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const CHAINS: Record<number, string> = { 31337: 'Localhost', 11155111: 'Sepolia', 1: 'Mainnet' }

export default function WalletConnect() {
  const [open, setOpen] = useState(false)
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()

  if (isConnected && address) return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--cyan-dim)', border: '1px solid var(--border-bright)',
          borderRadius: 10, padding: '7px 14px', color: 'var(--text-primary)',
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)', flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{trunc(address)}</span>
        <span style={{
          background: 'rgba(167,139,250,.15)', color: 'var(--violet)',
          border: '1px solid rgba(167,139,250,.25)', borderRadius: 6,
          padding: '2px 8px', fontSize: 11, fontWeight: 700,
        }}>{CHAINS[chainId] ?? `${chainId}`}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
          borderRadius: 12, padding: 14, minWidth: 240,
          boxShadow: 'var(--shadow-lg)', zIndex: 200,
        }}>
          <div style={{ padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>CONNECTED</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--cyan-text)', wordBreak: 'break-all' }}>{address}</div>
          </div>
          <button onClick={() => { disconnect(); setOpen(false) }} style={{
            width: '100%', padding: '9px 14px',
            background: 'var(--red-dim)', color: 'var(--red)',
            border: '1px solid rgba(248,113,113,.25)', borderRadius: 8,
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--font-sans)', textAlign: 'left',
          }}>Disconnect</button>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(v => !v)}>
        ⬡ Connect Wallet
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
          borderRadius: 12, padding: 14, minWidth: 200,
          boxShadow: 'var(--shadow-lg)', zIndex: 200,
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10, fontWeight: 600 }}>
            Choose Wallet
          </div>
          {connectors.map(c => (
            <button key={c.uid}
              onClick={() => { connect({ connector: c }); setOpen(false) }}
              disabled={isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', marginBottom: 6,
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 8,
                cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-sans)',
                fontWeight: 500, textAlign: 'left',
              }}
            >◈ {c.name}</button>
          ))}
        </div>
      )}
    </div>
  )
}
