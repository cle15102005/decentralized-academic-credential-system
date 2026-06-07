//FILE: interfaces/ICredentialRegistry.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ============================================================================
 * @title ICredentialRegistry
 * @dev Interface for the CredentialRegistry contract.
 * Contains all public function signatures, structs, and events to allow 
 * external scripts and frontend applications to interact with the registry.
 * ============================================================================
 */
interface ICredentialRegistry {
    // Structs
    struct Revocation {
        bool revoked;
        uint256 revokedAt;
    }

    // Events
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    event CredentialAnchored(bytes32 indexed credentialHash, bytes32 merkleRoot, address indexed issuer);
    event CredentialRevoked(bytes32 indexed credentialHash, uint256 revokedAt);

    // Write Functions
    function addIssuer(address uni) external;
    function removeIssuer(address uni) external;
    function anchor(bytes32 credentialHash, bytes32 merkleRoot) external;
    function revoke(bytes32 credentialHash) external;

    // Read Functions
    function isValidAt(bytes32 credentialHash, uint256 timestamp) external view returns (bool);
    function issuers(address account) external view returns (bool);
    function merkleRoots(bytes32 credentialHash) external view returns (bytes32);
    function credentialIssuers(bytes32 credentialHash) external view returns (address);
    function revocations(bytes32 credentialHash) external view returns (bool, uint256);
}