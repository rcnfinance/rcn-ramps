pragma solidity ^0.4.19;

import "./../../vendors/kyber/KyberNetworkProxy.sol";

contract KyberProxyMock is KyberNetworkProxy {
    
    ERC20 public MANA;
    ERC20 public RCN;

    uint256 public expectedRate;
    uint256 public slippageRate;

    constructor (address _admin, ERC20 _MANA, ERC20 _RCN) KyberNetworkProxy(_admin) public {
        MANA = _MANA;
        RCN = _RCN;
    }

    function setExpectedRate(uint256 _expectedRate) public returns (bool) {
        expectedRate = _expectedRate;
        return true;
    }

    function setSlippageRate(uint256 _slippageRate) public returns (bool) {
        slippageRate = _slippageRate;
        return true;
    }

    /// @notice use token address ETH_TOKEN_ADDRESS for ether
    /// @dev makes a trade between src and dest token and send dest token to destAddress
    /// @param src Src token
    /// @param srcAmount amount of src tokens
    /// @param dest   Destination token
    /// @param destAddress Address to send tokens to
    /// @param maxDestAmount A limit on the amount of dest tokens
    /// @param minConversionRate The minimal conversion rate. If actual rate is lower, trade is canceled.
    /// @param walletId is the wallet ID to send part of the fees
    /// @return amount of actual dest tokens
    function trade(
        ERC20 src,
        uint srcAmount,
        ERC20 dest,
        address destAddress,
        uint maxDestAmount,
        uint minConversionRate,
        address walletId
    ) public payable returns(uint) {
        (uint256 rate, ) = getExpectedRate(src, dest, 0);
        require(src.transferFrom(msg.sender, this, srcAmount), "src.transferFrom(msg.sender, this, srcAmount)");
        uint256 destAmount = convertRate(srcAmount, rate);
        require(destAmount < maxDestAmount, "destAmount < maxDestAmount");
        require(dest.transfer(destAddress, destAmount), "dest.transfer(destAddress, destAmount)");
        return destAmount;
    }

    function convertRate(uint256 amount, uint256 rate) public pure returns (uint256) {
        return (amount * rate) / 10**18;
    }

    function getExpectedRate(ERC20 src, ERC20 dest, uint srcQty)
        public view returns(uint expectedRate, uint slippageRate) {
        return (expectedRate, slippageRate);
    }

}