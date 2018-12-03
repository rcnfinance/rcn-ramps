const BancorNetwork = artifacts.require('./vendors/bancor/BancorNetwork.sol');
const ContractIds = artifacts.require('./vendors/bancor/ContractIds.sol');
const BancorConverter = artifacts.require('./vendors/bancor/converter/BancorConverter.sol');
const BancorFormula = artifacts.require('./vendors/bancor/converter/BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('./vendors/bancor/converter/BancorGasPriceLimit.sol');
const SmartToken = artifacts.require('./vendors/bancor/token/SmartToken.sol');
const ContractRegistry = artifacts.require('./vendors/bancor/utility/ContractRegistry.sol');
const ContractFeatures = artifacts.require('./vendors/bancor/utility/ContractFeatures.sol');

const NanoLoanEngine = artifacts.require('./vendors/rcn/NanoLoanEngine.sol');
const BancorOracle = artifacts.require('./vendors/rcn/BancorOracle.sol');
const TestCosigner = artifacts.require('./vendors/rcn/TestCosigner.sol');

const TestToken = artifacts.require('./vendors/rcn/TestToken.sol');

const ConverterRamp = artifacts.require('./ConverterRamp.sol');
const BancorProxy = artifacts.require('./BancorProxy.sol');

const Helper = require('../Helper.js');
const BigNumber = web3.BigNumber;

require('chai')
    .use(require('chai-bignumber')(BigNumber))
    .should();

function bn (number) {
    if (typeof number != 'string') {
        number = number.toString();
    }
    return new BigNumber(number);
}

function toWei (ether) {
    return bn(ether).mul(bn(10).pow(bn(18)));
}

contract('ConverterRamp', function (accounts) {
    const gasPrice = toWei(1);

    let rcnEngine;
    let converterRamp;
    let bancorProxy;

    // bancor converter
    let converter;

    // tokens
    let rcn;
    let tico;
    let smartToken;

    // accounts
    const owner = accounts[0];
    const borrower = accounts[1];
    const lender = accounts[2];
    const payer = accounts[3];
    const signer = accounts[4];

    before('Deploy Tokens, Bancor, Converter, Ramp', async function () {
        // Deploy TICO token
        tico = await TestToken.new({ from: owner });
        // Deploy RCN token
        rcn = await TestToken.new({ from: owner });
        // Deploy RCN Engine
        rcnEngine = await NanoLoanEngine.new(rcn.address, { from: owner });

        // Deploy Bancor as example
        const contractRegistry = await ContractRegistry.new({ from: owner });
        const contractIds = await ContractIds.new({ from: owner });

        const contractFeatures = await ContractFeatures.new({ from: owner });
        const contractFeaturesId = await contractIds.CONTRACT_FEATURES.call();
        await contractRegistry.registerAddress(contractFeaturesId, contractFeatures.address, { from: owner });

        const gasPriceLimit = await BancorGasPriceLimit.new(gasPrice, { from: owner });
        const gasPriceLimitId = await contractIds.BANCOR_GAS_PRICE_LIMIT.call();
        await contractRegistry.registerAddress(gasPriceLimitId, gasPriceLimit.address, { from: owner });

        const formula = await BancorFormula.new({ from: owner });
        const formulaId = await contractIds.BANCOR_FORMULA.call();
        await contractRegistry.registerAddress(formulaId, formula.address, { from: owner });

        const bancorNetwork = await BancorNetwork.new(contractRegistry.address, { from: owner });
        const bancorNetworkId = await contractIds.BANCOR_NETWORK.call();
        await contractRegistry.registerAddress(bancorNetworkId, bancorNetwork.address, { from: owner });
        await bancorNetwork.setSignerAddress(signer, { from: owner });

        // converter RCN-TICO
        smartToken = await SmartToken.new('RCN TICO Token', 'RCNTICO', 18);
        await smartToken.issue(borrower, toWei(6500000), { from: owner });
        smartToken = await SmartToken.new('RCN TICO Token', 'RCNTICO', bn(18), { from: owner });

        converter = await BancorConverter.new(smartToken.address, contractRegistry.address, bn(0), rcn.address, bn(250000), { from: owner });
        await converter.addConnector(tico.address, bn(250000), false, { from: owner });
        await smartToken.transferOwnership(converter.address, { from: owner });
        await converter.acceptTokenOwnership({ from: owner });
        await rcn.setBalance(converter.address, toWei(2500000), { from: owner });
        await tico.setBalance(converter.address, toWei(2500000), { from: owner });

        // Deploy ramp
        converterRamp = await ConverterRamp.new({ from: owner });
        // Deploy proxy
        bancorProxy = await BancorProxy.new(Helper.address0x, { from: owner });
        await bancorProxy.setConverter(rcn.address, tico.address, converter.address, { from: owner });
    });

    it('Should lend and pay using the ramp (Bancor)', async () => {
        const loanAmount = bn(5000);

        const loanId = (await Helper.toEvent(
            rcnEngine.createLoan(
                Helper.address0x, // Contract of the oracle
                borrower, // Borrower of the loan (caller of this method)
                Helper.address0x, // Currency of the loan is RCN
                loanAmount, // in RCN
                Helper.toInterestRate(20), // interest rate
                Helper.toInterestRate(30), // punitory interest rate
                bn(86400).mul(bn(90)), // Duration of the loan, 6 months
                bn(0), // Payment can start right away
                bn(10).pow(bn(40)), // This request never expires
                'Loan with emoji 🦓 :)'
            ),
            'CreatedLoan'
        ))._index;

        await tico.setBalance(lender, loanAmount.mul(bn(5)));
        await tico.approve(converterRamp.address, loanAmount.mul(bn(5)), { from: lender });

        const lendLoanParams = [
            Helper.toBytes32(rcnEngine.address),
            Helper.toBytes32(loanId),
            Helper.toBytes32(Helper.address0x),
        ];

        const convertParams = [
            bn(50),
            bn(0),
            bn(0),
        ];

        await converterRamp.lend(
            bancorProxy.address,
            tico.address,
            lendLoanParams,
            [],
            [],
            convertParams,
            { from: lender }
        );

        (await tico.balanceOf(converterRamp.address)).should.be.bignumber.equal(bn(0));
        (await rcn.balanceOf(converterRamp.address)).should.be.bignumber.equal(bn(0));
        assert.equal(await rcnEngine.ownerOf(loanId), lender);

        const payAmount = bn(333);
        await tico.setBalance(lender, payAmount);
        await tico.approve(converterRamp.address, payAmount, { from: payer });

        const payLoanParams = [
            Helper.toBytes32(rcnEngine.address),
            Helper.toBytes32(loanId),
            Helper.toBytes32(toWei(100)),
            Helper.toBytes32(payer),
        ];

        await converterRamp.pay(
            converter.address,
            tico.address,
            payLoanParams,
            [],
            convertParams,
            { from: payer }
        );
    });
/*

await rcn.setBalance(converter.address, toWei(2500000));
await tico.setBalance(converter.address, toWei(6500000));
// await eth.deposit({ value: web3.toWei(1) });
    it('Should lend and pay using the ramp + oracle', async () => {
        const bancorOracle = await BancorOracle.new();
        await bancorOracle.setRcn(rcn.address);
        await bancorOracle.addCurrencyConverter('TICO', tico.address, converter.address);
        const ticoCurrency = await bancorOracle.encodeCurrency('TICO');

        const loanId = (await Helper.toEvent(
            rcnEngine.createLoan(
                bancorOracle.address, // Contract of the oracle
                borrower, // Borrower of the loan (caller of this method)
                ticoCurrency, // Currency of the loan, TICO
                toWei(500), // Requested 500 TICO
                Helper.toInterestRate(20), // interest rate
                Helper.toInterestRate(30), // punitory interest rate
                bn(86400).mul(bn(90)), // Duration of the loan, 6 months
                bn(0), // Payment can start right away
                bn(10).pow(bn(40)), // This request never expires
                'Loan with emoji 🦓 :)'
            ),
            'CreatedLoan'
        ))._index;

        await tico.createTokens(lender, bn(10000));
        await tico.approve(converterRamp.address, bn(10000), { from: lender });

        const lendLoanParams = [
            Helper.toBytes32(rcnEngine.address),
            Helper.toBytes32(loanId),
            Helper.toBytes32(Helper.address0x),
        ];

        const convertParams1 = [
            bn(50),
            bn(0),
            bn(0),
        ];

        await converterRamp.lend(
            converter.address,
            tico.address,
            lendLoanParams,
            [],
            [],
            convertParams1,
            { from: lender }
        );

        (await tico.balanceOf(converterRamp.address)).should.be.bignumber.equal(bn(0));
        (await rcn.balanceOf(converterRamp.address)).should.be.bignumber.equal(bn(0));
        assert.equal(await rcnEngine.ownerOf(loanId), lender);

        await tico.createTokens(payer, bn(10000));
        await tico.approve(converterRamp.address, bn(10000), { from: payer });

        const payLoanParams1 = [
            Helper.toBytes32(rcnEngine.address),
            Helper.toBytes32(loanId),
            Helper.toBytes32(toWei(100)),
            Helper.toBytes32(payer),
        ];

        await converterRamp.pay(
            converter.address,
            tico.address,
            payLoanParams1,
            [],
            convertParams1,
            { from: payer }
        );

        // Pay the total amount of the loan
        Helper.increaseTime(10);

        const payLoanParams2 = [
            Helper.toBytes32(rcnEngine.address),
            Helper.toBytes32(loanId),
            Helper.toBytes32(pending),
            Helper.toBytes32(payer),
        ];

        const pending = (await rcnEngine.getPendingAmount.call(loanId)).mul(bn(5));
        const convertParams2 = [
            bn(50),
            pending.mul(bn(100000).plus(bn(50))).dividedToIntegerBy(100000),
            bn(0),
        ];

        await converterRamp.pay(
            converter.address,
            tico.address,
            payLoanParams2,
            [],
            convertParams2,
            { from: payer }
        );

        (await rcnEngine.getPendingAmount.call(loanId)).should.be.bignumber.equal(bn(0));
    });

    it('Should lend and pay using the ramp + oracle + cosigner', async () => {
        const bancorOracle = await BancorOracle.new();
        await bancorOracle.setRcn(rcn.address);
        await bancorOracle.addCurrencyConverter('TICO', tico.address, converter.address);
        const ticoCurrency = await bancorOracle.encodeCurrency('TICO');

        const testCosigner = await TestCosigner.new();

        const loanId = (await Helper.toEvent(
            rcnEngine.createLoan(
                bancorOracle.address, // Contract of the oracle
                borrower, // Borrower of the loan (caller of this method)
                ticoCurrency, // Currency of the loan, TICO
                toWei(500), // Requested 500 TICO
                Helper.toInterestRate(20), // interest rate
                Helper.toInterestRate(30), // punitory interest rate
                bn(86400).mul(bn(90)), // Duration of the loan, 6 months
                bn(0), // Payment can start right away
                bn(10).pow(bn(40)), // This request never expires
                'Loan with emoji 🦓 :)'
            ),
            'CreatedLoan'
        ))._index;

        await tico.createTokens(lender, bn(10000));
        await tico.approve(converterRamp.address, bn(10000), { from: lender });

        const lendLoanParams = [
            Helper.toBytes32(rcnEngine.address),
            Helper.toBytes32(loanId),
            Helper.toBytes32(testCosigner.address),
        ];

        const convertParams = [
            bn(200),
            bn(0),
            bn(0),
        ];

        await converterRamp.lend(
            converter.address,
            tico.address,
            lendLoanParams,
            [],
            [],
            convertParams,
            { from: lender }
        );

        (await tico.balanceOf(converterRamp.address)).should.be.bignumber.equal(bn(0));
        (await rcn.balanceOf(converterRamp.address)).should.be.bignumber.equal(bn(0));
        assert.equal(await rcnEngine.ownerOf(loanId), lender);
    });*/
});
