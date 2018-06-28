const BancorNetwork = artifacts.require      ('./test/bancor/BancorNetwork.sol');
const ContractIds = artifacts.require        ('./test/bancor/ContractIds.sol');
const BancorConverter = artifacts.require    ('./test/bancor/converter/BancorConverter.sol');
const BancorFormula = artifacts.require      ('./test/bancor/converter/BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('./test/bancor/converter/BancorGasPriceLimit.sol');
const SmartToken = artifacts.require         ('./test/bancor/token/SmartToken.sol');
const TestERC20Token = artifacts.require     ('./test/bancor/token/TestERC20Token.sol');
const EtherToken = artifacts.require         ('./test/bancor/token/EtherToken.sol');
const ContractRegistry = artifacts.require   ('./test/bancor/utility/ContractRegistry.sol');
const ContractFeatures = artifacts.require   ('./test/bancor/utility/ContractFeatures.sol');

const NanoLoanEngine = artifacts.require('./test/rcn/NanoLoanEngine.sol');
const BancorOracle = artifacts.require  ('./test/rcn/BancorOracle.sol');
const TestCosigner = artifacts.require  ('./test/rcn/TestCosigner.sol');

const TestToken = artifacts.require('./test/TestToken.sol');

const ConverterRamp = artifacts.require('./ConverterRamp.sol');

//global variables
//////////////////
const gasPrice = 10 ** 18;

let rcnEngine;
let converterRamp;

// bancor converters
let converter1;

// tokens tokens
let rcn;
let tico;
let smartToken1;

// accounts
let borrower;
let lender;
let signer;
let payer;

contract('ConverterRamp', function(accounts) {
    beforeEach("Deploy Tokens, Bancor, Converter, Ramp", async function(){
        // set accounts address;
        borrower = accounts[0];
        lender = accounts[1];
        payer = accounts[2];
        signer = accounts[3];
        // Deploy TICO token
        tico = await TestToken.new("Tomato inflammable coal ornaments Token", "TICO", 18, "1.0", 6000);
        // Deploy RCN token
        rcn = await TestToken.new("Ripio Credit Network", "RCN", 18, "1.1", 4000);
        // Deploy RCN Engine
        rcnEngine = await NanoLoanEngine.new(rcn.address);

        // Deploy Bancor as example
        let contractRegistry = await ContractRegistry.new();
        let contractIds = await ContractIds.new();

        let contractFeatures = await ContractFeatures.new();
        let contractFeaturesId = await contractIds.CONTRACT_FEATURES.call();
        await contractRegistry.registerAddress(contractFeaturesId, contractFeatures.address);

        let gasPriceLimit = await BancorGasPriceLimit.new(gasPrice);
        let gasPriceLimitId = await contractIds.BANCOR_GAS_PRICE_LIMIT.call();
        await contractRegistry.registerAddress(gasPriceLimitId, gasPriceLimit.address);

        let formula = await BancorFormula.new();
        let formulaId = await contractIds.BANCOR_FORMULA.call();
        await contractRegistry.registerAddress(formulaId, formula.address);

        let bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        let bancorNetworkId = await contractIds.BANCOR_NETWORK.call();
        await contractRegistry.registerAddress(bancorNetworkId, bancorNetwork.address);
        await bancorNetwork.setSignerAddress(signer);
        // converter1 RCN-TICO
        smartToken1 = await SmartToken.new('RCN TICO Token', 'RCNTICO', 18);
        await smartToken1.issue(borrower, 6500000 * 10 **18);
        converter1 = await BancorConverter.new(smartToken1.address, contractRegistry.address, 0, rcn.address, 250000);
        await converter1.addConnector(tico.address, 250000, false);
        await smartToken1.transferOwnership(converter1.address);
        await converter1.acceptTokenOwnership();
        // add balance
        await rcn.createTokens(converter1.address, 2500000 * 10 **18);
        await tico.createTokens(converter1.address, 6500000 * 10 **18);
        // Deploy ramp
        converterRamp = await ConverterRamp.new();
    });

    function toBytes32(source) {
        const rl = 64;
        source = source.toString().replace("0x", "");
        if (source.length < rl) {
            const diff = 64 - source.length;
            source = "0".repeat(diff) + source;
        }
        return "0x" + source;
    }

    it("Should lend and pay using the ramp", async() => {
        // Create a random loan
        let loanReceipt = await rcnEngine.createLoan(
            0x0, // Contract of the oracle
            borrower, // Borrower of the loan (caller of this method)
            0x0, // Currency of the loan is RCN
            web3.toWei(500), // Requested 500 RCN
            20,
            30,
            86400 * 90, // Duration of the loan, 6 months
            0, // Payment can start right away
            10 ** 40, // This request never expires
            "Loan with emoji 🦓 :)"
        );

        let loanId = 1;

        await tico.createTokens(lender, 10000 * 10 ** 18);
        await tico.approve(converterRamp.address, 10000 * 10 ** 18, {from:lender});

        const lendLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32(0x0)
        ]

        const convertParams = [
            50,
            0,
            0
        ]

        console.log(await converterRamp.lend(
            converter1.address,
            tico.address,
            lendLoanParams,
            [],
            [],
            convertParams,
            {
                from: lender
            }
        ));

        assert.equal(await tico.balanceOf(converterRamp.address), 0);
        assert.equal(await rcn.balanceOf(converterRamp.address), 0);
        assert.equal(await rcnEngine.ownerOf(loanId), lender);

        await tico.createTokens(payer, 10000 * 10 ** 18);
        await tico.approve(converterRamp.address, 10000 * 10 ** 18, {from:payer});

        const payLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32((100 * 10 ** 18).toString(16)),
            toBytes32(payer)
        ]

        await converterRamp.pay(
            converter1.address,
            tico.address,
            payLoanParams,
            [],
            convertParams,
            {
                from: payer
            }
        );
    })

    it("Should lend and pay using the ramp + oracle", async() => {
        const bancorOracle = await BancorOracle.new();
        await bancorOracle.setRcn(rcn.address);
        await bancorOracle.addCurrencyConverter("TICO", tico.address, converter1.address);
        const ticoCurrency = await bancorOracle.encodeCurrency("TICO");

        // Create a random loan
        let loanReceipt = await rcnEngine.createLoan(
            bancorOracle.address, // Contract of the oracle
            borrower, // Borrower of the loan (caller of this method)
            ticoCurrency, // Currency of the loan, TICO
            web3.toWei(500), // Requested 500 TICO
            20,
            30,
            86400 * 90, // Duration of the loan, 6 months
            0, // Payment can start right away
            10 ** 40, // This request never expires
            "Loan with emoji 🦓 :)"
        );

        let loanId = 1;

        await tico.createTokens(lender, 10000 * 10 ** 18);
        await tico.approve(converterRamp.address, 10000 * 10 ** 18, {from:lender});

        const lendLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32(0x0)
        ]

        const convertParams = [
            200,
            0,
            0
        ]

        console.log(await converterRamp.lend(
            converter1.address,
            tico.address,
            lendLoanParams,
            [],
            [],
            convertParams,
            {
                from: lender
            }
        ));

        assert.equal(await tico.balanceOf(converterRamp.address), 0);
        assert.equal(await rcn.balanceOf(converterRamp.address), 0);
        assert.equal(await rcnEngine.ownerOf(loanId), lender);

        await tico.createTokens(payer, 10000 * 10 ** 18);
        await tico.approve(converterRamp.address, 10000 * 10 ** 18, {from:payer});

        const payLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32((100 * 10 ** 18).toString(16)),
            toBytes32(payer)
        ]

        await converterRamp.pay(
            converter1.address,
            tico.address,
            payLoanParams,
            [],
            convertParams,
            {
                from: payer
            }
        );
    })

    it("Should lend and pay using the ramp + oracle + cosigner", async() => {
        const bancorOracle = await BancorOracle.new();
        await bancorOracle.setRcn(rcn.address);
        await bancorOracle.addCurrencyConverter("TICO", tico.address, converter1.address);
        const ticoCurrency = await bancorOracle.encodeCurrency("TICO");

        const testCosigner = await TestCosigner.new();

        // Create a random loan
        let loanReceipt = await rcnEngine.createLoan(
            bancorOracle.address, // Contract of the oracle
            borrower, // Borrower of the loan (caller of this method)
            ticoCurrency, // Currency of the loan, TICO
            web3.toWei(500), // Requested 500 TICO
            20,
            30,
            86400 * 90, // Duration of the loan, 6 months
            0, // Payment can start right away
            10 ** 40, // This request never expires
            "Loan with emoji 🦓 :)"
        );

        let loanId = 1;

        await tico.createTokens(lender, 10000 * 10 ** 18);
        await tico.approve(converterRamp.address, 10000 * 10 ** 18, {from:lender});

        const lendLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32(testCosigner.address)
        ]

        const convertParams = [
            200,
            0,
            0
        ]

        console.log(await converterRamp.lend(
            converter1.address,
            tico.address,
            lendLoanParams,
            [],
            [],
            convertParams,
            {
                from: lender
            }
        ));

        assert.equal(await tico.balanceOf(converterRamp.address), 0);
        assert.equal(await rcn.balanceOf(converterRamp.address), 0);
        assert.equal(await rcnEngine.ownerOf(loanId), lender);
    })
})
