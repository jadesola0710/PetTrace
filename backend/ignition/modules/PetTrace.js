// scripts/deploy.js
const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("PetTraceModule", (m) => {
  const petTrace = m.contract("PetTrace");
  return { petTrace };
});
