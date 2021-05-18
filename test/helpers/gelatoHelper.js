const { ethers, network } = require("hardhat");

module.exports.getGasPrice = async () => {
  const oracleAbi = ["function latestAnswer() view returns (int256)"];

  // Get gelatoGasPriceOracleAddress
  const gelatoGasPriceOracle = await ethers.getContractAt(
    oracleAbi,
    network.config.GelatoGasPriceOracle
  );

  return await gelatoGasPriceOracle.latestAnswer();
};