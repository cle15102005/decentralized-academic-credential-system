/**
 * VerifyPage.tsx  —  Actor: Employer (Verifier)
 *
 * Mirrors verifier/verifyCredential.ts exactly:
 *   Step 1  ECDSA signature → recover signer address  (off-chain, viem)
 *   Step 2  Issuer registry check                     (on-chain,  registry.issuers)
 *   Step 3  Revocation check                          (on-chain,  registry.revocations)
 *   Step 4  Expiry check                              (off-chain, timestamp)
 *   Step 5  Merkle proof check per course             (on-chain,  verifier.verify)
 *
 * On-chain calls use usePublicClient() for imperative reads.
 */

import { useState, useRef, useCallback } from 'react'
import { usePublicClient }               from 'wagmi'
import type { ProofPackage }             from '@credchain/shared/types'
import { recoverSignerAddress }          from '../lib/credential'
import { standardTreeLeaf }             from '../lib/merkle'
import { REGISTRY_ABI, REGISTRY_ADDRESS, VERIFIER_ABI, VERIFIER_ADDRESS } from '../constants/contracts'

// ─────────────────────────────────────────────────────────────────
type Status = 'idle' | 'running' | 'pass' | 'fail'

interface Step {
  id:     number
  label:  string
  detail: string
  status: Status
  info?:  string
}

const initSteps = (): Step[] => [
  { id: 1, status: 'idle', label: 'ECDSA Signature',    detail: 'ecrecover(credentialHash, signature) → issuer address' },
  { id: 2, status: 'idle', label: 'Issuer Registry',    detail: 'registry.issuers(recovered) must be true (on-chain)' },
  { id: 3, status: 'idle', label: 'Revocation Status',  detail: 'registry.revocations(credentialHash).revoked must be false (on-chain)' },
  { id: 4, status: 'idle', label: 'Expiry',             detail: 'Date.now()/1000 ≤ expiresAt (off-chain)' },
  { id: 5, status: 'idle', label: 'Merkle Proofs',      detail: 'verifier.verify(proof, root, leaf) per course (on-chain)' },
]

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
const fmt   = (ts: number) => new Date(ts * 1000).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
const trunc = (s: string, n = 20) => `${s.slice(0, n)}…`

// ─────────────────────────────────────────────────────────────────
export default function VerifyPage() {
  const publicClient = usePublicClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [dragging,  setDragging]  = useState(false)
  const [proof,     setProof]     = useState<ProofPackage | null>(null)
  const [steps,     setSteps]     = useState<Step[]>(initSteps())
  const [running,   setRunning]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [loadErr,   setLoadErr]   = useState<string | null>(null)

  const patch = (id: number, p: Partial<Step>) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...p } : s))

  // ── Load proof.json ────────────────────────────────────────────
  const parseFile = (text: string) => {
    try {
      const data = JSON.parse(text) as ProofPackage
      if (!data.credentialHash || !data.signature || !Array.isArray(data.disclosedCourses)) {
        throw new Error('Invalid file — expected ProofPackage (proof.json) from the Prove step')
      }
      setProof(data); setSteps(initSteps()); setDone(false); setLoadErr(null)
    } catch (e) { setLoadErr(e instanceof Error ? e.message : 'Parse error') }
  }

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.json')) { setLoadErr('Upload a .json file'); return }
    const r = new FileReader(); r.onload = e => parseFile(e.target!.result as string); r.readAsText(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }, [])

  // ── Verification pipeline ──────────────────────────────────────
  const run = useCallback(async () => {
    if (!proof || !publicClient) return
    setRunning(true); setDone(false); setSteps(initSteps())

    // ── Step 1: ECDSA signature ───────────────────────────────
    patch(1, { status: 'running' }); await delay(400)
    let recovered: string
    try {
      recovered = await recoverSignerAddress(proof.credentialHash, proof.signature)
      const sigMatch = recovered.toLowerCase() === proof.signerAddress.toLowerCase()
      patch(1, {
        status: sigMatch ? 'pass' : 'fail',
        info:   sigMatch
          ? `Recovered: ${trunc(recovered)}`
          : `Expected ${trunc(proof.signerAddress)} — got ${trunc(recovered)}`,
      })
      if (!sigMatch) { setRunning(false); setDone(true); return }
    } catch (e: unknown) {
      patch(1, { status: 'fail', info: `Signature error: ${e instanceof Error ? e.message : e}` })
      setRunning(false); setDone(true); return
    }

    // ── Step 2: Issuer registry (on-chain) ─────────────────────
    patch(2, { status: 'running' }); await delay(300)
    try {
      const isIssuer = await publicClient.readContract({
        address:      REGISTRY_ADDRESS,
        abi:          REGISTRY_ABI,
        functionName: 'issuers',
        args:         [recovered as `0x${string}`],
      }) as boolean
      patch(2, {
        status: isIssuer ? 'pass' : 'fail',
        info:   isIssuer
          ? `${trunc(recovered)} is a registered issuer`
          : `${trunc(recovered)} is NOT a registered issuer`,
      })
      if (!isIssuer) { setRunning(false); setDone(true); return }
    } catch (e: unknown) {
      patch(2, { status: 'fail', info: `RPC error: ${e instanceof Error ? e.message : e}` })
      setRunning(false); setDone(true); return
    }

    // ── Step 3: Revocation (on-chain) ─────────────────────────
    patch(3, { status: 'running' }); await delay(300)
    try {
      const rev = await publicClient.readContract({
        address:      REGISTRY_ADDRESS,
        abi:          REGISTRY_ABI,
        functionName: 'revocations',
        args:         [proof.credentialHash as `0x${string}`],
      }) as readonly [boolean, bigint]
      const notRevoked = !rev[0]
      patch(3, {
        status: notRevoked ? 'pass' : 'fail',
        info:   notRevoked
          ? 'Credential is not revoked'
          : `Revoked at ${fmt(Number(rev[1]))}`,
      })
      if (!notRevoked) { setRunning(false); setDone(true); return }
    } catch (e: unknown) {
      patch(3, { status: 'fail', info: `RPC error: ${e instanceof Error ? e.message : e}` })
      setRunning(false); setDone(true); return
    }

    // ── Step 4: Expiry (off-chain) ────────────────────────────
    patch(4, { status: 'running' }); await delay(200)
    const nowSec    = Math.floor(Date.now() / 1000)
    const notExpired = nowSec <= proof.expiresAt
    patch(4, {
      status: notExpired ? 'pass' : 'fail',
      info:   notExpired
        ? `Valid until ${fmt(proof.expiresAt)}`
        : `Expired on ${fmt(proof.expiresAt)}`,
    })
    if (!notExpired) { setRunning(false); setDone(true); return }

    // ── Step 5: Merkle proofs (on-chain) ──────────────────────
    patch(5, { status: 'running' }); await delay(300)
    try {
      // 5a — Compare anchored root vs proof's merkleRoot
      const anchoredRoot = await publicClient.readContract({
        address:      REGISTRY_ADDRESS,
        abi:          REGISTRY_ABI,
        functionName: 'merkleRoots',
        args:         [proof.credentialHash as `0x${string}`],
      }) as string

      const ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000'
      if (anchoredRoot === ZERO) {
        patch(5, { status: 'fail', info: 'Credential is not anchored on-chain' })
        setRunning(false); setDone(true); return
      }
      if (anchoredRoot.toLowerCase() !== proof.merkleRoot.toLowerCase()) {
        patch(5, { status: 'fail', info: 'Merkle root does not match anchored root' })
        setRunning(false); setDone(true); return
      }

      // 5b — Verify each disclosed course via MerkleVerifier contract
      for (const course of proof.disclosedCourses) {
        const leaf  = standardTreeLeaf(course.name, course.grade, course.salt)
        const valid = await publicClient.readContract({
          address:      VERIFIER_ADDRESS,
          abi:          VERIFIER_ABI,
          functionName: 'verify',
          args:         [
            course.proof as `0x${string}`[],
            proof.merkleRoot as `0x${string}`,
            leaf,
          ],
        }) as boolean

        if (!valid) {
          patch(5, { status: 'fail', info: `Invalid Merkle proof for course: ${course.name}` })
          setRunning(false); setDone(true); return
        }
      }

      patch(5, {
        status: 'pass',
        info:   `${proof.disclosedCourses.length} course proof(s) valid against anchored root`,
      })
    } catch (e: unknown) {
      patch(5, { status: 'fail', info: `RPC error: ${e instanceof Error ? e.message : e}` })
    }

    setRunning(false); setDone(true)
  }, [proof, publicClient])

  // ── Computed ──────────────────────────────────────────────────
  const allPass  = done && steps.every(s => s.status === 'pass')
  const anyFail  = done && steps.some(s => s.status === 'fail')
  const someIdle = steps.some(s => s.status === 'idle')

  // ─────────────────────────────────────────────────────────────
  // Upload screen
  // ─────────────────────────────────────────────────────────────
  if (!proof) return (
    <div className="animate-fade-up">
      <PageHeader />
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        style={{ marginTop: 28 }}
        onClick={() => fileRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>◉</div>
        <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Drop proof.json here</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Upload the <code style={{ fontFamily: 'var(--font-mono)' }}>proof_*.json</code> from the student
        </p>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>
      {loadErr && <div className="alert alert-error" style={{ marginTop: 16 }}>⚠ {loadErr}</div>}
      <div className="alert alert-info" style={{ marginTop: 20 }}>
        💡 Request proof.json from the candidate. Verification happens on the Hardhat/Sepolia network.
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────
  // Verify panel
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-up">
      <PageHeader />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24, alignItems: 'start' }}>

        {/* ── Left: Steps ── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16 }}>Verification Pipeline</h3>
            <button className="btn btn-ghost btn-sm"
              onClick={() => { setProof(null); setDone(false) }}>✕ Clear</button>
          </div>

          {done && (
            <div className={`alert ${allPass ? 'alert-success' : anyFail ? 'alert-error' : 'alert-warn'}`}
              style={{ marginBottom: 16, fontWeight: 600 }}>
              {allPass
                ? '✓ All checks passed — credential is VALID'
                : anyFail
                  ? '✗ Verification FAILED — do not accept'
                  : '⚠ Some checks incomplete'}
            </div>
          )}

          {steps.map(s => (
            <div key={s.id} className="step-row">
              <div className={`step-dot ${
                s.status === 'running' ? 'loading' :
                s.status === 'pass'    ? 'success' :
                s.status === 'fail'    ? 'error'   : 'idle'
              }`}>
                {s.status === 'pass'    ? '✓' :
                 s.status === 'fail'    ? '✗' :
                 s.status === 'running' ? '◌' : s.id}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 12, color:
                  s.status === 'fail' ? 'var(--red)' :
                  s.status === 'pass' ? 'var(--green)' :
                  'var(--text-muted)' }}>
                  {s.info ?? s.detail}
                </div>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 20 }}>
            {!publicClient && (
              <div className="alert alert-warn" style={{ marginBottom: 12, fontSize: 12 }}>
                Connect wallet or set up network to run on-chain checks.
              </div>
            )}
            <button
              className="btn btn-primary" style={{ width: '100%' }}
              onClick={run}
              disabled={running}
            >
              {running ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span> Verifying…</>
               : done   ? '↺ Re-verify'
               :          '◉ Run Verification'}
            </button>
            {someIdle && !running && !done && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                Steps 2, 3, 5 require a connected RPC (Hardhat node or Sepolia).
              </p>
            )}
          </div>
        </div>

        {/* ── Right: Proof details ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Metadata */}
          <div className="card">
            <div className="badge badge-amber" style={{ marginBottom: 12 }}>Proof Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Signer',        value: trunc(proof.signerAddress, 18) },
                { label: 'Expires',       value: fmt(proof.expiresAt) },
                { label: 'Courses shown', value: `${proof.disclosedCourses.length}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Disclosed courses */}
          <div className="card">
            <h4 style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: 12 }}>
              Disclosed Courses
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {proof.disclosedCourses.map(c => (
                <div key={c.name} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 12px', background: 'var(--bg-surface)',
                  borderRadius: 8, border: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 13 }}>{c.name}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="badge badge-cyan">{c.grade}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                      color: 'var(--text-muted)' }}>{c.proof.length}x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hashes */}
          <div className="card">
            <h4 style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: 12 }}>
              Cryptographic Values
            </h4>
            {[
              { label: 'credentialHash', value: proof.credentialHash },
              { label: 'merkleRoot',     value: proof.merkleRoot     },
              { label: 'signerAddress',  value: proof.signerAddress  },
            ].map(({ label, value }) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div className="hash-pill" style={{ display: 'flex' }}>{trunc(value, 38)}</div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}

function PageHeader() {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="badge badge-amber" style={{ marginBottom: 12 }}>Employer · Verifier</div>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>Verify Credential</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
        5-step pipeline: ECDSA → issuer registry → revocation → expiry → Merkle proofs.
      </p>
    </div>
  )
}
