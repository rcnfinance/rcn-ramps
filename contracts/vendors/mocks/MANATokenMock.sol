pragma solidity ^0.4.24;

import "./BasicTestMock.sol";

contract MANATokenMock is MintableToken, StandardBurnableToken {
    string public name = "MANATest";
    string public symbol = "MANA";
    uint8 public decimals = 18;
    uint public totalSupply = 21 * (10 ** 24);

    constructor () public {
        balances[msg.sender] = totalSupply;
    }
}