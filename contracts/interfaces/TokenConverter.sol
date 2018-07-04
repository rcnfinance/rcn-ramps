pragma solidity ^0.4.19;

import "./../interfaces/Token.sol";

contract TokenConverter {
    address public constant ETH_ADDRESS = 0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee;
    function getReturn(Token _fromToken, Token _toToken, uint256 _fromAmount) public view returns (uint256 amount);
    function convert(Token _fromToken, Token _toToken, uint256 _fromAmount, uint256 _minReturn) public payable returns (uint256 amount);
}
