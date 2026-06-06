import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import WalletConnect from './WalletConnect'

const LINKS = [
  { to: '/issue',  icon: '✦', label: 'Issue',  sub: 'University' },
  { to: '/prove',  icon: '◈', label: 'Prove',  sub: 'Student'    },
  { to: '/verify', icon: '◉', label: 'Verify', sub: 'Employer'   },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(6,11,24,.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 24px',
          height: 68, display: 'flex', alignItems: 'center', gap: 32,
        }}>
          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--cyan)', fontWeight: 600 }}>[</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 800, letterSpacing: '-.03em' }}>CredChain</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--cyan)', fontWeight: 600 }}>]</span>
          </Link>

          {/* Nav */}
          <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
            {LINKS.map(({ to, icon, label, sub }) => {
              const active = pathname.startsWith(to)
              return (
                <Link key={to} to={to} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 16px', borderRadius: 10, position: 'relative',
                    cursor: 'pointer', transition: 'background .2s',
                    background: active ? 'var(--cyan-dim)' : 'transparent',
                    border: active ? '1px solid rgba(34,211,238,.2)' : '1px solid transparent',
                  }}>
                    <span style={{ fontSize: 16, color: active ? 'var(--cyan)' : 'var(--text-muted)' }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: active ? 'var(--cyan)' : 'var(--text-secondary)', lineHeight: 1.2 }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1 }}>{sub}</div>
                    </div>
                    {active && (
                      <div style={{
                        position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%)',
                        width: 32, height: 2, background: 'var(--cyan)', borderRadius: '2px 2px 0 0',
                        boxShadow: '0 0 8px var(--cyan)',
                      }} />
                    )}
                  </div>
                </Link>
              )
            })}
          </nav>

          <WalletConnect />
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 960, width: '100%', margin: '0 auto', padding: '40px 24px' }}>
        {children}
      </main>

      <footer style={{ textAlign: 'center', padding: '18px 24px', borderTop: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          CredChain · Decentralized Academic Credential · HUST 2025
        </span>
      </footer>
    </div>
  )
}
