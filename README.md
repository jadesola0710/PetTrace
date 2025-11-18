# **PetTrace**

**PetTrace** is a **decentralized pet recovery platform** built on the **Celo blockchain**, enabling users to post missing pet alerts, attach bounties, and reward those who help reunite pets with their families.

---

### 🔗 [Live Demo](https://pet-trace-jadesola0710s-projects.vercel.app/)

### 💻 [GitHub Repository](https://github.com/jadesola0710/PetTrace)

---

## **Features**

- 🐾 **Lost Pet Posting** – Users can register lost pets with images, descriptions, and last known locations.
- 🎯 **Bounty System** – Attach a bounty in CELO, cUSD or G$ to encourage community help.
- ✅ **Recovery Confirmation** – Mark pets as found and release bounties securely via smart contracts.
- 🔐 **Owner Contact Info** – Easily contact pet owners with name, phone, and email details.
- 🌍 **Celo Integration** – Built on Celo mainnet for low-cost and fast transactions.
- 🔒 **Identity Verification** – Integrated with Self for secure identity verification before posting.
- ✅ **MiniPay Integration** - Users can connect their MiniPay wallet within the PetTrace app.
- 📱 **QR Code Verification** – Users can verify their identity by scanning a QR code with the Self app.

---

## **Project Structure**

```
PetTrace/
│── backend/          # Solidity smart contracts (Hardhat)
│── pettrace/ # Next.js frontend
│── README.md         # Project documentation
```

---

## **Installation & Setup**

### 1️⃣ Clone the Repository

```sh
git clone https://github.com/jadesola0710/PetTrace.git
cd pettrace
```

### 2️⃣ Install Dependencies

#### Backend

```sh
cd backend
pnpm install  # or yarn / npm
```

#### Frontend

```sh
cd pettrace-frontend
pnpm install
```

---

## **Environment Variables**

Create a `.env` file in both `backend/` and `pettrace-frontend/`.

### Backend (`backend/.env`)

```env
PRIVATE_KEY=your_private_key
```

### Frontend (`pettrace/.env`)

```env
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID= YOUR_NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID
NEXT_PUBLIC_APP_NAME= YOUR_NEXT_PUBLIC_APP_NAME

NEXT_PUBLIC_SELF_ENDPOINT= YOUR_NEXT_PUBLIC_SELF_ENDPOINT
# NEXT_PUBLIC_SELF_ENDPOINT= # has to be a public endpoint, not localhost (you can use ngrok to get a public endpoint for local development)
# Example: NEXT_PUBLIC_SELF_ENDPOINT=https://123.ngrok-free.app/api/verify

NEXT_PUBLIC_SELF_ENABLE_MOCK_PASSPORT= "true / false"
NEXT_PUBLIC_SELF_APP_NAME="YOUR_NEXT_PUBLIC_SELF_APP_NAME"
NEXT_PUBLIC_SELF_SCOPE="YOUR_NEXT_PUBLIC_SELF_SCOPE"
NEXT_PUBLIC_GOOGLE_MAPS_KEY = YOUR_NEXT_PUBLIC_GOOGLE_MAPS_KEY
```

---

## **Running the Project**

### 🔧 Compile the Smart Contract

```sh
cd backend
yarn hardhat compile
```

### 🚀 Deploy the Smart Contract

```sh
npx hardhat ignition deploy ./ignition/modules/PetTrace.js --network celo_mainnet
```

### 🖥️ Start the Frontend

```sh
cd pettrace
pnpm run dev
```

---

## **Smart Contract Deployment**

Deployed to **Celo mainnet**:

| Contract | Address (Mainnet)                            |
| -------- | -------------------------------------------- |
| PetTrace | `0xC7F94703677f5B3fBa1BcF81B1560364849Ce103` |

---

## **How It Works**

1. Connect your wallet.
2. Post a missing pet with details (image, name, breed, last seen, etc).
3. Attach a bounty in CELO to incentivize help.
4. Once found, mark the pet as recovered.
5. The finder claims the bounty securely via smart contract.

---

## **Tech Stack**

- **Frontend:** Next.js + React + TypeScript
- **Smart Contracts:** Solidity (Hardhat + Ignition)
- **Blockchain:** Celo mainnet
- **Wallets:** MetaMask, Celo Extension Wallet, RainbowKit
- **Storage:** Temporary URL-based images (no IPFS yet)

---

## **Future Enhancements**

- Support for IPFS or decentralized media storage
- Geolocation tagging for pets
- Pet recovery history dashboard
- Mobile-responsive design
- Reputation scoring for pet finders

---

## **Contributing**

Pull requests are welcome!

1. Fork the repository
2. Create a branch (`feature/your-feature`)
3. Commit and push your changes
4. Open a pull request

---

## **License**

This project is open-sourced under the **MIT License**.

This update:

1. Adds a dedicated "Self Integration" section explaining the verification flow
2. Includes code snippets showing key implementation details
3. Adds the required environment variables for Self
4. Updates the "How It Works" section to include identity verification
5. Adds Self to the Tech Stack section
6. Maintains all the existing project information while adding the new details
7. Users can connect their MiniPay wallet within the PetTrace app.

The integration is presented as a security feature that helps prevent spam and ensure accountability in the system.
