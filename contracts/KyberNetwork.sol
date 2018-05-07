pragma solidity ^0.4.19;

import "./interfaces/Oracle.sol";
import "./interfaces/Token.sol";
import "./utils/Ownable.sol";

contract KyberNetwork {
    function trade(Token src, uint srcAmount, Token dest, address destAddress, uint maxDestAmount,
        uint minConversionRate, address walletId) public payable returns(uint);

    function getExpectedRate(Token src, Token dest, uint srcQty) public view
        returns (uint expectedRate, uint slippageRate);
}
