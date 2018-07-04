pragma solidity ^0.4.19;


import "../../interfaces/Token.sol";
import "../../interfaces/TokenConverter.sol";
import "../bancor/converter/BancorConverter.sol";
import "../bancor/token/interfaces/IERC20Token.sol";
import "./../../utils/Ownable.sol";

contract BancorProxy is TokenConverter, Ownable {
    IBancorConverter converterEthBnt;
    mapping(address => mapping(address => BancorConverter)) converterOf;
    Token ethToken;
    Token bntToken;

    IERC20Token[] private convertPathBuy;
    IERC20Token[] private convertPathSell;

    constructor(
        Token _ethToken,
        Token _bntToken
    ) public {
        ethToken = _ethToken;
        bntToken = _bntToken;
        convertPathSell = [IERC20Token(bntToken), IERC20Token(ethToken), IERC20Token(ethToken)];
        convertPathBuy = [IERC20Token(ethToken), IERC20Token(bntToken), IERC20Token(bntToken)];
    }

    function setConverter(
        address _token1,
        address _token2,
        BancorConverter _converter
    ) public onlyOwner returns (bool) {
        converterOf[_token1][_token2] = _converter;
        converterOf[_token2][_token1] = _converter;
        return true;
    }

    function getReturn(Token from, Token to, uint256 sell) public view returns (uint256 amount){
        if (from == ETH_ADDRESS) {
            return _getReturn(bntToken, to, _getReturn(ethToken, bntToken, sell));
        }

        if (to == ETH_ADDRESS) {
            return _getReturn(bntToken, ethToken, _getReturn(from, bntToken, sell));
        }
        
        return _getReturn(from, to, sell);
    }

    function _getReturn(
        Token from,
        Token to,
        uint256 sell
    ) private view returns (uint256 amount) {
        return converterOf[from][to].getReturn(IERC20Token(from), IERC20Token(to), sell);
    }

    function convert(Token _fromToken, Token _toToken, uint256 _fromAmount, uint256 _minReturn) public payable returns (uint256 amount){
        Token fromToken = _fromToken;
        uint256 fromAmount = _fromAmount;
        Token toToken = _toToken;

        if (_fromToken == ETH_ADDRESS) {
            require(msg.value == _fromAmount);
            fromAmount = converterOf[ethToken][bntToken].quickConvert.value(msg.value)(convertPathBuy, msg.value, 1);
            fromToken = bntToken;
        } else {
            require(msg.value == 0);
            require(_fromToken.transferFrom(msg.sender, this, fromAmount));
        }

        if (toToken == ETH_ADDRESS) {
            toToken = bntToken;
        }

        BancorConverter converter = converterOf[fromToken][toToken];
        require(fromToken.approve(converter, fromAmount));
        amount = converter.convert(IERC20Token(fromToken), IERC20Token(toToken), fromAmount, 1);
        require(fromToken.approve(converter, 0));

        if (_toToken == ETH_ADDRESS) {
            converter = converterOf[ethToken][bntToken];
            require(toToken.approve(converter, amount));
            amount = converter.quickConvert.value(0)(convertPathSell, amount, 1);
            require(toToken.approve(converter, 0));
            require(amount >= _minReturn);
            msg.sender.transfer(amount);
        } else {
            require(amount >= _minReturn);
            require(_toToken.transfer(msg.sender, amount));
        }
    }
}
