/**
 * frontend/src/pages/HomePage.tsx — Landing page (no CLI instructions).
 */

import { Link } from 'react-router-dom'
import { APP_NETWORK, NETWORK_LABEL } from '../constants/network'

const ROLES = [
  {
    to: '/issue', icon: '✦', label: 'Issue', actor: 'University',
    color: 'var(--violet)', dim: 'var(--violet-dim)', border: 'rgba(167,139,250,.25)',
    desc: 'Create, sign, and anchor a student credential on-chain.',
  },
  {
    to: '/prove', icon: '◈', label: 'Prove', actor: 'Student',
    color: 'var(--cyan)', dim: 'var(--cyan-dim)', border: 'rgba(34,211,238,.25)',
    desc: 'Choose which courses to reveal and download a proof file.',
  },
  {
    to: '/verify', icon: '◉', label: 'Verify', actor: 'Employer',
    color: 'var(--amber)', dim: 'var(--amber-dim)', border: 'rgba(251,191,36,.25)',
    desc: 'Upload a proof and run the full validity check.',
  },
  {
    to: '/credentials', icon: '▤', label: 'Credentials', actor: 'University',
    color: 'var(--violet)', dim: 'var(--violet-dim)', border: 'rgba(167,139,250,.25)',
    desc: 'View anchored credentials, look up by hash, revoke if needed.',
  },
  {
    to: '/admin', icon: '⚙', label: 'Admin', actor: 'Owner',
    color: 'var(--green)', dim: 'var(--green-dim)', border: 'rgba(74,222,128,.25)',
    desc: 'Add or remove registered university wallets (contract owner only).',
  },
]

export default function HomePage() {
  return (
    <div className="animate-fade-up">
      <div style={{ textAlign: 'center', padding: '24px 0 40px' }}>
        <div className="badge badge-cyan" style={{ marginBottom: 20 }}>
          {NETWORK_LABEL[APP_NETWORK]}
        </div>
        <h1 style={{ fontSize: 40, lineHeight: 1.15, marginBottom: 16, letterSpacing: '-.03em' }}>
          Decentralized Academic<br />
          <span style={{ color: 'var(--cyan)' }}>Credential System</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 17, maxWidth: 520, margin: '0 auto' }}>
          Universities issue credentials. Students share only what employers need to see.
          Employers verify authenticity on-chain.
        </p>
      </div>

      <div className="grid-2" style={{ marginBottom: 32 }}>
        {ROLES.map(f => (
          <Link key={f.to} to={f.to} style={{ textDecoration: 'none' }}>
            <div
              className="card"
              style={{ height: '100%', borderColor: f.border, cursor: 'pointer', transition: 'all .2s' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = f.dim
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)'
                ;(e.currentTarget as HTMLElement).style.transform = 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 28, color: f.color }}>{f.icon}</span>
                <span className="badge" style={{
                  color: f.color, background: f.dim, border: `1px solid ${f.border}`,
                }}>{f.actor}</span>
              </div>
              <h2 style={{ fontSize: 22, color: f.color, marginBottom: 8 }}>{f.label}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="card" style={{ textAlign: 'center', padding: 28 }}>
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>How it works</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
          University issues a signed credential and anchors a Merkle root on {NETWORK_LABEL[APP_NETWORK]}.
          The student later generates a selective proof for specific courses.
          An employer verifies the signature, issuer status, and Merkle proofs — without seeing hidden grades.
        </p>
      </div>
    </div>
  )
}
