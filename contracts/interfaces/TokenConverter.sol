pragma solidity ^0.4.19;

import "./../interfaces/Token.sol";


contract TokenConverter {
    address public constant ETH_ADDRESS = 0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee;

    function getReturnFrom(Token _fromToken, Token _toToken, uint256 _fromAmount) external view returns (uint256 amount);
    function getReturnTo(Token _fromToken, Token _toToken, uint256 _toAmount) external view returns (uint256 amount);

    function convertFrom(Token _fromToken, Token _toToken, uint256 _fromAmount, uint256 _minReturn) external payable returns (uint256 amount);
    function convertTo(Token _fromToken, Token _toToken, uint256 _toAmount, uint256 _minReturn) external payable returns (uint256 amount);
}
