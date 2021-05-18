
const hre = require("hardhat");

async function main() {

  const _TokenDistributorFactory = await hre.ethers.getContractFactory("TokenDistributorFactory");
  const TokenDistributorFactory = await _TokenDistributorFactory.deploy(hre.network.config.Gelato);

  await TokenDistributorFactory.deployed();

  console.log("TokenDistributorFactory deployed to:", TokenDistributorFactory.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
