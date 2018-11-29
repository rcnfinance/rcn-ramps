const BancorNetwork = artifacts.require('./vendors/bancor/BancorNetwork.sol');
const ContractIds = artifacts.require('./vendors/bancor/ContractIds.sol');
const BancorConverter = artifacts.require('./vendors/bancor/converter/BancorConverter.sol');
const BancorFormula = artifacts.require('./vendors/bancor/converter/BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('./vendors/bancor/converter/BancorGasPriceLimit.sol');
const SmartToken = artifacts.require('./vendors/bancor/token/SmartToken.sol');
const EtherToken = artifacts.require('./vendors/bancor/token/EtherToken.sol');
const ContractRegistry = artifacts.require('./vendors/bancor/utility/ContractRegistry.sol');
const ContractFeatures = artifacts.require('./vendors/bancor/utility/ContractFeatures.sol');

const NanoLoanEngine = artifacts.require('./vendors/rcn/NanoLoanEngine.sol');
const BancorOracle = artifacts.require('./vendors/rcn/BancorOracle.sol');

const TestToken = artifacts.require('./vendors/TestToken.sol');

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

contract('ConverterRampEth', function (accounts) {
    const gasPrice = toWei(1);

    let rcnEngine;
    let converterRamp;
    let bancorProxy;

    // bancor converters
    let converter;
    // tokens tokens
    let rcn;
    let bnt;
    let smartToken;

    // accounts
    let borrower;
    let lender;
    let signer;
    let payer;

    before('Deploy Tokens, Bancor, Converter, Ramp', async function () {
        // set accounts address;
        borrower = accounts[0];
        lender = accounts[1];
        payer = accounts[2];
        signer = accounts[3];
        // Deploy BNT token
        bnt = await SmartToken.new('Not-Bancor Token', 'BNT', bn(18));

        // Deploy RCN token
        rcn = await TestToken.new('Ripio Credit Network', 'RCN', bn(18), '1.1', bn(4000));

        // Deploy RCN Engine
        rcnEngine = await NanoLoanEngine.new(rcn.address);

        // Deploy Bancor as example
        const contractRegistry = await ContractRegistry.new();
        const contractIds = await ContractIds.new();

        const contractFeatures = await ContractFeatures.new();
        const contractFeaturesId = await contractIds.CONTRACT_FEATURES.call();
        await contractRegistry.registerAddress(contractFeaturesId, contractFeatures.address);

        const gasPriceLimit = await BancorGasPriceLimit.new(gasPrice);
        const gasPriceLimitId = await contractIds.BANCOR_GAS_PRICE_LIMIT.call();
        await contractRegistry.registerAddress(gasPriceLimitId, gasPriceLimit.address);

        const formula = await BancorFormula.new();
        const formulaId = await contractIds.BANCOR_FORMULA.call();
        await contractRegistry.registerAddress(formulaId, formula.address);

        const bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        const bancorNetworkId = await contractIds.BANCOR_NETWORK.call();
        await contractRegistry.registerAddress(bancorNetworkId, bancorNetwork.address);
        await bancorNetwork.setSignerAddress(signer);

        // Issue BNT Tokens
        await bnt.issue(accounts[0], toWei(6500000));

        // converter RCN-BNT
        smartToken = await SmartToken.new('RCN BNT Token', 'RCN-BNT', bn(18));
        await smartToken.issue(borrower, toWei(6500000));
        converter = await BancorConverter.new(smartToken.address, contractRegistry.address, bn(0), rcn.address, bn(250000));
        await converter.addConnector(bnt.address, bn(250000), false);
        await smartToken.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();
        await rcn.createTokens(converter.address, toWei(2500000));
        await bnt.transfer(converter.address, toWei(3000000));
        // converter BNT-ETH
        // smartTokenEth = await SmartToken.new('ETH BNT Token', 'ETH-BNT', 18);
        const ethToken = await EtherToken.new();
        await bancorNetwork.registerEtherToken(ethToken.address, true);
        const converterEth = await BancorConverter.new(bnt.address, contractRegistry.address, bn(0), ethToken.address, bn(100000));
        await bnt.transferOwnership(converterEth.address);
        await converterEth.acceptTokenOwnership();
        // await converterEth.addConnector(ethToken.address, 250000, false);
        // // await smartTokenEth.transferOwnership(converterEth.address);
        // // await converterEth.acceptTokenOwnership();
        // // add balance
        await bnt.transfer(converterEth.address, toWei(3000000));
        await ethToken.deposit({ value: toWei(10), from: accounts[8] });
        await ethToken.transfer(converterEth.address, toWei(10), { from: accounts[8] });
        // // Deploy ramp
        converterRamp = await ConverterRamp.new();
        // Deploy proxy
        bancorProxy = await BancorProxy.new(ethToken.address);
        await bancorProxy.setConverter(bnt.address, rcn.address, converter.address);
        await bancorProxy.setConverter(bnt.address, ethToken.address, converterEth.address);
        await bancorProxy.setRouter(rcn.address, ethToken.address, bnt.address);
    });

    it('Should lend and pay using the ramp', async () => {
        const loanId = (await Helper.toEvent(
            rcnEngine.createLoan(
                Helper.address0x, // Contract of the oracle
                borrower, // Borrower of the loan (caller of this method)
                Helper.address0x, // Currency of the loan is RCN
                web3.toWei(500), // Requested 500 RCN
                Helper.toInterestRate(20), // interest rate
                Helper.toInterestRate(30), // punitory interest rate
                bn(86400).mul(bn(90)), // Duration of the loan, 6 months
                bn(0), // Payment can start right away
                bn(10).pow(bn(40)), // This request never expires
                'Loan with emoji 🦓 :)'
            ),
            'CreatedLoan'
        ))._index;

        const ethAddress = await converterRamp.ETH_ADDRESS();

        const lendLoanParams = [
            Helper.toBytes32(rcnEngine.address),
            Helper.toBytes32(loanId),
            Helper.toBytes32(Helper.address0x),
        ];

        const convertParams = [
            bn(1000001),
            bn(0),
            bn(10).pow(bn(9)),
        ];

        const sendEthLend = await converterRamp.requiredLendSell.call(
            bancorProxy.address,
            ethAddress,
            lendLoanParams,
            [],
            [],
            convertParams
        );

        await converterRamp.lend(
            bancorProxy.address,
            ethAddress,
            lendLoanParams,
            [],
            [],
            convertParams,
            { from: lender, value: sendEthLend }
        );

        (await bnt.balanceOf(converterRamp.address)).should.be.bignumber.equal(bn(0));
        (await rcn.balanceOf(converterRamp.address)).should.be.bignumber.equal(bn(0));
        assert.equal(await rcnEngine.ownerOf(loanId), lender);

        const payLoanParams = [
            Helper.toBytes32(rcnEngine.address),
            Helper.toBytes32(loanId),
            Helper.toBytes32(toWei(100)),
            Helper.toBytes32(payer),
        ];

        const sendEthPay = await converterRamp.requiredPaySell.call(
            bancorProxy.address,
            ethAddress,
            payLoanParams,
            [],
            convertParams
        );

        await converterRamp.pay(
            bancorProxy.address,
            ethAddress,
            payLoanParams,
            [],
            convertParams,
            { from: payer, value: sendEthPay }
        );
    });

    it('Should lend and pay using the ramp + oracle', async () => {
        const bancorOracle = await BancorOracle.new();
        await bancorOracle.setRcn(rcn.address);
        await bancorOracle.addCurrencyConverter('bnt', bnt.address, converter.address);
        const bntCurrency = await bancorOracle.encodeCurrency('bnt');

        const loanId = (await Helper.toEvent(
            rcnEngine.createLoan(
                bancorOracle.address, // Contract of the oracle
                borrower, // Borrower of the loan (caller of this method)
                bntCurrency, // Currency of the loan, bnt
                web3.toWei(500), // Requested 500 RCN
                Helper.toInterestRate(20), // interest rate
                Helper.toInterestRate(30), // punitory interest rate
                bn(86400).mul(bn(90)), // Duration of the loan, 6 months
                bn(0), // Payment can start right away
                bn(10).pow(bn(40)), // This request never expires
                'Loan with emoji 🦓 :)'
            ),
            'CreatedLoan'
        ))._index;

        const ethAddress = await converterRamp.ETH_ADDRESS();

        const lendLoanParams = [
            Helper.toBytes32(rcnEngine.address),
            Helper.toBytes32(loanId),
            Helper.toBytes32(Helper.address0x),
        ];

        const convertParams = [
            bn(1000001),
            bn(0),
            bn(10).pow(bn(9)),
        ];

        let sendEth = await converterRamp.requiredLendSell.call(
            bancorProxy.address,
            ethAddress,
            lendLoanParams,
            [],
            [],
            convertParams
        );

        await converterRamp.lend(
            bancorProxy.address,
            ethAddress,
            lendLoanParams,
            [],
            [],
            convertParams,
            { from: lender, value: sendEth }
        );

        (await bnt.balanceOf(converterRamp.address)).should.be.bignumber.equal(bn(0));
        (await rcn.balanceOf(converterRamp.address)).should.be.bignumber.equal(bn(0));
        assert.equal(await rcnEngine.ownerOf(loanId), lender);

        const payLoanParams = [
            Helper.toBytes32(rcnEngine.address),
            Helper.toBytes32(loanId),
            Helper.toBytes32(toWei(100)),
            Helper.toBytes32(payer),
        ];

        sendEth = await converterRamp.requiredPaySell.call(
            bancorProxy.address,
            ethAddress,
            payLoanParams,
            [],
            convertParams
        );

        await converterRamp.pay(
            bancorProxy.address,
            ethAddress,
            payLoanParams,
            [],
            convertParams,
            { from: payer, value: sendEth }
        );
    });

    it('Should lend and pay using the ramp + oracle + cosigner', async () => {
        const bancorOracle = await BancorOracle.new();
        await bancorOracle.setRcn(rcn.address);
        await bancorOracle.addCurrencyConverter('bnt', bnt.address, converter.address);
        const bntCurrency = await bancorOracle.encodeCurrency('bnt');

        const loanId = (await Helper.toEvent(
            rcnEngine.createLoan(
                bancorOracle.address, // Contract of the oracle
                borrower, // Borrower of the loan (caller of this method)
                bntCurrency, // Currency of the loan, bnt
                web3.toWei(500), // Requested 500 RCN
                Helper.toInterestRate(20), // interest rate
                Helper.toInterestRate(30), // punitory interest rate
                bn(86400).mul(bn(90)), // Duration of the loan, 6 months
                bn(0), // Payment can start right away
                bn(10).pow(bn(40)), // This request never expires
                'Loan with emoji 🦓 :)'
            ),
            'CreatedLoan'
        ))._index;

        const ethAddress = await converterRamp.ETH_ADDRESS();

        const lendLoanParams = [
            Helper.toBytes32(rcnEngine.address),
            Helper.toBytes32(loanId),
            Helper.toBytes32(Helper.address0x),
        ];

        const convertParams = [
            bn(1000001),
            bn(0),
            bn(10).pow(bn(9)),
        ];

        let sendEth = await converterRamp.requiredLendSell.call(
            bancorProxy.address,
            ethAddress,
            lendLoanParams,
            [],
            [],
            convertParams
        );

        await converterRamp.lend(
            bancorProxy.address,
            ethAddress,
            lendLoanParams,
            [],
            [],
            convertParams,
            { from: lender, value: sendEth }
        );

        (await bnt.balanceOf(converterRamp.address)).should.be.bignumber.equal(bn(0));
        (await rcn.balanceOf(converterRamp.address)).should.be.bignumber.equal(bn(0));
        assert.equal(await rcnEngine.ownerOf(loanId), lender);

        const payLoanParams = [
            Helper.toBytes32(rcnEngine.address),
            Helper.toBytes32(loanId),
            Helper.toBytes32(toWei(100)),
            Helper.toBytes32(payer),
        ];

        sendEth = await converterRamp.requiredPaySell.call(
            bancorProxy.address,
            ethAddress,
            payLoanParams,
            [],
            convertParams
        );

        await converterRamp.pay(
            bancorProxy.address,
            ethAddress,
            payLoanParams,
            [],
            convertParams,
            { from: payer, value: sendEth }
        );

        (await bnt.balanceOf(converterRamp.address)).should.be.bignumber.equal(bn(0));
        (await rcn.balanceOf(converterRamp.address)).should.be.bignumber.equal(bn(0));
        assert.equal(await rcnEngine.ownerOf(loanId), lender);
    });
});
