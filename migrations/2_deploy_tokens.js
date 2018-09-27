/* global artifacts */
const KNC = artifacts.require('./vendors/mock/KyberNetworkCrystal.sol');
const KGT = artifacts.require('./vendors/mock/KyberGenesisToken.sol');
const RCN = artifacts.require('./vendors/mock/RcnToken.sol');
const MANA = artifacts.require('./vendors/mock/ManaToken.sol');
const ZIL = artifacts.require('./vendors/mock/ZilliqaToken.sol');

module.exports = async (deployer) => {
  // Deploy the tokens
  await deployer.deploy(KNC);
  await deployer.deploy(KGT);
  await deployer.deploy(RCN);
  await deployer.deploy(MANA);
  await deployer.deploy(ZIL);
};
