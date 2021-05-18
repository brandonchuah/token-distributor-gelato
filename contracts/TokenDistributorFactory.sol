// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import {TokenDistributor} from "./TokenDistributor.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    EnumerableSet
} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract TokenDistributorFactory is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet internal tokenDistributors;

    mapping(address => address) public distributorByOwner;
    mapping(address => address) public ownerByDistributor;

    event LogContractDeployed(address indexed distributor, address owner);

    address payable public immutable gelato;

    constructor(address payable _gelato) {
        gelato = _gelato;
    }

    function createTokenDistributor(
        address[] calldata _tokenAddress,
        uint256[] calldata _balanceThreshold,
        address[] calldata _receivers,
        uint256[] calldata _allocation
    ) external {
        TokenDistributor tokenDistributor = new TokenDistributor(gelato);
        tokenDistributor.setDistributorSpecs(
            _tokenAddress,
            _balanceThreshold,
            _receivers,
            _allocation
        );

        tokenDistributor.transferOwnership(msg.sender);

        distributorByOwner[msg.sender] = address(tokenDistributor);
        ownerByDistributor[address(tokenDistributor)] = msg.sender;
        tokenDistributors.add(address(tokenDistributor));

        emit LogContractDeployed(address(tokenDistributor), msg.sender);
    }

    function getTokenDistributors()
        external
        view
        returns (address[] memory _tokenDistributors)
    {
        uint256 length = tokenDistributors.length();
        _tokenDistributors = new address[](length);
        for (uint256 i; i < length; i++)
            _tokenDistributors[i] = tokenDistributors.at(i);
    }
}
