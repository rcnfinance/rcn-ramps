/* global artifacts, web3 */
/* eslint-disable no-underscore-dangle, no-unused-vars */
const BN = require('bn.js');
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
const TestToken = artifacts.require('./vendors/rcn/TestToken.sol');

const KyberNetworkCrystal = artifacts.require('./vendors/mocks/KyberNetworkCrystal.sol');
const KyberGenesisToken = artifacts.require('./vendors/mocks/KyberGenesisToken.sol');

const testConfig = JSON.parse(fs.readFileSync('./test/config/test.json', 'utf8'));

// Kyber
let network;
let networkProxy;
let conversionRates;
let sanityRates;
let reserve;
let feeBurner;
let whiteList;
let expectedRate;
let knc;
let kgt;

// Accounts
let admin;
let alerter;
let operator;
let moderator;
let userWallet;
let reserveWallet;
let taxWallet;

// Misc.
let result;
let tokens = [];
const tokenAddresses = [];

const errTypes = {
    revert: 'revert',
    outOfGas: 'out of gas',
    invalidJump: 'invalid JUMP',
    invalidOpcode: 'invalid opcode',
    stackOverflow: 'stack overflow',
    stackUnderflow: 'stack underflow',
    staticStateChange: 'static state change',
};

const tryCatch = async (promise, errType) => {
    const PREFIX = 'Returned error: VM Exception while processing transaction:';

    try {
        await promise;
        // throw null;
    } catch (error) {
        assert(error, 'Expected an error but did not get one');
        assert(error.message.startsWith(`${PREFIX} ${errType}`), `Expected an error starting with '${PREFIX} ${errType}' but got '${error.message}' instead`);
    }
};

contract('KyberProxy', (accounts) => {
    it('should init globals.', async () => {
        admin = accounts[0];
        operator = accounts[1];
        alerter = accounts[2];
        moderator = accounts[3];
        userWallet = accounts[4];
        reserveWallet = accounts[5];
        taxWallet = accounts[6];
    });

    it('should init test tokens.', async () => {
        for (let i = 0; i < testConfig.numTokens; i += 1) {
            const token = TestToken.new(`Test${i}`, `TEST${i}`, 18);
            tokens.push(token);
        }

        tokens = await Promise.all(tokens);

        for (let i = 0; i < tokens.length; i += 1) {
            tokenAddresses.push(tokens[i].address);
        }

        assert.equal(tokens.length, testConfig.numTokens, 'Wrong number of tokens');
    });

    it('should init Kyber Network contracts.', async () => {
    // Deploy Kyber tokens
        knc = await KyberNetworkCrystal.new();
        kgt = await KyberGenesisToken.new();
        tokens.push(knc);
        tokenAddresses.push(knc.address);

        // Deploy contracts
        network = await Network.new(admin);
        networkProxy = await NetworkProxy.new(admin);
        conversionRates = await ConversionRates.new(admin);
        sanityRates = await SanityRates.new(admin);
        reserve = await Reserve.new(network.address, conversionRates.address, admin);
        feeBurner = await FeeBurner.new(admin, knc.address, network.address);
        whiteList = await WhiteList.new(admin, kgt.address);
        expectedRate = await ExpectedRate.new(network.address, admin);

        // Setup permissions
        await network.addOperator(operator);
        await conversionRates.addOperator(operator);
        await reserve.addOperator(operator);
        await reserve.addAlerter(alerter);
        await feeBurner.addOperator(operator);
        await whiteList.addOperator(operator);
        await expectedRate.addOperator(operator);
        await sanityRates.addOperator(operator);

        // Setup KyberNetworkProxy
        await networkProxy.setKyberNetworkContract(network.address);

        // Setup KyberReserve
        await reserve.setContracts(
            network.address,
            conversionRates.address,
            sanityRates.address,
        );
        await network.addReserve(reserve.address, true);
        for (let i = 0; i < tokens.length; i += 1) {
            /* eslint-disable no-await-in-loop */
            await reserve.approveWithdrawAddress(tokens[i].address, reserveWallet, true);
            await network.listPairForReserve(
                reserve.address,
                tokens[i].address,
                true,
                true,
                true,
            );
            /* eslint-enable no-await-in-loop */
        }

        // Setup FeeBurner
        await feeBurner.setReserveData(
            reserve.address,
            testConfig.FeeBurner.reserveFees,
            reserveWallet,
        );
        await feeBurner.setKNCRate(testConfig.FeeBurner.kncRate);
        await feeBurner.setTaxInBps(testConfig.FeeBurner.taxFeesBPS);
        await feeBurner.setTaxWallet(taxWallet);
        await feeBurner.setWalletFees(
            // eval(testConfig.feeSharingWallets.kyberProxy.wallet),
            testConfig.feeSharingWallets.kyberProxy.fees,
        );

        // Setup ExpectedRate
        await expectedRate.setWorstCaseRateFactor(
            testConfig.ExpectedRate.minExpectedRateSlippage,
            { from: operator },
        );
        await expectedRate.setQuantityFactor(
            testConfig.ExpectedRate.quantityFactor,
            { from: operator },
        );

        // Setup ConversionRates
        await conversionRates.setValidRateDurationInBlocks(
            testConfig.ConversionRates.validDurationBlock,
        );
        for (let i = 0; i < tokens.length; i += 1) {
            /* eslint-disable no-await-in-loop */
            await conversionRates.addToken(tokens[i].address);
            await conversionRates.setTokenControlInfo(
                tokens[i].address,
                testConfig.TestToken.minimalRecordResolution,
                testConfig.TestToken.maxPerBlockImbalance,
                testConfig.TestToken.maxTotalImbalance,
            );
            await conversionRates.setQtyStepFunction(
                tokens[i].address,
                [0],
                [0],
                [0],
                [0],
                { from: operator },
            );
            await conversionRates.setImbalanceStepFunction(
                tokens[i].address,
                [0],
                [0],
                [0],
                [0],
                { from: operator },
            );
            await conversionRates.enableTokenTrade(tokens[i].address);
            /* eslint-enable no-await-in-loop */
        }
        await conversionRates.setReserveAddress(reserve.address);
        await conversionRates.setBaseRate(
            tokenAddresses,
            testConfig.ConversionRates.baseBuy,
            testConfig.ConversionRates.baseSell,
            testConfig.ConversionRates.bytes14,
            testConfig.ConversionRates.bytes14,
            1,
            [0, 0, 0],
            { from: operator },
        );

        // Setup SanityRates
        await sanityRates.setReasonableDiff(
            tokenAddresses,
            testConfig.SanityRates.reasonableDiffs,
        );
        await sanityRates.setSanityRates(
            tokenAddresses,
            testConfig.SanityRates.sanityRates,
            { from: operator },
        );

        // Setup WhiteList
        await whiteList.setSgdToEthRate(
            testConfig.WhiteList.sgdToETHRate,
            { from: operator },
        );
        await whiteList.setCategoryCap(
            testConfig.WhiteList.defaultCategory,
            testConfig.WhiteList.defaultCap,
            { from: operator },
        );

        // Setup KyberNetwork
        await network.setKyberProxy(networkProxy.address);
        await network.setFeeBurner(feeBurner.address);
        await network.setWhiteList(whiteList.address);
        await network.setExpectedRate(expectedRate.address);
        await network.setParams(
            testConfig.KyberNetwork.maxGasPrice,
            testConfig.KyberNetwork.negDiffInBPS,
        );
        await network.setEnable(true);

        // Transfer tokens and ETH to reserve
        const amount = (
            new BN(1000).mul(new BN(10).pow(new BN(18)))
        ).toString();
        for (let i = 0; i < tokens.length; i += 1) {
            tokens[i].transfer(reserve.address, amount);
        }
        await reserve.sendTransaction(
            { from: admin, value: web3.toWei(new BN(5)) },
        );
    });
});
