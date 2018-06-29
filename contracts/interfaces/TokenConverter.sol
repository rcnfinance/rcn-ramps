pragma solidity ^0.4.19;

import "./../interfaces/Token.sol";

contract TokenConverter {
    function getReturn(Token _fromToken, Token _toToken, uint256 _fromAmount) public view returns (uint256 amount);
    function convertFromETH(Token _toToken, uint256 _fromAmount, uint256 _minReturn) public payable returns (uint256);
    function convert(Token _fromToken, Token _toToken, uint256 _fromAmount, uint256 _minReturn) public returns (uint256 amount);
}
