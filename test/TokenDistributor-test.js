const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { getGasPrice } = require("./helpers/gelatoHelper");

describe("TokenDistributorFactory", function() {
  var tokenDistributor, tokenDistributorAddress;
  var tokenDistributorFactory;
  var linkContract;
  var daiContract;
  var gelatoContract;
  
  const linkAddress = network.config.LINK;
  const daiAddress = network.config.DAI;
  const ethAddress = network.config.ETH;
  const gelatoAddress = network.config.Gelato;
  var deployer, user, receiver1, receiver2, executor;
  var deployer, userAddress, receiver1Address, receiver2Address, executorAddress;
  var gasPrice;
  var linkFee, ethFee;
  var expected_link_distributorSpecs, expected_eth_distributorSpecs;

    this.timeout(0);

    before(async function(){
      [deployer, receiver1, receiver2] = await ethers.getSigners();
      deployerAddress = await deployer.getAddress();
      receiver1Address = await receiver1.getAddress();
      receiver2Address = await receiver2.getAddress();

      gasPrice = await getGasPrice();

      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0xF977814e90dA44bFA03b6295A0616a897441aceC"]}
      )
      user = await ethers.provider.getSigner("0xF977814e90dA44bFA03b6295A0616a897441aceC");
      userAddress = await user.getAddress();
      
      linkContract = await ethers.getContractAt(
        network.config.abi.LINK,
        linkAddress
      )

      daiContract = await ethers.getContractAt(
        network.config.abi.DAI,
        daiAddress
      )

      gelatoContract = await ethers.getContractAt(
        "IGelato",
        gelatoAddress
      )

      const _tokenDistributorFactory = await ethers.getContractFactory("TokenDistributorFactory");
      tokenDistributorFactory = await _tokenDistributorFactory.deploy(gelatoAddress);
    })

    it("Create a new distributor with factory", async function(){
      tokenDistributorFactory = tokenDistributorFactory.connect(user);

      var txn = await tokenDistributorFactory.createTokenDistributor(
        linkAddress,
        ethers.utils.parseEther("4"),
        [receiver1Address, receiver2Address],
        [4550, 5450]
      )
      await txn.wait();

      const block = await ethers.provider.getBlock();
      const topics = tokenDistributorFactory.filters.LogContractDeployed().topics;
      const filter = {
        address: tokenDistributorFactory.address.toLowerCase(),
        blockhash: block.hash,
        topics,
      };
      const logs = await ethers.provider.getLogs(filter);
      if (logs.length !== 1) {
        throw Error("cannot find tokenDistributor");
      }
      const event = tokenDistributorFactory.interface.parseLog(logs[0]);
      
      tokenDistributorAddress = event.args.distributor;
      tokenDistributor = await ethers.getContractAt("TokenDistributor", tokenDistributorAddress);
    })

    it("Set distributor specs", async function(){
      tokenDistributor = tokenDistributor.connect(user);

      var txn = await tokenDistributor.setDistributorSpecs(
        ethAddress,
        ethers.utils.parseEther("7"),
        [receiver1Address, receiver2Address],
        [4000, 6000]
      )
      await txn.wait();
    })

    it("Each user can only create one distributor", async function(){
      await expect(tokenDistributorFactory.createTokenDistributor(
        daiAddress,
        ethers.utils.parseEther("4"),
        [receiver1Address, receiver2Address],
        [4000, 6000]
      )).to.be.revertedWith("TokenDistributorFactory: createTokenDistributor: Already created TokenDistributor")
    })

    it("Transfer ownership to user", async function(){
      expect(await tokenDistributor.owner()).to.be.eql(userAddress);

      tokenDistributor = tokenDistributor.connect(deployer);

      await expect(
       tokenDistributor.setDistributorSpecs(
          linkAddress,
          ethers.utils.parseEther("1"),
          [receiver1Address],
          [10000]
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    })


    it("Check distributor specs are set correctly", async function(){
      tokenDistributor = tokenDistributor.connect(user);

      const link_distributorSpecs = await tokenDistributor.getDistributorSpecs(linkAddress);
      expected_link_distributorSpecs = [
        ethers.utils.parseEther("4"),
        [receiver1Address, receiver2Address],
        [ethers.BigNumber.from(4550), ethers.BigNumber.from(5450)]
      ]

      const eth_distributorSpecs = await tokenDistributor.getDistributorSpecs(ethAddress);
      expected_eth_distributorSpecs = [
        ethers.utils.parseEther("7"),
        [receiver1Address, receiver2Address],
        [ethers.BigNumber.from(4000), ethers.BigNumber.from(6000)]
      ]
      expect(link_distributorSpecs).to.be.eql(expected_link_distributorSpecs);
      expect(eth_distributorSpecs).to.be.eql(expected_eth_distributorSpecs);
    })

    it("Send LINK and ETH to TokenDistributor contract", async function(){
      linkContract = linkContract.connect(user);
      var txn = await linkContract.transfer(tokenDistributorAddress, ethers.utils.parseEther("5"));
      await txn.wait();
      expect(await linkContract.balanceOf(tokenDistributorAddress)).to.be.eql(ethers.utils.parseEther("5"))

      const sendTxn = await user.sendTransaction({
        value: ethers.utils.parseEther("8"),
        to: tokenDistributorAddress,
      });
      await sendTxn.wait()

      expect(await ethers.provider.getBalance(tokenDistributorAddress)).to.be.eql(ethers.utils.parseEther("8"));
    })

    it("Gelato should execute LINK distribution when threshold is met", async function(){
      const dummyPayload = tokenDistributor.interface.encodeFunctionData("exec", [linkAddress, ...expected_link_distributorSpecs, 1]);
      const executors = await gelatoContract.executors();
      executorAddress = executors[1];

      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [executorAddress],
      });
      
      executor = ethers.provider.getSigner(executorAddress);

      gelatoContract = gelatoContract.connect(executor);
      [,linkFee] = await gelatoContract.callStatic.estimateExecGasDebit(
        tokenDistributorAddress, 
        dummyPayload,
        linkAddress
      );

      const payload = tokenDistributor.interface.encodeFunctionData("exec", [linkAddress, ...expected_link_distributorSpecs, linkFee]);
        
      await expect(
        gelatoContract.exec(tokenDistributorAddress, payload, linkAddress)
      ).to.emit(gelatoContract, "LogExecSuccess");

      const expected_receiver1_link = (4 - ethers.utils.formatEther(linkFee)) * 45.5 / 100;
      const expected_receiver2_link = (4 - ethers.utils.formatEther(linkFee)) * 54.5 / 100;
      const receiver1_link = ethers.utils.formatEther(await linkContract.balanceOf(receiver1Address));
      const receiver2_link = ethers.utils.formatEther(await linkContract.balanceOf(receiver2Address));
     
      expect(parseFloat(receiver1_link).toFixed(10)).to.be.eql(parseFloat(expected_receiver1_link).toFixed(10))
      expect(parseFloat(receiver2_link).toFixed(10)).to.be.eql(parseFloat(expected_receiver2_link).toFixed(10))
  
    })

    it("Gelato should execute ETH distribution when threshold is met", async function(){
      const dummyPayload = tokenDistributor.interface.encodeFunctionData("exec", [ethAddress, ...expected_eth_distributorSpecs, 1]);

      [ethFee,] = await gelatoContract.callStatic.estimateExecGasDebit(
        tokenDistributorAddress, 
        dummyPayload,
        ethAddress
      );

      const receiver1_eth_before = await ethers.provider.getBalance(receiver1Address);
      const receiver2_eth_before = await ethers.provider.getBalance(receiver2Address);

      const payload = tokenDistributor.interface.encodeFunctionData("exec", [ethAddress, ...expected_eth_distributorSpecs, ethFee]);

      await expect(
        gelatoContract.exec(tokenDistributorAddress, payload, ethAddress)
      ).to.emit(gelatoContract, "LogExecSuccess");

      const receiver1_eth_after = await ethers.provider.getBalance(receiver1Address);
      const receiver2_eth_after = await ethers.provider.getBalance(receiver2Address);

      const distributed_receiver1 =  ethers.utils.formatEther((receiver1_eth_after - receiver1_eth_before).toString());
      const distributed_receiver2 =  ethers.utils.formatEther((receiver2_eth_after - receiver2_eth_before).toString());
      
      const expected_distributed_receiver1 = (7 - ethers.utils.formatEther(ethFee)) * 40 / 100;
      const expected_distributed_receiver2 = (7 - ethers.utils.formatEther(ethFee)) * 60 / 100;

      expect(parseFloat(distributed_receiver1).toFixed(10)).to.be.eql(parseFloat(expected_distributed_receiver1).toFixed(10))
      expect(parseFloat(distributed_receiver2).toFixed(10)).to.be.eql(parseFloat(expected_distributed_receiver2).toFixed(10))

    })

    it("Gelato should not execute when threshold is not met", async function(){
      const payload = tokenDistributor.interface.encodeFunctionData("exec", [linkAddress, ...expected_link_distributorSpecs, linkFee]);

      await expect(
        gelatoContract.exec(tokenDistributorAddress, payload, linkAddress)
      ).to.be.revertedWith("TokenDistributor: exec: Threshold not reached");
    })

    it("Only owner can withdraw LINK and ETH", async function(){
      tokenDistributor = tokenDistributor.connect(receiver1);
      await expect(
        tokenDistributor.withdraw(linkAddress)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(
        tokenDistributor.withdraw(ethAddress)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      tokenDistributor = tokenDistributor.connect(user);
      const link_inContract = ethers.utils.formatEther(await tokenDistributor.getBalance(linkAddress));
      const link_before = await linkContract.balanceOf(userAddress);

      var txn = await tokenDistributor.withdraw(linkAddress);
      await txn.wait();

      const link_after = await linkContract.balanceOf(userAddress);
      const link_received = ethers.utils.formatEther((link_after - link_before).toString());
      
      expect(parseInt(link_received)).to.be.eql(parseInt(link_inContract));
     
      const eth_inContract = ethers.utils.formatEther(await tokenDistributor.getBalance(ethAddress));
      const eth_before = await user.getBalance();

      var txn = await tokenDistributor.withdraw(ethAddress);
      await txn.wait();

      const eth_after = await user.getBalance();

      const eth_received = ethers.utils.formatEther((eth_after - eth_before).toString());

      expect(Math.round(eth_received)).to.be.eql(parseInt(eth_inContract));
    })

    it("Revert if allocation is not set properly", async function(){
      await expect(tokenDistributor.setDistributorSpecs(
        ethAddress,
        ethers.utils.parseEther("7"),
        [receiver1Address, receiver2Address],
        [4000, 5000]
      )).to.be.revertedWith("TokenDistributor: checkAllocation: Invalid Allocation");
    })

    it("TokenDistributor contracts and Distributors should be querieable off-chain", async () => {
      const tokenDistributors = await tokenDistributorFactory.getTokenDistributors();
      const distributors = await tokenDistributor.getDistributors();

      expect(distributors[0]).to.be.eql(linkAddress);
      expect(distributors[1]).to.be.eql(ethAddress);
      expect(tokenDistributors[0]).to.be.eql(tokenDistributorAddress);
    });  

 
  
});
