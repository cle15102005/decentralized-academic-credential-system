//FILE: CredentialRegistry.sol
/*
Purpose  : Central on-chain registry. Three mappings, three roles.
Inherits : OpenZeppelin Ownable, AccessControl

State variables:
  mapping(address => bool)   public issuers
    └─ tracks authorized university wallet addresses

  mapping(bytes32 => bytes32) public merkleRoots
    └─ credentialHash => merkleRoot
    └─ set when a credential is anchored by an issuer

  mapping(bytes32 => Revocation) public revocations
    └─ credentialHash => Revocation { bool revoked, uint256 revokedAt }
    └─ timestamped revocation (advance over P6 boolean-only flag)

Structs:
  struct Revocation {
    bool      revoked
    uint256   revokedAt    ← block.timestamp at time of revocation
  }

Events:
  IssuerAdded(address indexed issuer)
  IssuerRemoved(address indexed issuer)
  CredentialAnchored(bytes32 indexed credentialHash, bytes32 merkleRoot, address indexed issuer)
  CredentialRevoked(bytes32 indexed credentialHash, uint256 revokedAt)

Modifiers:
  onlyOwner()    ← inherited from Ownable
  onlyIssuer()   ← checks issuers[msg.sender] == true

Functions:
  addIssuer(address uni)         onlyOwner   → issuers[uni] = true
  removeIssuer(address uni)      onlyOwner   → issuers[uni] = false
  
  anchor(
    bytes32 credentialHash,
    bytes32 merkleRoot
  )                              onlyIssuer  → stores root, emits event

  revoke(bytes32 credentialHash) onlyOwner   → stores revocation with timestamp

  isValidAt(
    bytes32 credentialHash,
    uint256 timestamp
  ) view → bool
    └─ returns true if credential was NOT revoked before the given timestamp
    └─ enables checking "was this degree valid when I hired them in 2023?"

  verify(
    bytes32 credentialHash,
    bytes32[] calldata proof,
    bytes32 leaf
  ) external view → bool
    └─ checks: not revoked + not expired + root exists + MerkleProof.verify()
    └─ calls MerkleVerifier.verify() internally
*/

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ICredentialRegistry.sol";

/**
 * ============================================================================
 * @title CredentialRegistry
 * @dev Central on-chain registry for the decentralized academic credential system.
 * Handles Role-Based Access Control (RBAC) to manage authorized university issuers.
 * Allows authorized issuers to anchor Merkle roots of credentials.
 * Supports timestamped revocations to check credential validity at specific points in time.
 * ============================================================================
 */
contract CredentialRegistry is ICredentialRegistry, Ownable {
    
    // --- State Variables ---
    
    // Tracks authorized university wallet addresses
    mapping(address => bool) public issuers;
    
    // Maps a unique credential hash to its mathematical Merkle Root
    mapping(bytes32 => bytes32) public merkleRoots;
    
    // Maps a unique credential hash to its Revocation status and timestamp
    mapping(bytes32 => Revocation) public revocations;

    // --- Modifiers ---
    
    modifier onlyIssuer() {
        require(issuers[msg.sender], "Caller is not an authorized issuer");
        _;
    }

    /**
     * @dev Constructor sets the initial owner (the deployer).
     * @param initialOwner The address that manages the consortium (adds/removes issuers).
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    // --- Write Functions ---

    /**
     * @dev Adds a university address to the authorized issuers list.
     * Only the contract owner (admin) can call this.
     */
    function addIssuer(address uni) external onlyOwner {
        require(!issuers[uni], "Address is already an issuer");
        issuers[uni] = true;
        emit IssuerAdded(uni);
    }

    /**
     * @dev Removes a university address from the authorized issuers list.
     */
    function removeIssuer(address uni) external onlyOwner {
        require(issuers[uni], "Address is not an issuer");
        issuers[uni] = false;
        emit IssuerRemoved(uni);
    }

    /**
     * @dev Anchors a credential's Merkle root to the blockchain.
     * @param credentialHash The unique ID hash of the student's degree.
     * @param merkleRoot The root of the salted leaf Merkle tree hiding the grades.
     */
    function anchor(bytes32 credentialHash, bytes32 merkleRoot) external onlyIssuer {
        require(merkleRoots[credentialHash] == bytes32(0), "Credential already anchored");
        merkleRoots[credentialHash] = merkleRoot;
        emit CredentialAnchored(credentialHash, merkleRoot, msg.sender);
    }

    /**
     * @dev Revokes a previously anchored credential, recording the exact timestamp.
     * Unlike simple boolean flags, this proves *when* a student was expelled/revoked.
     */
    function revoke(bytes32 credentialHash) external onlyOwner {
        require(merkleRoots[credentialHash] != bytes32(0), "Credential does not exist");
        require(!revocations[credentialHash].revoked, "Credential already revoked");
        
        revocations[credentialHash] = Revocation({
            revoked: true,
            revokedAt: block.timestamp
        });

        emit CredentialRevoked(credentialHash, block.timestamp);
    }

    // --- Read Functions ---

    /**
     * @dev Checks if a credential was valid at a specific point in time.
     * Helps employers answer: "Was this degree valid when I hired them in 2023?"
     * @param credentialHash The unique ID hash of the credential.
     * @param timestamp The specific UNIX time to check against.
     * @return bool True if it existed and was NOT revoked before the given timestamp.
     */
    function isValidAt(bytes32 credentialHash, uint256 timestamp) external view returns (bool) {
        // If it was never anchored, it's invalid
        if (merkleRoots[credentialHash] == bytes32(0)) {
            return false;
        }
        
        Revocation memory rev = revocations[credentialHash];
        
        // If it was never revoked, it is always valid
        if (!rev.revoked) {
            return true;
        }

        // If it was revoked, it is only valid if the time we are checking 
        // happened strictly BEFORE the exact moment it was revoked.
        return timestamp < rev.revokedAt;
    }
}

