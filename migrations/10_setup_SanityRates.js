/* global artifacts */
/* eslint-disable no-unused-vars, no-eval */
const fs = require('fs');

const SanityRates = artifacts.require('./vendors/kyber/SanityRates.sol');

const KNC = artifacts.require('./vendors/mocks/KyberNetworkCrystal.sol');
const RCN = artifacts.require('./vendors/mocks/RcnToken.sol');
const MANA = artifacts.require('./vendors/mocks/ManaToken.sol');
const ZIL = artifacts.require('./vendors/mocks/ZilliqaToken.sol');

const networkConfig = JSON.parse(fs.readFileSync('../config/network.json', 'utf8'));
const tokenConfig = JSON.parse(fs.readFileSync('../config/tokens.json', 'utf8'));

function tx(result, call) {
  const logs = (result.logs.length > 0) ? result.logs[0] : { address: null, event: null };

  console.log();
  console.log(`   Calling ${call}`);
  console.log('   ------------------------');
  console.log(`   > transaction hash: ${result.tx}`);
  console.log(`   > contract address: ${logs.address}`);
  console.log(`   > gas used: ${result.receipt.gasUsed}`);
  console.log(`   > event: ${logs.event}`);
  console.log();
}

module.exports = async (deployer, network, accounts) => {
  const operator = accounts[1];
  const reasonableDiffs = [];
  const sanityRates = [];
  const tokens = [];

  // Set the instances
  const SanityRatesInstance = await SanityRates.at(SanityRates.address);

  // Set the input arrays
  Object.keys(tokenConfig).forEach((key) => {
    reasonableDiffs.push(networkConfig.SanityRates.reasonableDiff);
    tokens.push(eval(key).address);
  });

  sanityRates.push(networkConfig.SanityRates[`KNCSanityRate`]);
  sanityRates.push(networkConfig.SanityRates[`RNCSanityRate`]);
  sanityRates.push(networkConfig.SanityRates[`MANASanityRate`]);
  sanityRates.push(networkConfig.SanityRates[`ZILSanityRate`]);


  // Setup the reasonable diffs for all tokens
  tx(
    await SanityRatesInstance.setReasonableDiff(
      tokens,
      reasonableDiffs,
    ),
    'setReasonableDiff()',
  );

  // Set the sanity rates for all tokens
  tx(
    await SanityRatesInstance.setSanityRates(
      tokens,
      sanityRates,
      { from: operator },
    ),
    'setSanityRates()',
  );
};