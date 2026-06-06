import { Link } from 'react-router-dom'

const FLOWS = [
  {
    to: '/issue', icon: '✦', label: 'Issue', actor: 'University',
    color: 'var(--violet)', dim: 'var(--violet-dim)', border: 'rgba(167,139,250,.25)',
    desc: 'Build salted Merkle tree, sign with ECDSA, anchor hash on CredentialRegistry.',
    steps: [
      'Fill student name, ID, university, graduation date',
      'Add courses (name + grade) — random salt per course',
      'keccak256 of sorted JSON bundle → ECDSA sign',
      'registry.anchor(credentialHash, merkleRoot) on-chain',
      'Download signed credential JSON',
    ],
  },
  {
    to: '/prove', icon: '◈', label: 'Prove', actor: 'Student',
    color: 'var(--cyan)', dim: 'var(--cyan-dim)', border: 'rgba(34,211,238,.25)',
    desc: 'Rebuild Merkle tree from credential, generate sibling proofs for chosen courses only.',
    steps: [
      'Upload *_signed.json from university',
      'Select courses to disclose (others stay private)',
      'StandardMerkleTree generates sibling proof paths',
      'ProofPackage assembled (merkleRoot + signature kept)',
      'Download proof.json to share with employer',
    ],
  },
  {
    to: '/verify', icon: '◉', label: 'Verify', actor: 'Employer',
    color: 'var(--amber)', dim: 'var(--amber-dim)', border: 'rgba(251,191,36,.25)',
    desc: 'Run 5-step on-chain + off-chain verification pipeline.',
    steps: [
      '① ecrecover(credentialHash, sig) → issuer address',
      '② registry.issuers(issuer) on-chain',
      '③ registry.revocations(hash) on-chain',
      '④ Date.now() ≤ expiresAt off-chain',
      '⑤ verifier.verify(proof, root, leaf) per course',
    ],
  },
]

const TECH = [
  { label: 'Crypto',      val: 'ECDSA · EIP-191\nethers-v6 RFC 6979' },
  { label: 'Privacy',     val: 'Salted StandardMerkleTree\nSelective Disclosure' },
  { label: 'On-chain',    val: 'Solidity 0.8.20 · Hardhat\nCredentialRegistry + MerkleVerifier' },
  { label: 'Frontend',    val: 'React 18 · wagmi v2\nviem · TypeScript · Vite' },
]

export default function HomePage() {
  return (
    <div className="animate-fade-up">
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '24px 0 48px' }}>
        <div style={{
          display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--cyan)', background: 'var(--cyan-dim)',
          border: '1px solid rgba(34,211,238,.25)', padding: '6px 16px',
          borderRadius: 100, marginBottom: 24, letterSpacing: '.1em',
        }}>
          BLOCKCHAIN · ECC · MERKLE TREE · SELECTIVE DISCLOSURE
        </div>
        <h1 style={{ fontSize: 40, lineHeight: 1.15, marginBottom: 16, letterSpacing: '-.03em' }}>
          Decentralized Academic<br />
          <span style={{ color: 'var(--cyan)' }}>Credential System</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 17, maxWidth: 560, margin: '0 auto' }}>
          Prove your degree without revealing your full transcript.
          ECDSA-signed credentials with per-course Merkle selective disclosure.
        </p>
      </div>

      {/* Flow cards */}
      <div className="grid-3" style={{ marginBottom: 48 }}>
        {FLOWS.map(f => (
          <Link key={f.to} to={f.to} style={{ textDecoration: 'none' }}>
            <div
              className="card"
              style={{ height: '100%', borderColor: f.border, cursor: 'pointer', transition: 'all .2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = f.dim; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)'; (e.currentTarget as HTMLElement).style.transform = 'none' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 28, color: f.color }}>{f.icon}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, color: f.color,
                  background: f.dim, border: `1px solid ${f.border}`,
                  padding: '3px 10px', borderRadius: 100, letterSpacing: '.08em',
                }}>{f.actor}</span>
              </div>
              <h2 style={{ fontSize: 22, color: f.color, marginBottom: 8 }}>{f.label}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>{f.desc}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {f.steps.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: f.dim, border: `1px solid ${f.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: f.color, flexShrink: 0, fontWeight: 700,
                    }}>{i + 1}</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: s.startsWith('①') ? 'var(--font-mono)' : 'inherit', fontSize: s.startsWith('①') ? 11 : 12 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Tech stack */}
      <div className="card">
        <h3 style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>
          Tech Stack
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {TECH.map(({ label, val }) => (
            <div key={label} style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: 14,
            }}>
              <div style={{ fontSize: 11, color: 'var(--cyan)', fontWeight: 700, marginBottom: 6, letterSpacing: '.05em' }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Quick start */}
        <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 700, marginBottom: 10, letterSpacing: '.05em' }}>QUICK START</div>
          {[
            '# 1. Start Hardhat node',
            'cd contracts && npx hardhat node',
            '',
            '# 2. Deploy contracts',
            'cd contracts && npx hardhat run ../scripts/deploy/deploy.ts --network localhost',
            '',
            '# 3. Copy addresses to frontend/.env, then start UI',
            'cd frontend && npm install && npm run dev',
          ].map((line, i) => (
            <div key={i} style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: line.startsWith('#') ? 'var(--text-muted)' : line === '' ? 'transparent' : 'var(--cyan-text)',
              lineHeight: 1.8, userSelect: 'text',
            }}>{line || '‎'}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
