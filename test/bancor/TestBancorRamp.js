const BancorNetwork = artifacts.require('./vendors/bancor/BancorNetwork.sol');
const ContractIds = artifacts.require('./vendors/bancor/ContractIds.sol');
const BancorConverter = artifacts.require('./vendors/bancor/converter/BancorConverter.sol');
const BancorFormula = artifacts.require('./vendors/bancor/converter/BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('./vendors/bancor/converter/BancorGasPriceLimit.sol');
const SmartToken = artifacts.require('./vendors/bancor/token/SmartToken.sol');
// const TestERC20Token = artifacts.require('./vendors/bancor/token/TestERC20Token.sol');
// const EtherToken = artifacts.require('./vendors/bancor/token/EtherToken.sol');
const ContractRegistry = artifacts.require('./vendors/bancor/utility/ContractRegistry.sol');
const ContractFeatures = artifacts.require('./vendors/bancor/utility/ContractFeatures.sol');

const NanoLoanEngine = artifacts.require('./vendors/rcn/NanoLoanEngine.sol');
const BancorOracle = artifacts.require('./vendors/rcn/BancorOracle.sol');
const TestCosigner = artifacts.require('./vendors/rcn/TestCosigner.sol');

const TestToken = artifacts.require('./vendors/rcn/TestToken.sol');

const ConverterRamp = artifacts.require('./ConverterRamp.sol');
const BancorProxy = artifacts.require('./BancorProxy.sol');

// global variables
/// ///////////////
const gasPrice = 10 ** 18;

let rcnEngine;
let converterRamp;
let bancorProxy;

// bancor converters
let converter;
// tokens tokens
// let eth;
let rcn;
let tico;
let smartToken;

// accounts
let borrower;
let lender;
let signer;
let payer;

contract('ConverterRamp', function (accounts) {
    beforeEach('Deploy Tokens, Bancor, Converter, Ramp', async function () {
        // set accounts address;
        borrower = accounts[0];
        lender = accounts[1];
        payer = accounts[2];
        signer = accounts[3];
        // Deploy TICO token
        tico = await TestToken.new('Tomato inflammable coal ornaments Token', 'TICO', 18, '1.0', 6000);
        // Deploy RCN token
        rcn = await TestToken.new('Ripio Credit Network', 'RCN', 18, '1.1', 4000);
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

        // converter RCN-TICO
        smartToken = await SmartToken.new('RCN TICO Token', 'RCNTICO', 18);
        await smartToken.issue(borrower, 6500000 * 10 ** 18);
        converter = await BancorConverter.new(smartToken.address, contractRegistry.address, 0, rcn.address, 250000);
        await converter.addConnector(tico.address, 250000, false);
        await smartToken.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        // add balance
        await rcn.createTokens(converter.address, 2500000 * 10 ** 18);
        await tico.createTokens(converter.address, 6500000 * 10 ** 18);
        // await eth.deposit({ value: web3.toWei(1) });
        // Deploy ramp
        converterRamp = await ConverterRamp.new();
        // Deploy proxy
        bancorProxy = await BancorProxy.new(0x0);
        await bancorProxy.setConverter(rcn.address, tico.address, converter.address);
    });

    function toBytes32 (source) {
        const rl = 64;
        source = source.toString().replace('0x', '');
        if (source.length < rl) {
            const diff = 64 - source.length;
            source = '0'.repeat(diff) + source;
        }
        return '0x' + source;
    }

    it('Should lend and pay using the ramp (Bancor)', async () => {
        // Create a random loan
        await rcnEngine.createLoan(
            0x0, // Contract of the oracle
            borrower, // Borrower of the loan (caller of this method)
            0x0, // Currency of the loan is RCN
            web3.toWei(500), // Requested 500 RCN
            20,
            30,
            86400 * 90, // Duration of the loan, 6 months
            0, // Payment can start right away
            10 ** 40, // This request never expires
            'Loan with emoji 🦓 :)'
        );

        const loanId = 1;

        await tico.createTokens(lender, 10000 * 10 ** 18);
        await tico.approve(converterRamp.address, 10000 * 10 ** 18, { from: lender });

        const lendLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32(0x0),
        ];

        const convertParams = [
            50,
            0,
            0,
        ];

        await converterRamp.lend(
            bancorProxy.address,
            tico.address,
            lendLoanParams,
            [],
            [],
            convertParams,
            {
                from: lender,
            }
        );

        assert.equal(await tico.balanceOf(converterRamp.address), 0);
        assert.equal(await rcn.balanceOf(converterRamp.address), 0);
        assert.equal(await rcnEngine.ownerOf(loanId), lender);

        await tico.createTokens(payer, 10000 * 10 ** 18);
        await tico.approve(converterRamp.address, 10000 * 10 ** 18, { from: payer });

        const payLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32((100 * 10 ** 18).toString(16)),
            toBytes32(payer),
        ];

        await converterRamp.pay(
            converter.address,
            tico.address,
            payLoanParams,
            [],
            convertParams,
            {
                from: payer,
            }
        );
    });

    it('Should lend and pay using the ramp + oracle', async () => {
        const bancorOracle = await BancorOracle.new();
        await bancorOracle.setRcn(rcn.address);
        await bancorOracle.addCurrencyConverter('TICO', tico.address, converter.address);
        const ticoCurrency = await bancorOracle.encodeCurrency('TICO');

        // Create a random loan
        await rcnEngine.createLoan(
            bancorOracle.address, // Contract of the oracle
            borrower, // Borrower of the loan (caller of this method)
            ticoCurrency, // Currency of the loan, TICO
            web3.toWei(500), // Requested 500 TICO
            2000000,
            3000000,
            86400 * 90, // Duration of the loan, 6 months
            0, // Payment can start right away
            10 ** 40, // This request never expires
            'Loan with emoji 🦓 :)'
        );

        const loanId = 1;

        await tico.createTokens(lender, 10000 * 10 ** 18);
        await tico.approve(converterRamp.address, 10000 * 10 ** 18, { from: lender });

        const lendLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32(0x0),
        ];

        let convertParams = [
            50,
            0,
            0,
        ];

        await converterRamp.lend(
            converter.address,
            tico.address,
            lendLoanParams,
            [],
            [],
            convertParams,
            {
                from: lender,
            }
        );

        assert.equal(await tico.balanceOf(converterRamp.address), 0);
        assert.equal(await rcn.balanceOf(converterRamp.address), 0);
        assert.equal(await rcnEngine.ownerOf(loanId), lender);

        await tico.createTokens(payer, 10000 * 10 ** 18);
        await tico.approve(converterRamp.address, 10000 * 10 ** 18, { from: payer });

        let payLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32((100 * 10 ** 18).toString(16)),
            toBytes32(payer),
        ];

        await converterRamp.pay(
            converter.address,
            tico.address,
            payLoanParams,
            [],
            convertParams,
            {
                from: payer,
            }
        );

        // Pay the total amount of the loan
        web3.currentProvider.send({ jsonrpc: '2.0', method: 'evm_increaseTime', params: [10], id: 0 });

        let pending = (await rcnEngine.getPendingAmount.call(loanId)) * 5.05;

        payLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32((pending).toString(16)),
            toBytes32(payer),
        ];

        convertParams = [
            50,
            // 0,
            ((pending) * (100000 + 50)) / 100000,
            0,
        ];

        await converterRamp.pay(
            converter.address,
            tico.address,
            payLoanParams,
            [],
            convertParams,
            {
                from: payer,
            }
        );

        try {
            pending = await rcnEngine.getPendingAmount.call(loanId);
            assert.equal(pending.toFixed(0), 0);
        } catch (e) {
            assert.equal(false, true);
        }
    });

    it('Should lend and pay using the ramp + oracle + cosigner', async () => {
        const bancorOracle = await BancorOracle.new();
        await bancorOracle.setRcn(rcn.address);
        await bancorOracle.addCurrencyConverter('TICO', tico.address, converter.address);
        const ticoCurrency = await bancorOracle.encodeCurrency('TICO');

        const testCosigner = await TestCosigner.new();

        // Create a random loan
        await rcnEngine.createLoan(
            bancorOracle.address, // Contract of the oracle
            borrower, // Borrower of the loan (caller of this method)
            ticoCurrency, // Currency of the loan, TICO
            web3.toWei(500), // Requested 500 TICO
            20,
            30,
            86400 * 90, // Duration of the loan, 6 months
            0, // Payment can start right away
            10 ** 40, // This request never expires
            'Loan with emoji 🦓 :)'
        );

        const loanId = 1;

        await tico.createTokens(lender, 10000 * 10 ** 18);
        await tico.approve(converterRamp.address, 10000 * 10 ** 18, { from: lender });

        const lendLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32(testCosigner.address),
        ];

        const convertParams = [
            200,
            0,
            0,
        ];

        await converterRamp.lend(
            converter.address,
            tico.address,
            lendLoanParams,
            [],
            [],
            convertParams,
            {
                from: lender,
            }
        );

        assert.equal(await tico.balanceOf(converterRamp.address), 0);
        assert.equal(await rcn.balanceOf(converterRamp.address), 0);
        assert.equal(await rcnEngine.ownerOf(loanId), lender);
    });
});
