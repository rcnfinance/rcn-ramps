pragma solidity ^0.4.19;

import "./../interfaces/Oracle.sol";
import "./kyber/ERC20Interface.sol";

contract TestOracle is Oracle {
    struct Currency {
        uint256 rate;
        uint256 decimals;
    }

    ERC20 public RCN;

    mapping (bytes32 => Currency) symbolToCurrency;

    constructor(ERC20 _RCN) public {
        RCN = _RCN;
    }

    function changeRate(bytes32 _symbol, uint256 _rate) public {
        symbolToCurrency[_symbol].rate = _rate;
    }

    function addCurrencyRate(bytes32 _symbol, uint256 _rate, uint256 _decimals) public {
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
