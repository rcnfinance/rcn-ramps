pragma solidity ^0.4.19;

import "./Token.sol";
import "./Oracle.sol";
import "./Cosigner.sol";

interface NanoLoanEngineInterface {
    function pay(uint index, uint256 _amount, address _from, bytes oracleData) public returns (bool);
    function rcn() public view returns (Token);
    function getOracle(uint256 index) public view returns (Oracle);
    function getAmount(uint256 index) public view returns (uint256);
    function getCurrency(uint256 index) public view returns (bytes32);
    function convertRate(Oracle oracle, bytes32 currency, bytes data, uint256 amount) public view returns (uint256);
    function lend(uint index, bytes oracleData, Cosigner cosigner, bytes cosignerData) public returns (bool);
    function transfer(address to, uint256 index) public returns (bool);
    function getPendingAmount(uint256 index) public returns (uint256);
}