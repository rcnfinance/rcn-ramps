pragma solidity ^0.4.19;

import "./../../interfaces/Oracle.sol";

contract TestOracle is Oracle {

    struct Currency {
        uint256 rate;
        uint256 decimals;
    }

    mapping (bytes32 => Currency) symbolToCurrency;

    constructor() public {
        addCurrency(keccak256("USD"), 14, 2);
        addCurrency(keccak256("ARG"), 308, 2);
    }

    function changeRate(bytes32 _symbol, uint256 _rate) public {
        symbolToCurrency[_symbol].rate = _rate;
    }

    function addCurrency(bytes32 _symbol, uint256 _rate, uint256 _decimals) public {
        symbolToCurrency[_symbol] = Currency(_rate, _decimals);
        emit NewSymbol(_symbol);
    }

    function url() public view returns (string) {
        return "";
    }

    function getRateStr(string _str, bytes a) public returns (uint256 rate, uint256 decimals) {
        return getRate(keccak256(_str), a);
    }

    function getRate(bytes32 _symbol, bytes ) public returns (uint256 rate, uint256 decimals) {
        Currency storage currency = symbolToCurrency[_symbol];

        return (currency.rate, currency.decimals);
    }
}
