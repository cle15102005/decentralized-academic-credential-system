/**
 * ProvePage.tsx  —  Actor: Student (Holder)
 *
 * Real flow (mirrors scripts/holder/exportProof.ts):
 *   1. Upload SignedCredential JSON (output from IssuePage)
 *   2. Select courses to disclose
 *   3. generateProof() → DisclosedCourse[] with Merkle sibling hashes
 *   4. buildProofPackage() → ProofPackage
 *   5. Download proof.json
 */

import { useState, useRef, useCallback } from 'react'
import type { SignedCredential, ProofPackage } from '@credchain/shared/types'
import { buildMerkleTree, generateProof }      from '../lib/merkle'

// ─────────────────────────────────────────────────────────────────
const fmt = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })

function dl(data: object, filename: string) {
  const a = document.createElement('a')
  a.href  = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  a.download = filename; a.click(); URL.revokeObjectURL(a.href)
}

// ─────────────────────────────────────────────────────────────────
export default function ProvePage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging,    setDragging]    = useState(false)
  const [credential,  setCredential]  = useState<SignedCredential | null>(null)
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [proof,       setProof]       = useState<ProofPackage | null>(null)
  const [generating,  setGenerating]  = useState(false)
  const [loadErr,     setLoadErr]     = useState<string | null>(null)
  const [proofErr,    setProofErr]    = useState<string | null>(null)

  // ── Load file ────────────────────────────────────────────────
  const parseFile = (text: string) => {
    try {
      const data = JSON.parse(text) as SignedCredential
      // validate shape
      if (!data.bundle?.credentialHash || !data.signature || !Array.isArray(data.bundle?.courses)) {
        throw new Error('Invalid file — expected SignedCredential JSON from the Issue step')
      }
      setCredential(data); setSelected(new Set()); setProof(null); setLoadErr(null)
    } catch (e) { setLoadErr(e instanceof Error ? e.message : 'Parse error') }
  }

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.json')) { setLoadErr('Upload a .json file'); return }
    const r = new FileReader()
    r.onload = e => parseFile(e.target!.result as string)
    r.readAsText(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }, [])

  const toggle = (name: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })

  // ── Generate Proof ─────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!credential || selected.size === 0) return
    setProofErr(null); setGenerating(true)

    try {
      await new Promise(r => setTimeout(r, 300)) // yield to render loading state

      /**
       * Rebuild the Merkle tree from existing courses + salts.
       * The salts are already set (from the Issue step), so buildMerkleTree
       * will keep them as-is (they're not ZeroHash).
       * This mirrors: scripts/holder/generateProof.ts → generateProofFromCourses()
       */
      const treeResult   = buildMerkleTree(credential.bundle.courses)
      const disclosed    = generateProof(treeResult, [...selected])

      const proofPackage: ProofPackage = {
        credentialHash:  credential.bundle.credentialHash,
        signerAddress:   credential.signerAddress,
        signature:       credential.signature,
        expiresAt:       credential.bundle.expiresAt,
        merkleRoot:      credential.merkleRoot,
        disclosedCourses: disclosed,
      }

      setProof(proofPackage)
    } catch (e: unknown) {
      setProofErr(e instanceof Error ? e.message : String(e))
    } finally {
      setGenerating(false)
    }
  }, [credential, selected])

  // ── Upload screen ──────────────────────────────────────────────
  if (!credential) return (
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
        <div style={{ fontSize: 40, marginBottom: 12 }}>◈</div>
        <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Drop signed credential here</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Upload the <code style={{ fontFamily: 'var(--font-mono)' }}>*_signed.json</code> from the Issue step
        </p>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>
      {loadErr && <div className="alert alert-error" style={{ marginTop: 16 }}>⚠ {loadErr}</div>}
    </div>
  )

  // ── Proof ready ────────────────────────────────────────────────
  if (proof) return (
    <div className="animate-fade-up">
      <PageHeader />
      <div className="card card-glow" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div className="badge badge-green" style={{ marginBottom: 10 }}>✓ Proof Ready</div>
            <h2 style={{ fontSize: 22, marginBottom: 4 }}>Selective Disclosure Proof</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {proof.disclosedCourses.length} of {credential.bundle.courses.length} courses revealed.
              Merkle proofs generated for each.
            </p>
          </div>
          <button className="btn btn-ghost btn-sm"
            onClick={() => { setProof(null); setSelected(new Set()) }}>← Back</button>
        </div>

        <hr className="divider" />

        <h4 style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Disclosed Courses
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {proof.disclosedCourses.map(c => (
            <div key={c.name} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--green-dim)', border: '1px solid rgba(74,222,128,.25)',
              borderRadius: 8, padding: '10px 14px',
            }}>
              <span style={{ fontSize: 14 }}>{c.name}</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="badge badge-green">{c.grade}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                  {c.proof.length} sibling(s)
                </span>
              </div>
            </div>
          ))}
        </div>

        {credential.bundle.courses.length > proof.disclosedCourses.length && (
          <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 13 }}>
            🔒 {credential.bundle.courses.length - proof.disclosedCourses.length} course(s) remain hidden.
            Only salt hashes contribute to the Merkle root — the verifier cannot reconstruct them.
          </div>
        )}

        <div className="hash-pill" style={{ marginBottom: 16 }}>
          merkleRoot: {proof.merkleRoot.slice(0, 22)}…
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-lg"
            onClick={() => dl(proof, `proof_${proof.credentialHash.slice(2, 10)}.json`)}>
            ↓ Download proof.json
          </button>
          <button className="btn btn-ghost"
            onClick={() => { setCredential(null); setProof(null) }}>Start Over</button>
        </div>
      </div>
    </div>
  )

  // ── Select courses screen ──────────────────────────────────────
  const expired = credential.bundle.expiresAt < Date.now() / 1000

  return (
    <div className="animate-fade-up">
      <PageHeader />

      {/* Credential summary */}
      <div className="card" style={{ marginBottom: 20, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div className="badge badge-cyan" style={{ marginBottom: 10 }}>Credential Loaded</div>
            <h2 style={{ fontSize: 22, marginBottom: 4 }}>{credential.bundle.studentName}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{credential.bundle.university}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setCredential(null)}>✕ Unload</button>
        </div>
        <div className="grid-3">
          {[
            { label: 'Student ID', value: credential.bundle.studentId },
            { label: 'Graduated',  value: credential.bundle.graduationDate },
            { label: 'Expires',    value: fmt(credential.bundle.expiresAt), warn: expired },
          ].map(({ label, value, warn }) => (
            <div key={label} style={{
              background: 'var(--bg-surface)', borderRadius: 8,
              padding: 12, border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: warn ? 'var(--red)' : 'var(--text-primary)' }}>
                {value}{warn && ' ⚠'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Course selector */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, marginBottom: 4 }}>Select Courses to Disclose</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {selected.size} of {credential.bundle.courses.length} selected
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            if (selected.size === credential.bundle.courses.length)
              setSelected(new Set())
            else
              setSelected(new Set(credential.bundle.courses.map(c => c.name)))
          }}>
            {selected.size === credential.bundle.courses.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {credential.bundle.courses.map(c => {
            const checked = selected.has(c.name)
            return (
              <div key={c.name}
                className={`checkbox-row ${checked ? 'checked' : ''}`}
                onClick={() => toggle(c.name)}
              >
                <div className="checkbox-box">
                  {checked && (
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path d="M1 5l3.5 3.5L11 1" stroke="black" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</div>
                </div>
                <span className={`badge ${checked ? 'badge-green' : 'badge-cyan'}`}>{c.grade}</span>
              </div>
            )
          })}
        </div>

        {proofErr && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠ {proofErr}</div>}

        {selected.size === 0 && (
          <div className="alert alert-warn" style={{ marginBottom: 16 }}>
            Select at least one course to generate a proof.
          </div>
        )}

        <button
          className="btn btn-primary btn-lg"
          disabled={selected.size === 0 || generating}
          onClick={handleGenerate}
        >
          {generating
            ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span> Generating Merkle proofs…</>
            : `◈ Generate Proof (${selected.size} course${selected.size !== 1 ? 's' : ''})`
          }
        </button>
      </div>
    </div>
  )
}

function PageHeader() {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="badge badge-cyan" style={{ marginBottom: 12 }}>Student · Holder</div>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>Create Proof</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
        Selectively disclose courses with Merkle proofs. Undisclosed courses stay private.
      </p>
    </div>
  )
}
