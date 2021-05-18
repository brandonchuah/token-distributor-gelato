require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");

require('dotenv').config();

const ALCHEMY_ID = process.env.ALCHEMY_ID;
const privatekey = process.env.PRIVATE_KEY;

const addresses_mainnet = {
  ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  LINK: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  Gelato: "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6",
  GelatoGasPriceOracle: "0x169E633A2D1E6c10dD91238Ba11c4A708dfEF37C",
  deployer: "0x2F4dAcdD6613Dd2d41Ea0C578d7E666bbDAf3424",
}

const link_abi = require("./test/abi/link.json")
const dai_abi = require("./test/abi/dai.json")

const abi = {
  LINK: link_abi,
  DAI: dai_abi
}

module.exports = {
  solidity: "0.8.3",
  networks: {
    hardhat: {
      // Standard config
      // timeout: 150000,
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_ID}`,
        blockNumber: 12450260,
      },
      ...addresses_mainnet,
      abi
    }
  }
}

