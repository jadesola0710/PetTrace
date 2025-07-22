// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC20 Interface
 * @dev Standard ERC20 interface with required functions for token interactions
 */
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

/**
 * @title IERC677 Interface
 * @dev Interface for ERC677 token transfer with callback
 */
interface IERC677 is IERC20 {
    function transferAndCall(
        address to,
        uint value,
        bytes calldata data
    ) external returns (bool);
}

/**
 * @title PetTrace
 * @dev A decentralized application for tracking lost pets and managing bounties on Celo network
 * @notice Allows owners to post lost pets with bounties (CELO/cUSD) and finders to claim rewards
 */
contract PetTrace {
    // Security state variables
    bool private _locked;
    address public admin;

    // Constants
    address public constant CUSD_ADDRESS =
        0x765DE816845861e75A25fCA122bb6898B8B1282a;

    address public constant GD_ADDRESS =
        0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A;
    address public constant UBI_POOL =
        0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1;

    uint256 public constant MAX_CELO_BOUNTY = 10 ether;
    uint256 public constant MAX_CUSD_BOUNTY = 10000 * 1e18;
    uint256 public constant MAX_GD_BOUNTY = 100000 * 1e18;
    uint256 public constant BOUNTY_TIMEOUT = 90 days;

    // Pet data storage
    uint256 public nextPetId;
    mapping(uint256 => Pet) public pets;
    mapping(uint256 => uint256) public escrowedCUSD;
    mapping(uint256 => uint256) public escrowedGD;

    mapping(uint256 => uint256) public postTime;

    struct Pet {
        uint256 id;
        address payable owner;
        string name;
        string breed;
        string gender;
        uint128 sizeCm;
        uint128 ageMonths;
        string dateTimeLost;
        string description;
        string imageUrl;
        string lastSeenLocation;
        string contactName;
        string contactPhone;
        string contactEmail;
        uint128 celoBounty;
        uint128 cUSDBounty;
        uint128 gdBounty;
        bool isFound;
        bool ownerConfirmed;
        bool finderConfirmed;
        address finder;
    }

    // Modifiers
    modifier nonReentrant() {
        require(!_locked, "ReentrancyGuard: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    modifier onlyPetOwner(uint256 petId) {
        require(msg.sender == pets[petId].owner, "Not pet owner");
        _;
    }

    modifier petExists(uint256 petId) {
        require(petId < nextPetId, "Pet does not exist");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    // Events
    event PetPosted(uint256 indexed petId, address indexed owner);
    event PetFound(uint256 indexed petId, address indexed finder);
    event BountyClaimed(
        uint256 indexed petId,
        address indexed finder,
        uint256 celoAmount,
        uint256 cUSDAmount,
        uint256 gdAmount
    );
    event ConfirmationAdded(
        uint256 indexed petId,
        address indexed confirmer,
        bool isOwner
    );
    event BountyRefunded(
        uint256 indexed petId,
        address indexed owner,
        uint256 celoAmount,
        uint256 cUSDAmount,
        uint256 gdAmount
    );
    event AdminChanged(address indexed newAdmin);

    constructor() {
        admin = msg.sender;
    }

    // ==================== CORE FUNCTIONS ====================

    /**
     * @notice Post a lost pet with optional bounty
     * @dev Creates new pet record and escrows bounty
     */
    function postLostPet(
        string calldata name,
        string calldata breed,
        string calldata gender,
        uint128 sizeCm,
        uint128 ageMonths,
        string calldata dateTimeLost,
        string calldata description,
        string calldata imageUrl,
        string calldata lastSeenLocation,
        string calldata contactName,
        string calldata contactPhone,
        string calldata contactEmail,
        uint128 cUSDBounty,
        uint128 gdBounty
    ) external payable nonReentrant {
        // Input validation
        require(msg.value <= MAX_CELO_BOUNTY, "CELO bounty too large");
        require(cUSDBounty <= MAX_CUSD_BOUNTY, "cUSD bounty too large");
        require(msg.value > 0 || cUSDBounty > 0, "Bounty required");
        require(gdBounty <= MAX_GD_BOUNTY, "G$ bounty too large");
        require(
            msg.value > 0 || cUSDBounty > 0 || gdBounty > 0,
            "Bounty required"
        );

        _validateString(name, 2, 50, "Name");
        _validateString(breed, 2, 50, "Breed");
        _validateString(gender, 1, 10, "Gender");
        _validateString(description, 10, 500, "Description");
        _validateString(imageUrl, 10, 200, "Image URL");
        _validateString(lastSeenLocation, 5, 200, "Location");
        _validateString(contactName, 2, 100, "Contact name");
        _validateString(contactPhone, 5, 20, "Contact phone");

        require(sizeCm >= 10 && sizeCm <= 200, "Invalid size");
        require(ageMonths >= 1 && ageMonths <= 240, "Invalid age");
        require(_isValidEmail(contactEmail), "Invalid email");

        // Handle cUSD transfer
        if (cUSDBounty > 0) {
            require(
                IERC20(CUSD_ADDRESS).transferFrom(
                    msg.sender,
                    address(this),
                    cUSDBounty
                ),
                "cUSD transfer failed"
            );
            escrowedCUSD[nextPetId] = cUSDBounty;
        }

        // Handle G$ transfer with UBI pool contribution
        if (gdBounty > 0) {
            uint256 ubiContribution = gdBounty / 100; // 1% to UBI pool
            uint256 netGdBounty = gdBounty - ubiContribution;

            // Encode pet data for transferAndCall
            bytes memory petData = abi.encode(
                name,
                breed,
                gender,
                sizeCm,
                ageMonths,
                dateTimeLost,
                description,
                imageUrl,
                lastSeenLocation,
                contactName,
                contactPhone,
                contactEmail,
                ubiContribution
            );

            // Single transaction: Transfer G$ + register pet
            require(
                IERC677(GD_ADDRESS).transferAndCall(
                    address(this),
                    netGdBounty,
                    petData
                ),
                "G$ transfer failed"
            );

            escrowedGD[nextPetId] = netGdBounty;
        }
        // Create pet record
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
            celoBounty: uint128(msg.value),
            cUSDBounty: cUSDBounty,
            gdBounty: gdBounty,
            isFound: false,
            ownerConfirmed: false,
            finderConfirmed: false,
            finder: address(0)
        });

        postTime[nextPetId] = block.timestamp;
        emit PetPosted(nextPetId, msg.sender);
        nextPetId++;
    }

    /**
     * @notice Mark pet as found
     * @dev Can be called by anyone except owner
     */
    function markAsFound(uint256 petId) external petExists(petId) nonReentrant {
        Pet storage pet = pets[petId];
        require(!pet.isFound, "Already found");
        require(msg.sender != pet.owner, "Owner cannot be finder");

        pet.finder = msg.sender;
        pet.finderConfirmed = true;

        if (pet.ownerConfirmed) {
            pet.isFound = true;
            emit PetFound(petId, msg.sender);
        }

        emit ConfirmationAdded(petId, msg.sender, false);
    }

    /**
     * @notice Confirm found pet by owner
     * @dev Completes finding process if finder also confirmed
     */
    function confirmFoundByOwner(
        uint256 petId
    ) external onlyPetOwner(petId) nonReentrant {
        Pet storage pet = pets[petId];
        require(!pet.isFound, "Already found");
        require(pet.finder != address(0), "No finder assigned");

        pet.ownerConfirmed = true;

        if (pet.finderConfirmed) {
            pet.isFound = true;
            emit PetFound(petId, pet.finder);
        }

        emit ConfirmationAdded(petId, msg.sender, true);
    }

    /**
     * @notice Claim bounty for found pet
     * @dev Can only be called by finder after confirmation
     */
    function claimBounty(uint256 petId) external petExists(petId) nonReentrant {
        Pet storage pet = pets[petId];
        require(pet.isFound, "Pet not found");
        require(msg.sender == pet.finder, "Not finder");
        require(
            pet.celoBounty > 0 || pet.cUSDBounty > 0 || pet.gdBounty > 0,
            "No bounty"
        );

        uint256 celoAmount = pet.celoBounty;
        uint256 cUSDAmount = pet.cUSDBounty;
        uint256 gdAmount = pet.gdBounty;

        // Reset state before transfers
        pet.celoBounty = 0;
        pet.cUSDBounty = 0;
        escrowedCUSD[petId] = 0;
        escrowedGD[petId] = 0;

        // Transfer funds
        if (celoAmount > 0) {
            payable(msg.sender).transfer(celoAmount);
        }
        if (cUSDAmount > 0) {
            require(
                IERC20(CUSD_ADDRESS).transfer(msg.sender, cUSDAmount),
                "cUSD transfer failed"
            );
        }

        if (gdAmount > 0) {
            require(
                IERC20(GD_ADDRESS).transfer(msg.sender, gdAmount),
                "G$ transfer failed"
            );
        }

        emit BountyClaimed(petId, msg.sender, celoAmount, cUSDAmount, gdAmount);
    }

    /**
     * @notice Cancel lost pet report and refund bounties
     * @dev Can only be called by owner before finder assigned
     */
    function cancelAndRefund(
        uint256 petId
    ) external onlyPetOwner(petId) nonReentrant {
        Pet storage pet = pets[petId];
        require(!pet.isFound, "Pet already found");
        require(pet.finder == address(0), "Finder already assigned");

        uint256 celoAmount = pet.celoBounty;
        uint256 cUSDAmount = pet.cUSDBounty;
        uint256 gdAmount = pet.gdBounty;

        // Reset state
        pet.celoBounty = 0;
        pet.cUSDBounty = 0;
        pet.gdBounty = 0;

        escrowedCUSD[petId] = 0;
        escrowedGD[petId] = 0;

        // Refund funds
        if (celoAmount > 0) {
            payable(msg.sender).transfer(celoAmount);
        }
        if (cUSDAmount > 0) {
            require(
                IERC20(CUSD_ADDRESS).transfer(msg.sender, cUSDAmount),
                "cUSD refund failed"
            );
        }

        if (gdAmount > 0) {
            require(
                IERC20(GD_ADDRESS).transfer(msg.sender, gdAmount),
                "G$ refund failed"
            );
        }

        emit BountyRefunded(
            petId,
            msg.sender,
            celoAmount,
            cUSDAmount,
            gdAmount
        );
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @notice Transfer admin rights
     * @param newAdmin Address of new admin
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid address");
        admin = newAdmin;
        emit AdminChanged(newAdmin);
    }

    /**
     * @notice Emergency withdraw cUSD (admin only)
     * @param to Address to send funds to
     */
    function emergencyWithdrawCUSD(address to) external onlyAdmin {
        uint256 balance = IERC20(CUSD_ADDRESS).balanceOf(address(this));
        require(IERC20(CUSD_ADDRESS).transfer(to, balance), "Transfer failed");
    }

    /**
     * @notice Emergency withdraw G$ (admin only)
     * @param to Address to send funds to
     */
    function emergencyWithdrawGD(address to) external onlyAdmin {
        uint256 balance = IERC20(GD_ADDRESS).balanceOf(address(this));
        require(IERC20(GD_ADDRESS).transfer(to, balance), "Transfer failed");
    }

    /**
     * @dev ERC-677 token transfer callback for G$ token
     * @param from Sender address
     * @param value Amount transferred
     * @param data Additional data (contains pet ID)
     */
    function onTokenTransfer1(
        address from,
        uint256 value,
        bytes calldata data
    ) external returns (bool) {
        require(msg.sender == GD_ADDRESS, "Only G$ token");

        // Extract pet ID from data (first 32 bytes)
        uint256 petId = abi.decode(data[:32], (uint256));
        Pet storage pet = pets[petId];

        require(pet.owner == from, "Not pet owner");
        require(!pet.isFound, "Pet already found");
        require(pet.finder == address(0), "Finder already assigned");

        uint256 ubiContribution = value / 100; // 1% for UBI pool
        uint256 netAmount = value - ubiContribution;

        // Update bounty amounts
        pet.gdBounty += uint128(netAmount);
        escrowedGD[petId] += netAmount;

        return true;
    }

    /**
     * @dev ERC-677 callback for G$ token transfers
     * @param from Sender address (pet owner)
     * @param value Amount of G$ sent
     * @param data Encoded pet details (same as postLostPet params)
     */
    function onTokenTransfer(
        address from,
        uint256 value,
        bytes calldata data
    ) external returns (bool) {
        // Ensure only G$ token can call this
        require(msg.sender == GD_ADDRESS, "Only G$ token");

        // Decode pet data from `transferAndCall`
        (
            string memory name,
            string memory breed,
            string memory gender,
            uint128 sizeCm,
            uint128 ageMonths,
            string memory dateTimeLost,
            string memory description,
            string memory imageUrl,
            string memory lastSeenLocation,
            string memory contactName,
            string memory contactPhone,
            string memory contactEmail,
            uint256 ubiContribution
        ) = abi.decode(
                data,
                (
                    string,
                    string,
                    string,
                    uint128,
                    uint128,
                    string,
                    string,
                    string,
                    string,
                    string,
                    string,
                    string,
                    uint256
                )
            );

        // Validate UBI contribution (1%)
        require(ubiContribution == value / 100, "Invalid UBI contribution");

        // Create pet record (same logic as postLostPet)
        pets[nextPetId] = Pet({
            id: nextPetId,
            owner: payable(from),
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
            celoBounty: 0,
            cUSDBounty: 0,
            gdBounty: uint128(value - ubiContribution), // Net bounty after UBI
            isFound: false,
            ownerConfirmed: false,
            finderConfirmed: false,
            finder: address(0)
        });

        emit PetPosted(nextPetId, from);
        nextPetId++;

        return true; // Acknowledge successful transfer
    }
    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get paginated list of lost pet IDs
     * @param startIndex Starting index (0-based)
     * @param maxCount Maximum number of IDs to return
     * @return ids Array of pet IDs
     * @return hasMore Whether more results exist
     */
    function getLostPetIds(
        uint256 startIndex,
        uint256 maxCount
    ) public view returns (uint256[] memory ids, bool hasMore) {
        uint256 totalLost = 0;
        uint256 endIndex = startIndex + maxCount;
        if (endIndex > nextPetId) endIndex = nextPetId;

        // Count lost pets in range
        for (uint256 i = startIndex; i < endIndex; i++) {
            if (!pets[i].isFound) totalLost++;
        }

        // Initialize and populate array
        ids = new uint256[](totalLost);
        uint256 currentIndex = 0;

        for (uint256 i = startIndex; i < endIndex; i++) {
            if (!pets[i].isFound) {
                ids[currentIndex] = i;
                currentIndex++;
            }
        }

        hasMore = endIndex < nextPetId;
        return (ids, hasMore);
    }

    /**
     * @notice Get full pet details
     * @param petId ID of pet to retrieve
     * @return All pet details in a tuple
     */
    function getPetDetails(
        uint256 petId
    )
        public
        view
        petExists(petId)
        returns (
            uint256,
            address,
            string memory,
            string memory,
            string memory,
            uint128,
            uint128,
            string memory,
            string memory,
            string memory,
            string memory,
            string memory,
            string memory,
            string memory,
            uint128,
            uint128,
            uint128,
            bool,
            bool,
            bool,
            address
        )
    {
        Pet storage pet = pets[petId];
        return (
            pet.id,
            pet.owner,
            pet.name,
            pet.breed,
            pet.gender,
            pet.sizeCm,
            pet.ageMonths,
            pet.dateTimeLost,
            pet.description,
            pet.imageUrl,
            pet.lastSeenLocation,
            pet.contactName,
            pet.contactPhone,
            pet.contactEmail,
            pet.celoBounty,
            pet.cUSDBounty,
            pet.gdBounty,
            pet.isFound,
            pet.ownerConfirmed,
            pet.finderConfirmed,
            pet.finder
        );
    }

    /**
     * @notice Get all lost pets (caution: may hit gas limits)
     * @return Two arrays: pet IDs and Pet structs
     */
    function getAllLostPets()
        public
        view
        returns (uint256[] memory, Pet[] memory)
    {
        uint256 count = 0;

        // Count lost pets
        for (uint256 i = 0; i < nextPetId; i++) {
            if (!pets[i].isFound) count++;
        }

        // Initialize arrays
        uint256[] memory ids = new uint256[](count);
        Pet[] memory lostPets = new Pet[](count);
        uint256 index = 0;

        // Populate arrays
        for (uint256 i = 0; i < nextPetId; i++) {
            if (!pets[i].isFound) {
                ids[index] = i;
                lostPets[index] = pets[i];
                index++;
            }
        }

        return (ids, lostPets);
    }

    /**
     * @notice Get count of lost pets
     * @return Number of pets not found
     */
    function getLostPetsCount() public view returns (uint256) {
        uint256 counter = 0;
        for (uint256 i = 0; i < nextPetId; i++) {
            if (!pets[i].isFound) counter++;
        }
        return counter;
    }

    // ==================== INTERNAL HELPERS ====================

    function _validateString(
        string calldata str,
        uint min,
        uint max,
        string memory field
    ) internal pure {
        bytes memory b = bytes(str);
        require(
            b.length >= min && b.length <= max,
            string(abi.encodePacked(field, " length invalid"))
        );
        require(
            !_isBlank(b),
            string(abi.encodePacked(field, " cannot be blank"))
        );
    }

    function _isBlank(bytes memory b) internal pure returns (bool) {
        for (uint i = 0; i < b.length; i++) {
            if (b[i] != " ") return false;
        }
        return true;
    }

    function _isValidEmail(string memory email) internal pure returns (bool) {
        bytes memory b = bytes(email);
        if (b.length < 5) return false;

        bool hasAt = false;
        bool hasDotAfterAt = false;
        for (uint i = 0; i < b.length; i++) {
            if (b[i] == "@") {
                if (hasAt) return false;
                hasAt = true;
            } else if (hasAt && b[i] == ".") {
                hasDotAfterAt = true;
            }
        }
        return hasAt && hasDotAfterAt;
    }
}
