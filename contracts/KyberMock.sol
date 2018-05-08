pragma solidity ^0.4.19;

import "./utils/Ownable.sol";
import "./interfaces/Token.sol";
import "./KyberNetwork.sol";

contract KyberMock is KyberNetwork, Ownable {
    address constant internal ETH_TOKEN_ADDRESS = 0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee;
    Token public RCN;

    uint256 public rateER;
    uint256 public rateRE;

    constructor(Token _RCN) public {
        RCN = _RCN;
    }

    function withdraw(Token token, address to, uint256 amount) public onlyOwner returns (bool) {
        return token.transfer(to, amount);
    }

    function setRateER(uint256 _rateER) public onlyOwner returns (bool) {
        rateER = _rateER;
        return true;
    }

    function setRateRE(uint256 _rateRE) public onlyOwner returns (bool) {
        rateRE = _rateRE;
        return true;
    }

    function trade( Token src, uint srcAmount, Token dest, address destAddress, uint maxDestAmount,
      uint minConversionRate, address) public payable returns(uint) {
        uint256 rate;
        (rate, ) = getExpectedRate(src, dest, srcAmount);
        require(rate > minConversionRate);

        if (src == ETH_TOKEN_ADDRESS) {
            require(msg.value == srcAmount);
        } else {
            require(src.transferFrom(msg.sender, this, srcAmount));
        }

        uint256 destAmount = convertRate(srcAmount, rate);
        require(destAmount < maxDestAmount);

        if (dest == ETH_TOKEN_ADDRESS) {
            destAddress.transfer(destAmount);
        } else {
            require(dest.transfer(destAddress, destAmount));
        }

        return destAmount;
    }

    function convertRate(uint256 amount, uint256 rate) public pure returns (uint256) {
        return (amount * rate) / 10**18;
    }

    function getExpectedRate(Token src, Token dest, uint256) public view returns (uint256, uint256) {
        if (src == ETH_TOKEN_ADDRESS && dest == RCN) {
            return (rateER, rateER);
        } else if (src == RCN && dest == ETH_TOKEN_ADDRESS) {
            return (rateRE, rateRE);
        }

        revert();
    }
}
