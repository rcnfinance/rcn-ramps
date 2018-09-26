/* global artifacts */
/* eslint-disable no-unused-vars */
const KyberProxy = artifacts.require('./KyberProxy.sol');

module.exports = async (deployer, network, accounts) => {
  let KyberNetworkProxy;

  if (network === 'ropsten') {
    KyberNetworkProxy = '0x818E6FECD516Ecc3849DAf6845e3EC868087B755';
  } 

  await deployer.deploy(KyberProxy, KyberNetworkProxy);
};
