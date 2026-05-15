import { expect } from "chai";
import { ethers } from "hardhat";

describe("MerkleVerifier", function () {
  async function deployVerifierFixture() {
    const Verifier = await ethers.getContractFactory("MerkleVerifier");
    const verifier = await Verifier.deploy();
    return { verifier };
  }

  it("Should hash a leaf correctly using courseName, grade, and salt", async function () {
    const { verifier } = await deployVerifierFixture();

    const courseName = "Web Development";
    const grade = "A";
    const salt = ethers.encodeBytes32String("my_secret_password_123");

    // The smart contract output
    const contractHash = await verifier.hashLeaf(courseName, grade, salt);

    // The expected output calculated locally in standard Ethers.js
    const expectedHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "bytes32"],
        [courseName, grade, salt]
      )
    );

    expect(contractHash).to.equal(expectedHash);
  });
});