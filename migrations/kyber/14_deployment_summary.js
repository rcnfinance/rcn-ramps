/* global artifacts */
/* eslint-disable no-unused-vars, no-eval */
const fs = require('fs');

const Network = artifacts.require('./vendors/kyber/KyberNetwork.sol');
const NetworkProxy = artifacts.require('./vendors/kyber/KyberNetworkProxy.sol');
const ConversionRates = artifacts.require('./vendors/kyber/ConversionRates.sol');
const SanityRates = artifacts.require('./vendors/kyber/SanityRates.sol');
const Reserve = artifacts.require('./vendors/kyber/KyberReserve.sol');
const FeeBurner = artifacts.require('./vendors/kyber/FeeBurner.sol');
const WhiteList = artifacts.require('./vendors/kyber/WhiteList.sol');
const ExpectedRate = artifacts.require('./vendors/kyber/ExpectedRate.sol');

const KyberProxy = artifacts.require('./KyberProxy.sol');

const KNC = artifacts.require('./vendors/mocks/KyberNetworkCrystal.sol');
const RCN = artifacts.require('./vendors/mocks/RcnToken.sol');
const MANA = artifacts.require('./vendors/mocks/ManaToken.sol');
const ZIL = artifacts.require('./vendors/mocks/ZilliqaToken.sol');

const networkConfig = JSON.parse(fs.readFileSync('../../config/network.json', 'utf8'));
const tokenConfig = JSON.parse(fs.readFileSync('../../config/tokens.json', 'utf8'));

module.exports = (deployer, network, accounts) => {
    if (deployer.network != 'kyber') return;

    console.log('\n');

    console.log('Network');
    console.log('==================');
    console.log(network);

    console.log('\n');

    console.log('Permissions');
    console.log('==================');
    console.log(`(admin) ${accounts[0]}`);
    console.log(`(operator) ${accounts[1]}`);
    console.log(`(alerter) ${accounts[2]}`);

    console.log('\n');

    console.log('Wallets');
    console.log('==================');
    console.log(`(user) ${accounts[4]}`);
    console.log(`(reserve) ${accounts[5]}`);
    console.log(`(tax) ${accounts[6]}`);
    Object.keys(networkConfig.feeSharingWallets).forEach((key) => {
        console.log(`(${key}) ${eval(networkConfig.feeSharingWallets[key].wallet)}`);
    });

    console.log('\n');

    console.log('Tokens');
    console.log('==================');
    Object.keys(tokenConfig).forEach((key) => {
        console.log(`(${key}) ${eval(key).address}`);
    });

    console.log('\n');

    console.log('Contracts');
    console.log('==================');
    console.log(`(KyberNetwork) ${Network.address}`);
    console.log(`(KyberNetworkProxy) ${NetworkProxy.address}`);
    console.log(`(ConversionRates) ${ConversionRates.address}`);
    console.log(`(SanityRates) ${SanityRates.address}`);
    console.log(`(KyberReserve) ${Reserve.address}`);
    console.log(`(FeeBurner) ${FeeBurner.address}`);
    console.log(`(WhiteList) ${WhiteList.address}`);
    console.log(`(ExpectedRate) ${ExpectedRate.address}`);
    console.log(`(KyberProxy) ${KyberProxy.address}`);
    console.log(`(Trade) ${Trade.address}`);
};
