// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);
}

contract PetTrace {
    struct Pet {
        uint256 id;
        address payable owner;
        string name;
        string breed;
        string gender;
        uint256 sizeCm;
        uint256 ageMonths;
        string dateTimeLost;
        string description;
        string imageUrl;
        string lastSeenLocation;
        string contactName;
        string contactPhone;
        string contactEmail;
        uint256 ethBounty;
        uint256 cusdBounty;
        bool isFound;
        bool ownerConfirmed;
        bool finderConfirmed;
        address finder;
    }

    // Alfajores Testnet CUSD address
    address public constant CUSD_ADDRESS =
        0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;
    uint256 public nextPetId;
    mapping(uint256 => Pet) public pets;
    mapping(uint256 => uint256) public escrowedCUSD;

    event PetPosted(uint256 indexed petId, address indexed owner);
    event PetFound(uint256 indexed petId, address indexed finder);
    event BountyClaimed(
        uint256 indexed petId,
        address indexed finder,
        uint256 ethAmount,
        uint256 cusdAmount
    );
    event ConfirmationAdded(
        uint256 indexed petId,
        address indexed confirmer,
        bool isOwner
    );
    event BountyRefunded(
        uint256 indexed petId,
        address indexed owner,
        uint256 ethAmount,
        uint256 cusdAmount
    );

    function postLostPet(
        string calldata name,
        string calldata breed,
        string calldata gender,
        uint256 sizeCm,
        uint256 ageMonths,
        string calldata dateTimeLost,
        string calldata description,
        string calldata imageUrl,
        string calldata lastSeenLocation,
        string calldata contactName,
        string calldata contactPhone,
        string calldata contactEmail,
        uint256 cusdBounty
    ) external payable {
        require(
            msg.value > 0 || cusdBounty > 0,
            "Either ETH or CUSD bounty required"
        );
        require(bytes(name).length > 0, "Pet name required");
        require(
            bytes(lastSeenLocation).length > 0,
            "Last seen location required"
        );

        if (cusdBounty > 0) {
            require(
                IERC20(CUSD_ADDRESS).transferFrom(
                    msg.sender,
                    address(this),
                    cusdBounty
                ),
                "CUSD transfer failed. Check approval and balance."
            );
            escrowedCUSD[nextPetId] = cusdBounty;
        }

        pets[nextPetId] = Pet({
            id: nextPetId,
            owner: payable(msg.sender),
            name: name,
            breed: breed,
            gender: gender,
            sizeCm: sizeCm,
            ageMonths: ageMonths,
            dateTimeLost: dateTimeLost,
            description: description,
            imageUrl: imageUrl,
            lastSeenLocation: lastSeenLocation,
            contactName: contactName,
            contactPhone: contactPhone,
            contactEmail: contactEmail,
            ethBounty: msg.value,
            cusdBounty: cusdBounty,
            isFound: false,
            ownerConfirmed: false,
            finderConfirmed: false,
            finder: address(0)
        });

        emit PetPosted(nextPetId, msg.sender);
        nextPetId++;
    }

    function markAsFound(uint256 petId) external {
        Pet storage pet = pets[petId];
        require(!pet.isFound, "Already found");
        require(pet.owner != address(0), "Pet does not exist");
        require(msg.sender != pet.owner, "Owner cannot be finder");

        pet.finder = msg.sender;
        pet.finderConfirmed = true;

        if (pet.ownerConfirmed) {
            pet.isFound = true;
            emit PetFound(petId, msg.sender);
        }

        emit ConfirmationAdded(petId, msg.sender, false);
    }

    function confirmFoundByOwner(uint256 petId) external {
        Pet storage pet = pets[petId];
        require(!pet.isFound, "Already found");
        require(msg.sender == pet.owner, "Only owner can confirm");
        require(pet.finder != address(0), "No finder yet");

        pet.ownerConfirmed = true;

        if (pet.finderConfirmed) {
            pet.isFound = true;
            emit PetFound(petId, pet.finder);
        }

        emit ConfirmationAdded(petId, msg.sender, true);
    }

    function claimBounty(uint256 petId) external {
        Pet storage pet = pets[petId];
        require(pet.isFound, "Pet not confirmed as found by both parties");
        require(msg.sender == pet.finder, "Not the finder");
        require(pet.ethBounty > 0 || pet.cusdBounty > 0, "No bounty to claim");

        uint256 ethAmount = pet.ethBounty;
        uint256 cusdAmount = pet.cusdBounty;

        // Reset bounties
        pet.ethBounty = 0;
        pet.cusdBounty = 0;
        escrowedCUSD[petId] = 0;

        // Transfer ETH bounty if exists
        if (ethAmount > 0) {
            payable(msg.sender).transfer(ethAmount);
        }

        // Transfer CUSD bounty if exists
        if (cusdAmount > 0) {
            require(
                IERC20(CUSD_ADDRESS).transfer(msg.sender, cusdAmount),
                "CUSD transfer failed"
            );
        }

        emit BountyClaimed(petId, msg.sender, ethAmount, cusdAmount);
    }

    function cancelAndRefund(uint256 petId) external {
        Pet storage pet = pets[petId];
        require(msg.sender == pet.owner, "Only owner can cancel");
        require(!pet.isFound, "Pet already found");
        require(pet.finder == address(0), "Finder already assigned");

        uint256 ethAmount = pet.ethBounty;
        uint256 cusdAmount = pet.cusdBounty;

        // Reset bounties
        pet.ethBounty = 0;
        pet.cusdBounty = 0;
        escrowedCUSD[petId] = 0;

        // Refund ETH bounty if exists
        if (ethAmount > 0) {
            payable(msg.sender).transfer(ethAmount);
        }

        // Refund CUSD bounty if exists
        if (cusdAmount > 0) {
            require(
                IERC20(CUSD_ADDRESS).transfer(msg.sender, cusdAmount),
                "CUSD refund failed"
            );
        }

        emit BountyRefunded(petId, msg.sender, ethAmount, cusdAmount);
    }

    // Helper function to check CUSD balance in contract
    function getEscrowedCUSDBalance(
        uint256 petId
    ) external view returns (uint256) {
        return escrowedCUSD[petId];
    }

    // Helper function to check contract's CUSD balance
    function getContractCUSDBalance() external view returns (uint256) {
        return IERC20(CUSD_ADDRESS).balanceOf(address(this));
    }

    // Returns both the IDs and full Pet data of all lost pets
    function getAllLostPets()
        public
        view
        returns (uint256[] memory, Pet[] memory)
    {
        uint256 count = 0;

        // First count how many pets are lost
        for (uint256 i = 0; i < nextPetId; i++) {
            if (!pets[i].isFound) {
                count++;
            }
        }

        // Initialize arrays
        uint256[] memory petIds = new uint256[](count);
        Pet[] memory lostPets = new Pet[](count);
        uint256 index = 0;

        // Populate arrays
        for (uint256 i = 0; i < nextPetId; i++) {
            if (!pets[i].isFound) {
                petIds[index] = i; // The pet ID (key in mapping)
                lostPets[index] = pets[i];
                index++;
            }
        }

        return (petIds, lostPets);
    }

    function getLostPetsCount() external view returns (uint256) {
        uint256 counter = 0;
        for (uint256 i = 0; i < nextPetId; i++) {
            if (!pets[i].isFound) {
                counter++;
            }
        }
        return counter;
    }
}
