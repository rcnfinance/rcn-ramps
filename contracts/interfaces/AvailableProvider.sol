pragma solidity ^0.4.24;

interface AvailableProvider {

   function isAvailable(address converter, uint256 _gasPrice) external view returns (bool);

}