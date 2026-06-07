/**
 * frontend/src/pages/IssuePage.tsx — University (Issuer)
 *
 * Full issue flow in the browser (mirrors scripts/issuer/* + holder/buildMerkleTree):
 *   1. useIsIssuer          — on-chain issuer whitelist check (hooks/useRegistry)
 *   2. Form input           — student fields + courses
 *   3. buildCredentialBundle — @credchain/shared/logic
 *   4. buildMerkleTree      — @credchain/shared/merkle (random salts + root)
 *   5. signAndBuildCredential — lib/credential.ts (MetaMask EIP-191 sign)
 *   6. useAnchor            — registry.anchor(hash, root) on-chain tx
 *   7. Download             — SignedCredential JSON for the student
 */

import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useWalletClient } from 'wagmi'
import type { SignedCredential } from '@credchain/shared/types'
import { buildCredentialBundle }                         from '@credchain/shared/logic'
import { buildMerkleTree }                               from '@credchain/shared/merkle'
import { signAndBuildCredential }                        from '../lib/credential'
import { useIsIssuer, useAnchor }                       from '../hooks/useRegistry'

// ─── Local form types ────────────────────────────────────────────
interface CourseRow { id: string; name: string; grade: string }

const GRADES  = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F']
const newRow  = (): CourseRow => ({ id: crypto.randomUUID(), name: '', grade: 'A' })

function dl(data: object, filename: string) {
  const a  = document.createElement('a')
  a.href   = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─────────────────────────────────────────────────────────────────
export default function IssuePage() {
  const { address, isConnected } = useAccount()
  const { data: walletClient }   = useWalletClient()
  const { data: isIssuer, isLoading: checkingIssuer } = useIsIssuer(address)
  const { anchor, isPending, isConfirming, hash, error: anchorError } = useAnchor()

  const [studentName,    setStudentName]    = useState('')
  const [studentId,      setStudentId]      = useState('')
  const [university,     setUniversity]     = useState('')
  const [graduationDate, setGraduationDate] = useState('')
  const [courses,        setCourses]        = useState<CourseRow[]>([newRow()])
  const [step, setStep]     = useState<'idle' | 'signing' | 'anchoring' | 'done'>('idle')
  const [result, setResult] = useState<SignedCredential | null>(null)
  const [err, setErr]       = useState<string | null>(null)

  const addCourse    = () => setCourses(p => [...p, newRow()])
  const removeCourse = (id: string) => setCourses(p => p.filter(c => c.id !== id))
  const updateCourse = (id: string, field: 'name' | 'grade', val: string) =>
    setCourses(p => p.map(c => c.id === id ? { ...c, [field]: val } : c))

  const handleIssue = useCallback(async () => {
    setErr(null)
    if (!walletClient || !address) return

    // Validate
    if (!studentName.trim() || !studentId.trim() || !university.trim() || !graduationDate) {
      setErr('Please fill in all student fields.'); return
    }
    if (courses.some(c => !c.name.trim() || !c.grade.trim())) {
      setErr('All courses need a name and grade.'); return
    }

    try {
      setStep('signing')

      // Step 1 — Build bundle (placeholder salts)
      const initialBundle = buildCredentialBundle({
        studentName, studentId, university, graduationDate,
        courses: courses.map(c => ({ name: c.name, grade: c.grade })),
      })

      // Step 2 — Build salted Merkle tree (replaces ZeroHash salts)
      const { root: merkleRoot, courses: saltedCourses } = buildMerkleTree(initialBundle.courses)

      // Step 3 — Update bundle with real salts
      const saltedBundle = { ...initialBundle, courses: saltedCourses }

      // Step 4 — Sign (EIP-191 personal_sign over credentialHash bytes)
      const signed = await signAndBuildCredential(saltedBundle, walletClient, merkleRoot)

      setStep('anchoring')

      // Step 5 — Anchor on-chain
      await anchor(
        signed.bundle.credentialHash as `0x${string}`,
        signed.merkleRoot            as `0x${string}`,
      )

      setResult(signed)
      setStep('done')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
      setStep('idle')
    }
  }, [walletClient, address, studentName, studentId, university, graduationDate, courses, anchor])

  // ── Not connected ──────────────────────────────────────────────
  if (!isConnected) return (
    <div className="animate-fade-up">
      <PageHeader />
      <div className="card" style={{ textAlign: 'center', padding: '60px 32px', marginTop: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⬡</div>
        <h3 style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Wallet Not Connected</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Connect your university wallet to issue credentials.
        </p>
      </div>
    </div>
  )

  // ── Not registered issuer ──────────────────────────────────────
  if (!checkingIssuer && isIssuer === false) return (
    <div className="animate-fade-up">
      <PageHeader />
      <div className="alert alert-error" style={{ marginTop: 24 }}>
        ⚠ Wallet <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{address}</code> is
        not registered as an issuer. Ask the contract owner to add it on the{' '}
        <Link to="/admin" style={{ color: 'var(--cyan)' }}>Registry</Link> page.
      </div>
    </div>
  )

  // ── Success state ──────────────────────────────────────────────
  if (step === 'done' && result) return (
    <div className="animate-fade-up">
      <PageHeader />
      <div className="card card-glow" style={{ marginTop: 24, textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
        <h2 style={{ color: 'var(--green)', marginBottom: 8 }}>Credential Issued!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          Signed &amp; anchored on-chain for <strong>{result.bundle.studentName}</strong> ({result.bundle.studentId}).
        </p>
        <div className="hash-pill" style={{ display: 'inline-flex', marginBottom: 8 }}>
          credentialHash: {result.bundle.credentialHash.slice(0, 22)}…
        </div>
        <br />
        <div className="hash-pill" style={{ display: 'inline-flex', marginBottom: 24 }}>
          merkleRoot: {result.merkleRoot.slice(0, 22)}…
        </div>
        {hash && (
          <div className="hash-pill" style={{ display: 'inline-flex', marginBottom: 24 }}>
            TX: {hash.slice(0, 22)}…
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => dl(result, `${result.bundle.studentId}_signed.json`)}
          >
            ↓ Download signed credential
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => { setStep('idle'); setResult(null); setCourses([newRow()]) }}
          >
            Issue Another
          </button>
        </div>
      </div>
    </div>
  )

  // ── Main form ──────────────────────────────────────────────────
  const issuerReady = !checkingIssuer && isIssuer === true
  const busy = step === 'signing' || step === 'anchoring' || isPending || isConfirming

  return (
    <div className="animate-fade-up">
      <PageHeader />

      {checkingIssuer
        ? <div className="badge badge-amber" style={{ marginTop: 16, marginBottom: 24 }}>Checking issuer status…</div>
        : <div className="badge badge-green" style={{ marginTop: 16, marginBottom: 24 }}>✓ Registered Issuer</div>
      }

      {(err || anchorError) && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          ⚠ {err || anchorError?.message}
        </div>
      )}

      {busy && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: 8 }}>◌</span>
          {step === 'signing'   ? 'Generating salts, building Merkle tree, signing ECDSA…' : ''}
          {step === 'anchoring' ? 'Anchoring on-chain — confirm in MetaMask…' : ''}
          {(isPending || isConfirming) && step !== 'anchoring' ? 'Waiting for transaction…' : ''}
        </div>
      )}

      {/* ── Student Info ── */}
      <section className="card" style={{ marginBottom: 20 }}>
        <SecTitle n="01" t="Student Information" />
        <div className="grid-2" style={{ marginTop: 20 }}>
          <Field label="Student Name" required>
            <input className="form-input" placeholder="Jane Doe"
              value={studentName} onChange={e => setStudentName(e.target.value)} />
          </Field>
          <Field label="Student ID" required>
            <input className="form-input mono" placeholder="STU001"
              value={studentId} onChange={e => setStudentId(e.target.value)} />
          </Field>
          <Field label="University" required>
            <input className="form-input" placeholder="HUST"
              value={university} onChange={e => setUniversity(e.target.value)} />
          </Field>
          <Field label="Graduation Date" required>
            <input className="form-input" type="date"
              value={graduationDate} onChange={e => setGraduationDate(e.target.value)} />
          </Field>
        </div>
        <div className="alert alert-info" style={{ marginTop: 14, fontSize: 13 }}>
          Expiry is set automatically to graduation date + 50 years.
        </div>
      </section>

      {/* ── Courses ── */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <SecTitle n="02" t={`Courses (${courses.length})`} />
          <button className="btn btn-secondary btn-sm" onClick={addCourse}>+ Add Course</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {courses.map((c, i) => (
            <div key={c.id} style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: 16, position: 'relative',
            }}>
              <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                  #{String(i + 1).padStart(2, '0')}
                </span>
                {courses.length > 1 && (
                  <button className="btn btn-danger btn-sm" style={{ padding: '3px 9px' }}
                    onClick={() => removeCourse(c.id)}>✕</button>
                )}
              </div>
              <div className="grid-2">
                <Field label="Course Name">
                  <input className="form-input" placeholder="Web Development"
                    value={c.name} onChange={e => updateCourse(c.id, 'name', e.target.value)} />
                </Field>
                <Field label="Grade">
                  <select className="form-input" value={c.grade}
                    onChange={e => updateCourse(c.id, 'grade', e.target.value)}>
                    {GRADES.map(g => <option key={g}>{g}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sign ── */}
      <section className="card">
        <SecTitle n="03" t="Sign &amp; Anchor On-Chain" />
        <div className="alert alert-info" style={{ marginTop: 16 }}>
          Each course gets a unique salt, then the credential is signed and anchored on-chain.
        </div>
        <div style={{ marginTop: 20 }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleIssue}
            disabled={busy || !issuerReady}
          >
            {busy ? '⌛ Processing…' : '✦ Issue Credential'}
          </button>
        </div>
      </section>
    </div>
  )
}

function PageHeader() {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="badge badge-violet" style={{ marginBottom: 12 }}>University · Issuer</div>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>Issue Credential</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
        Build a salted Merkle tree, sign with ECDSA, and anchor the root on-chain.
      </p>
    </div>
  )
}

function SecTitle({ n, t }: { n: string; t: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--cyan)',
        background: 'var(--cyan-dim)', padding: '3px 10px', borderRadius: 6,
        border: '1px solid rgba(34,211,238,.25)',
      }}>{n}</span>
      <h3 style={{ fontSize: 16, fontWeight: 700 }} dangerouslySetInnerHTML={{ __html: t }} />
    </div>
  )
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && <span className="req">*</span>}</label>
      {children}
    </div>
  )
}
