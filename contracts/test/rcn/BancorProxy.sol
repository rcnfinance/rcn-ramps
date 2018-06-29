pragma solidity ^0.4.19;


import "../../interfaces/Token.sol";
import "../../interfaces/TokenConverter.sol";
import '../bancor/converter/interfaces/IBancorConverter.sol';
import '../bancor/token/interfaces/IERC20Token.sol';

contract BancorProxy is TokenConverter {
    IBancorConverter converter;
    IERC20Token[] private convertPath;

    constructor(IBancorConverter _converter){
        converter = _converter;
    }

    function convertFromETH(Token _toToken, uint256 _fromAmount, uint256 _minReturn) public payable returns (uint256 amount){
        //convertPath = [_fromToken, IERC20Token(converter.token()), _toToken];
        //amount = converter.quickConvert.value(msg.value)(IERC20Token(_fromToken), IERC20Token(_toToken), _fromAmount, _minReturn);
        //require(_toToken.transfer(msg.sender, amount));
    }

    function getReturn(Token _fromToken, Token _toToken, uint256 _fromAmount) public view returns (uint256 amount){
        return converter.getReturn(IERC20Token(_fromToken), IERC20Token(_toToken), _fromAmount);
    }

    function convert(Token _fromToken, Token _toToken, uint256 _fromAmount, uint256 _minReturn) public returns (uint256 amount){
        require(_fromToken.transferFrom(msg.sender, this, _fromAmount));
        require(_fromToken.approve(converter, _fromAmount));
        amount = converter.convert(IERC20Token(_fromToken), IERC20Token(_toToken), _fromAmount, _minReturn);
        require(_fromToken.approve(converter, 0));
        require(_toToken.transfer(msg.sender, amount));
    }
}
