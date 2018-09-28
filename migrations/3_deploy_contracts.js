/* global artifacts */
/* eslint-disable no-unused-vars */
const Network = artifacts.require('./vendors/kyber/KyberNetwork.sol');
const NetworkProxy = artifacts.require('./vendors/kyber/KyberNetworkProxy.sol');
const ConversionRates = artifacts.require('./vendors/kyber/ConversionRates.sol');
const SanityRates = artifacts.require('./vendors/kyber/SanityRates.sol');
const Reserve = artifacts.require('./vendors/kyber/KyberReserve.sol');
const FeeBurner = artifacts.require('./vendors/kyber/FeeBurner.sol');
const WhiteList = artifacts.require('./vendors/kyber/WhiteList.sol');
const ExpectedRate = artifacts.require('./vendors/kyber/ExpectedRate.sol');
const KNC = artifacts.require('./vendors/mock/KyberNetworkCrystal.sol');
const KGT = artifacts.require('./vendors/mock/KyberGenesisToken.sol');
const KyberProxy = artifacts.require('./KyberProxy.sol');

module.exports = async (deployer, network, accounts) => {
  const admin = accounts[0];

  // Deploy the contracts
  await deployer.deploy(Network, admin);
  await deployer.deploy(NetworkProxy, admin);
  await deployer.deploy(ConversionRates, admin);
  await deployer.deploy(SanityRates, admin);
  await deployer.deploy(Reserve, Network.address, ConversionRates.address, admin);
  await deployer.deploy(FeeBurner, admin, KNC.address, Network.address);
  await deployer.deploy(WhiteList, admin, KGT.address);
  await deployer.deploy(ExpectedRate, Network.address, admin);

  await deployer.deploy(KyberProxy, NetworkProxy.address);
};
