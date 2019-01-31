pragma solidity ^0.5.0;

import "./BasicTestToken.sol";

contract RcnToken is MintableToken, StandardBurnableToken {
    string public name = "Ripio credit network";
    string public symbol = "RCN";
    uint8 public decimals = 18;
    uint public totalSupply = 21 * (10 ** 24);

    constructor () public {
        balances[msg.sender] = totalSupply;
    }
}
