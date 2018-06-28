pragma solidity ^0.4.18;

import "./ERC20Interface.sol";


contract KyberNetworkInterface {
  function trade(
      ERC20 src,
      uint srcAmount,
      ERC20 dest,
      address destAddress,
      uint maxDestAmount,
      uint minConversionRate,
      address walletId
  )
      public
      payable
      returns(uint);

  function getExpectedRate(
      ERC20 src,
      ERC20 dest,
      uint srcQty
  )
      public view
      returns (uint expectedRate, uint slippageRate);
  // maybe dont use this function
  function findBestRate(
      ERC20 src,
      ERC20 dest,
      uint srcQty
  )
      public view
      returns(uint, uint);
}
