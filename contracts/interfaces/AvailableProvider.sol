pragma solidity ^0.5.0;

import "./Token.sol";

interface AvailableProvider {
   function isAvailable(Token _from, Token _to, uint256 _amount) external view returns (bool);
}
