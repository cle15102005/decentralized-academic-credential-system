/**
 * shared/merkle.ts
 *
 * Merkle tree construction and selective-disclosure proof generation.
 * Uses OpenZeppelin StandardMerkleTree — same algorithm as on-chain MerkleProof.verify.
 *
 * Used by:
 *   - scripts/holder/buildMerkleTree.ts, scripts/holder/generateProof.ts
 *   - frontend/src/pages/IssuePage.tsx  (assign salts + root before signing)
 *   - frontend/src/pages/ProvePage.tsx  (rebuild tree from salts, generate proofs)
 *
 * Runs in Node.js 18+ and the browser (random salts via global crypto.getRandomValues).
 */

import { StandardMerkleTree } from '@openzeppelin/merkle-tree'
import { bytesToHex } from 'viem'
import type { Course, DisclosedCourse } from './types'
import { ZERO_HASH } from './logic'

/** Result of buildMerkleTree — tree handle, root hash, and courses with real salts. */
export interface MerkleTreeResult {
  tree:    StandardMerkleTree<[string, string, string]>
  root:    string
  courses: Course[]
}

/** Generate a random 32-byte hex salt for a course leaf. */
function randomSalt(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
}

/**
 * Build a salted Merkle tree from a course list.
 * Courses with ZERO_HASH (or no salt) get a fresh random salt; existing salts are kept.
 *
 * Used by:
 *   - scripts/holder/buildMerkleTree.ts  (CLI: npm run holder:tree)
 *   - frontend IssuePage step 2            (before ECDSA sign + anchor)
 */
export function buildMerkleTree(
  courses: { name: string; grade: string; salt?: string }[]
): MerkleTreeResult {
  if (courses.length === 0) {
    throw new Error('At least one course is required to build a Merkle tree')
  }

  const coursesWithSalts: Course[] = courses.map(c => {
    const isPlaceholder = !c.salt || c.salt === ZERO_HASH
    const salt = isPlaceholder ? randomSalt() : (c.salt as string)
    return { name: c.name, grade: c.grade, salt }
  })

  const rows: [string, string, string][] = coursesWithSalts.map(c => [c.name, c.grade, c.salt])
  const tree = StandardMerkleTree.of<[string, string, string]>(rows, ['string', 'string', 'bytes32'])

  return { tree, root: tree.root, courses: coursesWithSalts }
}

/**
 * Generate Merkle sibling proofs for the selected course names.
 * Returns DisclosedCourse[] ready to embed in a ProofPackage.
 *
 * Used by:
 *   - scripts/holder/generateProof.ts, scripts/holder/exportProof.ts
 *   - frontend/src/pages/ProvePage.tsx
 */
export function generateProof(
  treeResult: MerkleTreeResult,
  selectedCourseNames: string[]
): DisclosedCourse[] {
  const { tree, courses } = treeResult

  if (selectedCourseNames.length === 0) {
    throw new Error('Select at least one course')
  }

  const courseMap = new Map<string, Course>(courses.map(c => [c.name, c]))
  const disclosed: DisclosedCourse[] = []

  for (const name of selectedCourseNames) {
    const course = courseMap.get(name)
    if (!course) throw new Error(`Course not found in credential: ${name}`)

    const leafIndex = tree.leafLookup([course.name, course.grade, course.salt])
    const proof = tree.getProof(leafIndex)

    disclosed.push({
      name:  course.name,
      grade: course.grade,
      salt:  course.salt,
      proof,
    })
  }

  return disclosed
}

/**
 * Convenience: rebuild tree from stored courses (with salts) then generate proofs.
 * Used by: scripts/holder/exportProof.ts CLI and generateProof.ts main block.
 */
export function generateProofFromCourses(
  courses: Course[],
  selectedCourseNames: string[]
): DisclosedCourse[] {
  const treeResult = buildMerkleTree(courses)
  return generateProof(treeResult, selectedCourseNames)
}
