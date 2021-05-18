// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import {Gelatofied} from "./Gelatofied.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    EnumerableSet
} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {
    SafeERC20,
    IERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract TokenDistributor is Ownable, Gelatofied {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet internal distributorEnabledTokens;
    // token => DistributorSpecs
    mapping(address => DistributorSpecs) public tokenDistributorSpecs;

    constructor(address payable _gelato) payable Gelatofied(_gelato) {}

    event LogDistributed(address indexed distributor, address owner);

    struct DistributorSpecs {
        uint256 balanceThreshold;
        address[] receivers;
        uint256[] allocation;
    }

    function setDistributorSpecs(
        address[] calldata _tokenAddresses,
        uint256[] calldata _balanceThreshold,
        address[] calldata _receivers,
        uint256[] calldata _allocation
    ) external onlyOwner checkAllocation(_allocation) {
        for (uint256 x; x < _tokenAddresses.length; x++) {
            address _tokenAddress = _tokenAddresses[x];
            tokenDistributorSpecs[_tokenAddress] = DistributorSpecs({
                balanceThreshold: _balanceThreshold[x],
                receivers: _receivers,
                allocation: _allocation
            });
            if (!distributorEnabledTokens.contains(_tokenAddress))
                distributorEnabledTokens.add(_tokenAddress);
        }
    }

    function getDistributorSpecs(address _tokenAddress)
        public
        view
        returns (
            uint256 _balanceThreshold,
            address[] memory _receivers,
            uint256[] memory _allocation
        )
    {
        DistributorSpecs memory _distributorSpecs =
            tokenDistributorSpecs[_tokenAddress];
        _balanceThreshold = _distributorSpecs.balanceThreshold;
        _receivers = _distributorSpecs.receivers;
        _allocation = _distributorSpecs.allocation;
    }

    function distribute(address _tokenAddress, uint256 _fee)
        internal
        gelatofy(_fee, _tokenAddress)
    {
        require(
            hasThresholdReached(_tokenAddress),
            "TokenDistributor: distribute: Insufficient balance"
        );
        DistributorSpecs memory _distributorSpecs =
            tokenDistributorSpecs[_tokenAddress];

        address[] memory _receivers = _distributorSpecs.receivers;
        uint256[] memory _amtToSend =
            getAmtToSend(
                _fee,
                _distributorSpecs.balanceThreshold,
                _distributorSpecs.allocation
            );

        transferToAddresses(_receivers, _tokenAddress, _amtToSend);

        // for (uint256 x; x < _receivers.length; x++) {
        //     if (_tokenAddress == ETH) {
        //         (bool success, ) = _receivers[x].call{value: _amtToSend[x]}("");
        //         require(
        //             success,
        //             "TokenDistributor: distribute: Fail to distribute"
        //         );
        //     } else {
        //         SafeERC20.safeTransfer(
        //             IERC20(_tokenAddress),
        //             _receivers[x],
        //             _amtToSend[x]
        //         );
        //     }
        // }
    }

    function transferToAddresses(
        address[] memory _receivers,
        address _tokenAddress,
        uint256[] memory _amtToSend
    ) internal {
        for (uint256 x; x < _receivers.length; x++) {
            if (_tokenAddress == ETH) {
                (bool success, ) = _receivers[x].call{value: _amtToSend[x]}("");
                require(
                    success,
                    "TokenDistributor: distribute: Fail to distribute"
                );
            } else {
                SafeERC20.safeTransfer(
                    IERC20(_tokenAddress),
                    _receivers[x],
                    _amtToSend[x]
                );
            }
        }
    }

    // function exec(uint256 _fee) external {
    //     for (uint256 x; x < distributorEnabledTokens.length(); x++) {
    //         address _tokenAddress = distributorEnabledTokens.at(x);
    //         if (hasThresholdReached(_tokenAddress)) {
    //             distribute(_tokenAddress, _fee);
    //         }
    //     }
    // }

    function exec(address _tokenAddress, uint256 _fee) external {
        require(
            distributorEnabledTokens.contains(_tokenAddress),
            "TokenDistributor: exec: Distributor not enabled"
        );
        require(
            hasThresholdReached(_tokenAddress),
            "TokenDistributor: exec: Threshold not reached"
        );

        distribute(_tokenAddress, _fee);
    }

    function getAmtToSend(
        uint256 _fee,
        uint256 _balance,
        uint256[] memory _allocation
    ) internal pure returns (uint256[] memory _amtToSend) {
        _amtToSend = new uint256[](_allocation.length);
        _balance = _balance.sub(_fee);
        for (uint256 x; x < _allocation.length; x++) {
            _amtToSend[x] = _balance.mul(_allocation[x]).div(100);
        }
    }

    function hasThresholdReached(address _tokenAddress)
        internal
        view
        returns (bool)
    {
        uint256 _tokenBalance = getBalance(_tokenAddress);

        return (_tokenBalance >=
            tokenDistributorSpecs[_tokenAddress].balanceThreshold);
    }

    function getBalance(address _tokenAddress)
        public
        view
        returns (uint256 _tokenBalance)
    {
        if (_tokenAddress == ETH) {
            _tokenBalance = address(this).balance;
        } else {
            IERC20 token = IERC20(_tokenAddress);
            _tokenBalance = token.balanceOf(address(this));
        }
    }

    receive() external payable {}

    function withdraw(address _tokenAddress) external onlyOwner {
        uint256[] memory _amtToSend = new uint256[](1);
        _amtToSend[0] = getBalance(_tokenAddress);

        address[] memory _receivers = new address[](1);
        _receivers[0] = msg.sender;

        transferToAddresses(_receivers, _tokenAddress, _amtToSend);
    }

    function getDistributors()
        external
        view
        returns (address[] memory _distributors)
    {
        uint256 length = distributorEnabledTokens.length();
        _distributors = new address[](length);
        for (uint256 x; x < length; x++) {
            _distributors[x] = distributorEnabledTokens.at(x);
        }
    }

    modifier checkAllocation(uint256[] memory _allocation) {
        uint256 totalPercent;
        for (uint256 x; x < _allocation.length; x++) {
            totalPercent = totalPercent.add(_allocation[x]);
        }
        require(
            totalPercent == 100,
            "TokenDistributor: checkAllocation: Invalid Allocation"
        );
        _;
    }
}