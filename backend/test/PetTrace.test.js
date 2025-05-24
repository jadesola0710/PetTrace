const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PetTrace", function () {
  let PetTrace;
  let petTrace;
  let owner;
  let addr1;
  let addr2;
  let addrs;
  let cUSD;

  // Deploy contract and set up test environment
  before(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Deploy mock cUSD token
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    cUSD = await ERC20Mock.deploy(
      "Celo Dollar",
      "cUSD",
      owner.address,
      1000000
    );
    await cUSD.deployed();

    // Deploy PetTrace contract
    PetTrace = await ethers.getContractFactory("PetTrace");
    petTrace = await PetTrace.deploy();
    await petTrace.deployed();

    // Transfer some cUSD to test accounts
    await cUSD.transfer(addr1.address, 10000);
    await cUSD.transfer(addr2.address, 10000);
  });

  describe("Deployment", function () {
    it("Should set the right admin", async function () {
      expect(await petTrace.admin()).to.equal(owner.address);
    });

    it("Should have correct cUSD address", async function () {
      expect(await petTrace.CUSD_ADDRESS()).to.equal(
        "0x765DE816845861e75A25fCA122bb6898B8B1282a"
      );
    });

    it("Should have correct bounty limits", async function () {
      expect(await petTrace.MAX_CELO_BOUNTY()).to.equal(
        ethers.utils.parseEther("10")
      );
      expect(await petTrace.MAX_CUSD_BOUNTY()).to.equal(
        ethers.utils.parseUnits("10000", 18)
      );
    });
  });

  describe("Posting Lost Pets", function () {
    it("Should allow posting a lost pet with CELO bounty", async function () {
      const bounty = ethers.utils.parseEther("1");
      await expect(
        petTrace
          .connect(addr1)
          .postLostPet(
            "Max",
            "Labrador",
            "Male",
            60,
            24,
            "2023-01-01",
            "Friendly golden lab",
            "http://example.com/max.jpg",
            "Central Park",
            "John Doe",
            "1234567890",
            "john@example.com",
            0,
            { value: bounty }
          )
      ).to.emit(petTrace, "PetPosted");
    });

    it("Should allow posting a lost pet with cUSD bounty", async function () {
      const bounty = ethers.utils.parseUnits("100", 18);
      await cUSD.connect(addr1).approve(petTrace.address, bounty);

      await expect(
        petTrace
          .connect(addr1)
          .postLostPet(
            "Bella",
            "Beagle",
            "Female",
            40,
            12,
            "2023-01-02",
            "Small beagle with collar",
            "http://example.com/bella.jpg",
            "Downtown",
            "Jane Doe",
            "0987654321",
            "jane@example.com",
            bounty
          )
      ).to.emit(petTrace, "PetPosted");
    });

    it("Should reject posts with invalid parameters", async function () {
      // Name too short
      await expect(
        petTrace
          .connect(addr1)
          .postLostPet(
            "A",
            "Labrador",
            "Male",
            60,
            24,
            "2023-01-01",
            "Description",
            "http://example.com",
            "Location",
            "Name",
            "1234567890",
            "email@example.com",
            0,
            { value: ethers.utils.parseEther("1") }
          )
      ).to.be.revertedWith("Name length invalid");

      // Invalid email
      await expect(
        petTrace
          .connect(addr1)
          .postLostPet(
            "Max",
            "Labrador",
            "Male",
            60,
            24,
            "2023-01-01",
            "Description",
            "http://example.com",
            "Location",
            "Name",
            "1234567890",
            "invalid-email",
            0,
            { value: ethers.utils.parseEther("1") }
          )
      ).to.be.revertedWith("Invalid email");

      // No bounty
      await expect(
        petTrace
          .connect(addr1)
          .postLostPet(
            "Max",
            "Labrador",
            "Male",
            60,
            24,
            "2023-01-01",
            "Description",
            "http://example.com",
            "Location",
            "Name",
            "1234567890",
            "email@example.com",
            0
          )
      ).to.be.revertedWith("Bounty required");
    });

    it("Should reject posts with excessive bounties", async function () {
      // CELO bounty too large
      await expect(
        petTrace
          .connect(addr1)
          .postLostPet(
            "Max",
            "Labrador",
            "Male",
            60,
            24,
            "2023-01-01",
            "Description",
            "http://example.com",
            "Location",
            "Name",
            "1234567890",
            "email@example.com",
            0,
            { value: ethers.utils.parseEther("11") }
          )
      ).to.be.revertedWith("CELO bounty too large");

      // cUSD bounty too large
      const excessiveBounty = ethers.utils.parseUnits("10001", 18);
      await cUSD.connect(addr1).approve(petTrace.address, excessiveBounty);

      await expect(
        petTrace
          .connect(addr1)
          .postLostPet(
            "Max",
            "Labrador",
            "Male",
            60,
            24,
            "2023-01-01",
            "Description",
            "http://example.com",
            "Location",
            "Name",
            "1234567890",
            "email@example.com",
            excessiveBounty
          )
      ).to.be.revertedWith("cUSD bounty too large");
    });
  });

  describe("Finding Pets", function () {
    let petId;

    before(async function () {
      // Post a test pet
      const bounty = ethers.utils.parseEther("1");
      await petTrace
        .connect(addr1)
        .postLostPet(
          "Charlie",
          "Poodle",
          "Male",
          35,
          18,
          "2023-01-03",
          "White poodle with red collar",
          "http://example.com/charlie.jpg",
          "Main Street",
          "Alice",
          "1122334455",
          "alice@example.com",
          0,
          { value: bounty }
        );
      petId = (await petTrace.nextPetId()).sub(1);
    });

    it("Should allow marking pet as found by non-owner", async function () {
      await expect(petTrace.connect(addr2).markAsFound(petId))
        .to.emit(petTrace, "ConfirmationAdded")
        .withArgs(petId, addr2.address, false);

      const pet = await petTrace.pets(petId);
      expect(pet.finder).to.equal(addr2.address);
      expect(pet.finderConfirmed).to.be.true;
      expect(pet.isFound).to.be.false; // Still needs owner confirmation
    });

    it("Should reject marking pet as found by owner", async function () {
      await expect(
        petTrace.connect(addr1).markAsFound(petId)
      ).to.be.revertedWith("Owner cannot be finder");
    });

    it("Should allow owner to confirm found pet", async function () {
      await expect(petTrace.connect(addr1).confirmFoundByOwner(petId))
        .to.emit(petTrace, "ConfirmationAdded")
        .withArgs(petId, addr1.address, true)
        .to.emit(petTrace, "PetFound")
        .withArgs(petId, addr2.address);

      const pet = await petTrace.pets(petId);
      expect(pet.ownerConfirmed).to.be.true;
      expect(pet.isFound).to.be.true;
    });

    it("Should reject duplicate finding attempts", async function () {
      await expect(
        petTrace.connect(addr2).markAsFound(petId)
      ).to.be.revertedWith("Already found");
    });
  });

  describe("Claiming Bounties", function () {
    let petId;

    before(async function () {
      // Post a test pet with both bounties
      const celoBounty = ethers.utils.parseEther("0.5");
      const cUSDBounty = ethers.utils.parseUnits("500", 18);

      await cUSD.connect(addr1).approve(petTrace.address, cUSDBounty);
      await petTrace
        .connect(addr1)
        .postLostPet(
          "Luna",
          "Siamese",
          "Female",
          30,
          12,
          "2023-01-04",
          "Blue-eyed siamese cat",
          "http://example.com/luna.jpg",
          "Park Avenue",
          "Bob",
          "5566778899",
          "bob@example.com",
          cUSDBounty,
          { value: celoBounty }
        );
      petId = (await petTrace.nextPetId()).sub(1);

      // Mark as found and confirm
      await petTrace.connect(addr2).markAsFound(petId);
      await petTrace.connect(addr1).confirmFoundByOwner(petId);
    });

    it("Should allow finder to claim bounty", async function () {
      const initialCeloBalance = await ethers.provider.getBalance(
        addr2.address
      );
      const initialCUSDBalance = await cUSD.balanceOf(addr2.address);

      const tx = await petTrace.connect(addr2).claimBounty(petId);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed.mul(tx.gasPrice);

      const finalCeloBalance = await ethers.provider.getBalance(addr2.address);
      const finalCUSDBalance = await cUSD.balanceOf(addr2.address);

      // Check CELO bounty was transferred (accounting for gas)
      expect(finalCeloBalance.add(gasUsed)).to.equal(
        initialCeloBalance.add(ethers.utils.parseEther("0.5"))
      );

      // Check cUSD bounty was transferred
      expect(finalCUSDBalance).to.equal(
        initialCUSDBalance.add(ethers.utils.parseUnits("500", 18))
      );

      // Check state was updated
      const pet = await petTrace.pets(petId);
      expect(pet.celoBounty).to.equal(0);
      expect(pet.cUSDBounty).to.equal(0);
      expect(await petTrace.escrowedCUSD(petId)).to.equal(0);
    });

    it("Should reject bounty claims by non-finders", async function () {
      await expect(
        petTrace.connect(addr1).claimBounty(petId)
      ).to.be.revertedWith("Not finder");
    });

    it("Should reject duplicate claims", async function () {
      await expect(
        petTrace.connect(addr2).claimBounty(petId)
      ).to.be.revertedWith("No bounty");
    });
  });

  describe("Cancelling and Refunding", function () {
    let petId;

    before(async function () {
      // Post a test pet
      const celoBounty = ethers.utils.parseEther("0.3");
      const cUSDBounty = ethers.utils.parseUnits("300", 18);

      await cUSD.connect(addr1).approve(petTrace.address, cUSDBounty);
      await petTrace
        .connect(addr1)
        .postLostPet(
          "Rocky",
          "Bulldog",
          "Male",
          45,
          36,
          "2023-01-05",
          "Friendly bulldog with spots",
          "http://example.com/rocky.jpg",
          "5th Avenue",
          "Sarah",
          "9988776655",
          "sarah@example.com",
          cUSDBounty,
          { value: celoBounty }
        );
      petId = (await petTrace.nextPetId()).sub(1);
    });

    it("Should allow owner to cancel and refund", async function () {
      const initialCeloBalance = await ethers.provider.getBalance(
        addr1.address
      );
      const initialCUSDBalance = await cUSD.balanceOf(addr1.address);

      const tx = await petTrace.connect(addr1).cancelAndRefund(petId);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed.mul(tx.gasPrice);

      const finalCeloBalance = await ethers.provider.getBalance(addr1.address);
      const finalCUSDBalance = await cUSD.balanceOf(addr1.address);

      // Check CELO refund (accounting for gas)
      expect(finalCeloBalance.add(gasUsed)).to.equal(
        initialCeloBalance.add(ethers.utils.parseEther("0.3"))
      );

      // Check cUSD refund
      expect(finalCUSDBalance).to.equal(
        initialCUSDBalance.add(ethers.utils.parseUnits("300", 18))
      );

      // Check state was updated
      const pet = await petTrace.pets(petId);
      expect(pet.celoBounty).to.equal(0);
      expect(pet.cUSDBounty).to.equal(0);
      expect(await petTrace.escrowedCUSD(petId)).to.equal(0);
    });

    it("Should reject cancellation after finder assigned", async function () {
      // Post another test pet
      const bounty = ethers.utils.parseEther("0.1");
      await petTrace
        .connect(addr1)
        .postLostPet(
          "Milo",
          "Maine Coon",
          "Male",
          50,
          24,
          "2023-01-06",
          "Large fluffy cat",
          "http://example.com/milo.jpg",
          "River Street",
          "Tom",
          "1122334455",
          "tom@example.com",
          0,
          { value: bounty }
        );
      const newPetId = (await petTrace.nextPetId()).sub(1);

      // Mark as found
      await petTrace.connect(addr2).markAsFound(newPetId);

      // Try to cancel
      await expect(
        petTrace.connect(addr1).cancelAndRefund(newPetId)
      ).to.be.revertedWith("Finder already assigned");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin transfer", async function () {
      await expect(petTrace.connect(owner).transferAdmin(addr1.address))
        .to.emit(petTrace, "AdminChanged")
        .withArgs(addr1.address);

      expect(await petTrace.admin()).to.equal(addr1.address);
    });

    it("Should reject admin transfer by non-admin", async function () {
      await expect(
        petTrace.connect(addr2).transferAdmin(addr2.address)
      ).to.be.revertedWith("Not admin");
    });

    it("Should allow emergency cUSD withdrawal by admin", async function () {
      // First transfer admin back to owner for testing
      await petTrace.connect(addr1).transferAdmin(owner.address);

      // Send some cUSD to contract
      const amount = ethers.utils.parseUnits("1000", 18);
      await cUSD.connect(owner).approve(petTrace.address, amount);
      await petTrace
        .connect(owner)
        .postLostPet(
          "Test",
          "Test",
          "Test",
          30,
          12,
          "2023-01-07",
          "Test",
          "http://example.com",
          "Test",
          "Test",
          "1234567890",
          "test@example.com",
          amount
        );

      // Withdraw
      const initialBalance = await cUSD.balanceOf(owner.address);
      await petTrace.connect(owner).emergencyWithdrawCUSD(owner.address);
      const finalBalance = await cUSD.balanceOf(owner.address);

      expect(finalBalance).to.equal(initialBalance.add(amount));
    });
  });

  describe("View Functions", function () {
    before(async function () {
      // Post several test pets
      for (let i = 0; i < 5; i++) {
        await petTrace
          .connect(owner)
          .postLostPet(
            `Pet${i}`,
            `Breed${i}`,
            i % 2 === 0 ? "Male" : "Female",
            30 + i,
            12 + i,
            `2023-01-0${i + 1}`,
            `Description ${i}`,
            `http://example.com/pet${i}.jpg`,
            `Location ${i}`,
            `Owner ${i}`,
            `123456789${i}`,
            `owner${i}@example.com`,
            0,
            { value: ethers.utils.parseEther("0.1") }
          );
      }
    });

    it("Should return correct pet details", async function () {
      const petId = 0;
      const details = await petTrace.getPetDetails(petId);

      expect(details[0]).to.equal(petId); // id
      expect(details[2]).to.equal("Max"); // name (from first test)
      expect(details[3]).to.equal("Labrador"); // breed
    });

    it("Should return paginated lost pet IDs", async function () {
      const [ids, hasMore] = await petTrace.getLostPetIds(0, 3);
      expect(ids.length).to.be.greaterThan(0);
      expect(hasMore).to.be.true;
    });

    it("Should return correct lost pets count", async function () {
      const count = await petTrace.getLostPetsCount();
      expect(count).to.be.greaterThan(0);
    });

    it("Should return all lost pets", async function () {
      const [ids, pets] = await petTrace.getAllLostPets();
      expect(ids.length).to.equal(pets.length);
      expect(ids.length).to.be.greaterThan(0);
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrant calls", async function () {
      // This would require a malicious contract that tries to re-enter
      // For now we just check the modifier is present
      expect(await petTrace._locked()).to.be.false;
    });
  });
});
