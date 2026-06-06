/**
 * lib/merkle.ts
 * Browser-compatible implementation of:
 *   scripts/holder/buildMerkleTree.ts
 *   scripts/holder/generateProof.ts
 *   scripts/holder/merkleUtils.ts
 *
 * Uses @openzeppelin/merkle-tree + viem. No Node.js APIs.
 */

import { StandardMerkleTree } from '@openzeppelin/merkle-tree'
import { keccak256, encodeAbiParameters, bytesToHex } from 'viem'
import type { Course, DisclosedCourse } from '@credchain/shared/types'

export interface MerkleTreeResult {
  tree:    StandardMerkleTree<[string, string, string]>
  root:    string
  courses: Course[]   // courses with real salts filled in
}

// ─── buildMerkleTree ─────────────────────────────────────────────
/**
 * Build a salted Merkle tree from a course list.
 * Each course without a real salt gets a fresh random 32-byte salt.
 * Mirrors: scripts/holder/buildMerkleTree.ts → buildMerkleTree()
 */
export function buildMerkleTree(
  courses: { name: string; grade: string; salt?: string }[]
): MerkleTreeResult {
  if (courses.length === 0) {
    throw new Error('At least one course is required to build a Merkle tree')
  }

  const ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000'

  // Assign fresh random salts for any course without one
  const coursesWithSalts: Course[] = courses.map(c => {
    const isPlaceholder = !c.salt || c.salt === ZERO
    const salt = isPlaceholder
      ? bytesToHex(crypto.getRandomValues(new Uint8Array(32)))  // browser-safe
      : c.salt as string
    return { name: c.name, grade: c.grade, salt }
  })

  // Build OpenZeppelin StandardMerkleTree — same algorithm as scripts
  const rows: [string, string, string][] = coursesWithSalts.map(c => [c.name, c.grade, c.salt])
  const tree = StandardMerkleTree.of<[string, string, string]>(rows, ['string', 'string', 'bytes32'])

  return { tree, root: tree.root, courses: coursesWithSalts }
}

// ─── generateProof ───────────────────────────────────────────────
/**
 * Generate Merkle proofs for selected courses.
 * Mirrors: scripts/holder/generateProof.ts → generateProof()
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

// ─── standardTreeLeaf ────────────────────────────────────────────
/**
 * Compute the StandardMerkleTree leaf node hash for a course.
 * Mirrors: scripts/holder/merkleUtils.ts → standardTreeLeaf()
 *
 * Algorithm:
 *   innerHash = keccak256(abi.encode(courseName, grade, salt))
 *   treeLeaf  = keccak256(innerHash)   ← double-hash per OZ StandardMerkleTree
 */
export function standardTreeLeaf(courseName: string, grade: string, salt: string): `0x${string}` {
  const innerHash = keccak256(
    encodeAbiParameters(
      [{ type: 'string' }, { type: 'string' }, { type: 'bytes32' }],
      [courseName, grade, salt as `0x${string}`]
    )
  )
  return keccak256(innerHash)
}
