pragma solidity ^0.5.0;

import "./BasicTestToken.sol";


contract ZilliqaToken is MintableToken, StandardBurnableToken {
    string public name = "Zilliqa";
    string public symbol = "ZIL";
    uint8 public decimals = 12;

    constructor () public {
        _totalSupply = 21 * (10 ** 18);
        balances[msg.sender] = _totalSupply;
    }
}
