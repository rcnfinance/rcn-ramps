/* global artifacts */
/* eslint-disable no-unused-vars */
const KyberProxy = artifacts.require('./KyberProxy.sol');
const TestToken = artifacts.require('./vendors/rcn/TestToken.sol');

module.exports = async (deployer, network, accounts) => {
  let KyberNetworkProxy;

  if (network === 'ropsten') {
    KyberNetworkProxy = '0x818E6FECD516Ecc3849DAf6845e3EC868087B755';
  } 

  await deployer.deploy(TestToken, "Ripio Credit Network", "RCN", 18, "1.1", 4000)
  await deployer.deploy(KyberProxy, rcn.address);
  await KyberProxy.setConverter(KyberNetworkProxy);
};
