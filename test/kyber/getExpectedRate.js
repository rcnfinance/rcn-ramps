/* global artifacts, web3 */
/* eslint-disable no-underscore-dangle */
const BN = require('bn.js');
const moment = require('moment');

const NetworkProxy = artifacts.require('./vendors/kyber/KyberNetworkProxy.sol');

const KNC = artifacts.require('./vendors/mocks/KyberNetworkCrystal.sol');
const RCN = artifacts.require('./vendors/mocks/RcnToken.sol');

function stdlog(input) {
  console.log(`${moment().format('YYYY-MM-DD HH:mm:ss.SSS')}] ${input}`);
}

module.exports = async (callback) => {
  const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  let expectedRate;
  let slippageRate;

  // Set the instances
  const NetworkProxyInstance = await NetworkProxy.at(NetworkProxy.address);

  stdlog('- START -');
  stdlog(`KyberNetworkProxy (${NetworkProxy.address})`);

  ({ expectedRate, slippageRate } = await NetworkProxyInstance.getExpectedRate(
    ETH_ADDRESS, // srcToken
    KNC.address, // destToken
    web3.utils.toWei(new BN(1)), // srcQty
  ));
  stdlog(`ETH <-> KNC getExpectedRate() = expectedRate: ${expectedRate}, slippageRate:${slippageRate}`);

  ({ expectedRate, slippageRate } = await NetworkProxyInstance.getExpectedRate(
    KNC.address, // srcToken
    ETH_ADDRESS, // destToken
    1, // srcQty
  ));
  stdlog(`KNC <-> ETH getExpectedRate() = expectedRate: ${expectedRate}, slippageRate:${slippageRate}`);

  ({ expectedRate, slippageRate } = await NetworkProxyInstance.getExpectedRate(
    KNC.address, // srcToken
    RCN.address, // destToken
    1, // srcQty
  ));
  stdlog(`KNC <-> RCN getExpectedRate() = expectedRate: ${expectedRate}, slippageRate:${slippageRate}`);

  stdlog('- END -');
  callback();
};
