pragma solidity ^0.5.0;

import "./BasicTestToken.sol";


contract ManaToken is MintableToken, StandardBurnableToken {
    string public name = "Decentraland";
    string public symbol = "MANA";
    uint8 public decimals = 8;

    constructor () public {
        _totalSupply = 21 * (10 ** 14);
        balances[msg.sender] = _totalSupply;
    }
}
