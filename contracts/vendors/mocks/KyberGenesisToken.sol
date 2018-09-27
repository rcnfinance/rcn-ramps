pragma solidity ^0.4.24;

import "./BasicTestToken.sol";


contract KyberGenesisToken is StandardToken, StandardBurnableToken {
    string public name = "KyberGenesisToken";
    string public symbol = "KGT";
    uint8 public decimals = 0;
    uint public totalSupply = 39485;

    constructor () public {
        balances[msg.sender] = totalSupply;
    }
}
