pragma solidity ^0.5.0;

import "./../../interfaces/Oracle.sol";


contract TestOracle is Oracle {
    struct Currency {
        uint256 rate;
        uint256 decimals;
    }

    Token public RCN;

    mapping (bytes32 => Currency) symbolToCurrency;

    constructor(Token _RCN) public {
        RCN = _RCN;
    }

    function changeRate(bytes32 _symbol, uint256 _rate) public {
        symbolToCurrency[_symbol].rate = _rate;
    }

    function addCurrencyRate(bytes32 _symbol, uint256 _rate, uint256 _decimals) public {
        symbolToCurrency[_symbol] = Currency(_rate, _decimals);
        emit NewSymbol(_symbol);
    }

    function url() public view returns (string memory) {
        return "";
    }

    function getRateStr(string memory _str, bytes memory a) public returns (uint256 rate, uint256 decimals) {
        return getRate(keccak256(bytes(_str)), a);
    }

    function getRate(bytes32 _symbol, bytes memory ) public returns (uint256 rate, uint256 decimals) {
        Currency storage currency = symbolToCurrency[_symbol];

        return (currency.rate, currency.decimals);
    }
}
