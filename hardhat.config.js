require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");

require('dotenv').config();

const ALCHEMY_MAINNET = process.env.ALCHEMY_MAINNET;
const ALCHEMY_ROPSTEN = process.env.ALCHEMY_ROPSTEN;
const privatekey = process.env.PRIVATE_KEY;

const addresses_mainnet = {
  ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  LINK: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  Gelato: "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6",
  GelatoGasPriceOracle: "0x169E633A2D1E6c10dD91238Ba11c4A708dfEF37C",
}

const addresses_ropsten = {
  ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  Gelato: "0xCc4CcD69D31F9FfDBD3BFfDe49c6aA886DaB98d9",
  GelatoGasPriceOracle: "0x20F44678Fc2344a78E84192e82Cede989Bf1da6F",
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
        url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_MAINNET}`,
        blockNumber: 12450260,
      },
      ...addresses_mainnet,
      abi
    },
    ropsten: {
      url: `https://eth-ropsten.alchemyapi.io/v2/${ALCHEMY_ROPSTEN}`,
      accounts: [privatekey],
      ...addresses_ropsten,
      abi
    }
  }
}

