import { expect } from "chai";
import { ethers } from "hardhat";

describe("CredentialRegistry", function () {
  // A setup function to deploy a fresh contract before each test
  async function deployRegistryFixture() {
    const [owner, university, randomPerson] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("CredentialRegistry");
    const registry = await Registry.deploy(owner.address);

    return { registry, owner, university, randomPerson };
  }

  describe("Deployment & Access Control", function () {
    it("Should set the right owner", async function () {
      const { registry, owner } = await deployRegistryFixture();
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("Should allow owner to add a university as an issuer", async function () {
      const { registry, owner, university } = await deployRegistryFixture();
      await registry.connect(owner).addIssuer(university.address);
      expect(await registry.issuers(university.address)).to.equal(true);
    });

    it("Should reject non-owners from adding issuers", async function () {
      const { registry, randomPerson, university } = await deployRegistryFixture();
      await expect(
        registry.connect(randomPerson).addIssuer(university.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("Anchoring and Revoking", function () {
    it("Should allow an authorized university to anchor a credential", async function () {
      const { registry, owner, university } = await deployRegistryFixture();
      
      // Setup: Make the university an issuer
      await registry.connect(owner).addIssuer(university.address);

      // Create fake 32-byte hashes for the test
      const fakeCredentialHash = ethers.id("Alice_Degree_001");
      const fakeMerkleRoot = ethers.id("Merkle_Root_XYZ");

      // Anchor it
      await expect(registry.connect(university).anchor(fakeCredentialHash, fakeMerkleRoot))
        .to.emit(registry, "CredentialAnchored")
        .withArgs(fakeCredentialHash, fakeMerkleRoot, university.address);

      // Check if it saved correctly
      expect(await registry.merkleRoots(fakeCredentialHash)).to.equal(fakeMerkleRoot);
    });

    it("Should correctly report isValidAt for valid and revoked credentials", async function () {
      const { registry, owner, university } = await deployRegistryFixture();
      await registry.connect(owner).addIssuer(university.address);

      const fakeCredentialHash = ethers.id("Alice_Degree_002");
      const fakeMerkleRoot = ethers.id("Merkle_Root_ABC");

      // 1. Anchor the credential
      await registry.connect(university).anchor(fakeCredentialHash, fakeMerkleRoot);
      
      // Get the current timestamp from the blockchain
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBeforeRevoke = blockBefore!.timestamp;

      // Ensure it is valid right now
      expect(await registry.isValidAt(fakeCredentialHash, timestampBeforeRevoke)).to.equal(true);

      // 2. Revoke the credential (Simulating Alice getting caught cheating)
      await registry.connect(owner).revoke(fakeCredentialHash);
      
      // Check the new state
      const [, revokedAt] = await registry.revocations(fakeCredentialHash);
      
      // 3. Time travel check: It should be valid BEFORE the revocation, but invalid AFTER
      expect(await registry.isValidAt(fakeCredentialHash, timestampBeforeRevoke)).to.equal(true);
      expect(await registry.isValidAt(fakeCredentialHash, revokedAt + 1n)).to.equal(false);
    });
  });
});