require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Enable IR-based compilation to fix "Stack Too Deep"
    },
  },
  networks: {
    celo_alfajores: {
      url: `https://alfajores-forno.celo-testnet.org`,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 44787,
    },
    celo_mainnet: {
      url: `https://forno.celo.org`,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 42220,
    },
  },
};
