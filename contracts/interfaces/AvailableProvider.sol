pragma solidity ^0.4.24;

import "./Token.sol";

interface AvailableProvider {
   function isAvailable(Token _from, Token _to, uint256 _amount) external view returns (bool);
}
