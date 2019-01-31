pragma solidity ^0.5.0;

import "./BasicTestToken.sol";

contract ManaToken is MintableToken, StandardBurnableToken {
    string public name = "Decentraland";
    string public symbol = "MANA";
    uint8 public decimals = 8;
    uint public totalSupply = 21 * (10 ** 14);

    constructor () public {
        balances[msg.sender] = totalSupply;
    }
}
