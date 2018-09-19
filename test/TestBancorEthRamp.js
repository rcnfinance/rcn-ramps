const BancorNetwork = artifacts.require      ('./vendors/bancor/BancorNetwork.sol');
const ContractIds = artifacts.require        ('./vendors/bancor/ContractIds.sol');
const BancorConverter = artifacts.require    ('./vendors/bancor/converter/BancorConverter.sol');
const BancorFormula = artifacts.require      ('./vendors/bancor/converter/BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('./vendors/bancor/converter/BancorGasPriceLimit.sol');
const SmartToken = artifacts.require         ('./vendors/bancor/token/SmartToken.sol');
const TestERC20Token = artifacts.require     ('./vendors/bancor/token/TestERC20Token.sol');
const EtherToken = artifacts.require         ('./vendors/bancor/token/EtherToken.sol');
const ContractRegistry = artifacts.require   ('./vendors/bancor/utility/ContractRegistry.sol');
const ContractFeatures = artifacts.require   ('./vendors/bancor/utility/ContractFeatures.sol');

const NanoLoanEngine = artifacts.require('./vendors/rcn/NanoLoanEngine.sol');
const BancorOracle = artifacts.require  ('./vendors/rcn/BancorOracle.sol');
const TestCosigner = artifacts.require  ('./vendors/rcn/TestCosigner.sol');

const TestToken = artifacts.require('./vendors/TestToken.sol');

const ConverterRamp = artifacts.require('./ConverterRamp.sol');
const BancorProxy = artifacts.require('./BancorProxy.sol');

//global variables
//////////////////
const gasPrice = 10 ** 18;

let rcnEngine;
let converterRamp;
let bancorProxy;

// bancor converters
let converter;
// tokens tokens
let eth;
let rcn;
let bnt;
let smartToken;

// accounts
let borrower;
let lender;
let signer;
let payer;

contract('ConverterRampEth', function(accounts) {
    beforeEach("Deploy Tokens, Bancor, Converter, Ramp", async function(){
        // set accounts address;
        borrower = accounts[0];
        lender = accounts[1];
        payer = accounts[2];
        signer = accounts[3];
        // Deploy BNT token
        bnt = await SmartToken.new("Not-Bancor Token", "BNT", 18);

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

        // Issue BNT Tokens
        await bnt.issue(accounts[0], 6500000 * 10 **18);

        // converter RCN-BNT
        smartToken = await SmartToken.new('RCN BNT Token', 'RCN-BNT', 18);
        await smartToken.issue(borrower, 6500000 * 10 **18);
        converter = await BancorConverter.new(smartToken.address, contractRegistry.address, 0, rcn.address, 250000);
        await converter.addConnector(bnt.address, 250000, false);
        await smartToken.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();
        await rcn.createTokens(converter.address, 2500000 * 10 **18);
        await bnt.transfer(converter.address, 3000000 * 10 **18);
        // converter BNT-ETH
        // smartTokenEth = await SmartToken.new('ETH BNT Token', 'ETH-BNT', 18);
        ethToken = await EtherToken.new();
        await bancorNetwork.registerEtherToken(ethToken.address, true);
        converterEth = await BancorConverter.new(bnt.address, contractRegistry.address, 0, ethToken.address, 100000);
        await bnt.transferOwnership(converterEth.address);
        await converterEth.acceptTokenOwnership();
        // await converterEth.addConnector(ethToken.address, 250000, false);
        // // await smartTokenEth.transferOwnership(converterEth.address);
        // // await converterEth.acceptTokenOwnership();
        // // add balance
        await bnt.transfer(converterEth.address, 3000000 * 10 **18);
        await ethToken.deposit({ value: web3.toWei(10), from: accounts[8] });
        await ethToken.transfer(converterEth.address, web3.toWei(10), {from: accounts[8]});
        // // Deploy ramp
        converterRamp = await ConverterRamp.new();
        // Deploy proxy
        bancorProxy = await BancorProxy.new(ethToken.address);
        await bancorProxy.setConverter(bnt.address, rcn.address, converter.address);
        await bancorProxy.setConverter(bnt.address, ethToken.address, converterEth.address);
        await bancorProxy.setRouter(rcn.address, ethToken.address, bnt.address);
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
        const eth_address = await converterRamp.ETH_ADDRESS();

        const lendLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32(0x0)
        ]

        const convertParams = [
            1000001,
            0,
            10 ** 9
        ]

        let sendEth = await converterRamp.requiredLendSell(
            bancorProxy.address,
            eth_address,
            lendLoanParams,
            [],
            [],
            convertParams
        );

        sendEth = sendEth;

        await converterRamp.lend(
            bancorProxy.address,
            eth_address,
            lendLoanParams,
            [],
            [],
            convertParams,
            {
                from: lender,
                value: sendEth
            }
        );

        assert.equal(await bnt.balanceOf(converterRamp.address), 0);
        assert.equal((await rcn.balanceOf(converterRamp.address)).toFixed(0), 0);
        assert.equal(await rcnEngine.ownerOf(loanId), lender);

        const payLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32((100 * 10 ** 18).toString(16)),
            toBytes32(payer)
        ]

        sendEth = await converterRamp.requiredPaySell(
            bancorProxy.address,
            eth_address,
            payLoanParams,
            [],
            convertParams
        );

        await converterRamp.pay(
            bancorProxy.address,
            eth_address,
            payLoanParams,
            [],
            convertParams,
            {
                from: payer,
                value: sendEth
            }
        );
    });
    it("Should lend and pay using the ramp + oracle", async() => {
        const bancorOracle = await BancorOracle.new();
        await bancorOracle.setRcn(rcn.address);
        await bancorOracle.addCurrencyConverter("bnt", bnt.address, converter.address);
        const bntCurrency = await bancorOracle.encodeCurrency("bnt");

        // Create a random loan
        let loanReceipt = await rcnEngine.createLoan(
            bancorOracle.address, // Contract of the oracle
            borrower, // Borrower of the loan (caller of this method)
            bntCurrency, // Currency of the loan, bnt
            web3.toWei(500), // Requested 500 bnt
            20,
            30,
            86400 * 90, // Duration of the loan, 6 months
            0, // Payment can start right away
            10 ** 40, // This request never expires
            "Loan with emoji 🦓 :)"
        );

        let loanId = 1;
        const eth_address = await converterRamp.ETH_ADDRESS();

        const lendLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32(0x0)
        ]

        const convertParams = [
            1000001,
            0,
            10 ** 9
        ]

        let sendEth = await converterRamp.requiredLendSell(
            bancorProxy.address,
            eth_address,
            lendLoanParams,
            [],
            [],
            convertParams
        );

        sendEth = sendEth;

        await converterRamp.lend(
            bancorProxy.address,
            eth_address,
            lendLoanParams,
            [],
            [],
            convertParams,
            {
                from: lender,
                value: sendEth
            }
        );

        assert.equal(await bnt.balanceOf(converterRamp.address), 0);
        assert.equal((await rcn.balanceOf(converterRamp.address)).toFixed(0), 0);
        assert.equal(await rcnEngine.ownerOf(loanId), lender);

        const payLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32((100 * 10 ** 18).toString(16)),
            toBytes32(payer)
        ]

        sendEth = await converterRamp.requiredPaySell(
            bancorProxy.address,
            eth_address,
            payLoanParams,
            [],
            convertParams
        );

        await converterRamp.pay(
            bancorProxy.address,
            eth_address,
            payLoanParams,
            [],
            convertParams,
            {
                from: payer,
                value: sendEth
            }
        );
    })

    it("Should lend and pay using the ramp + oracle + cosigner", async() => {
        const bancorOracle = await BancorOracle.new();
        await bancorOracle.setRcn(rcn.address);
        await bancorOracle.addCurrencyConverter("bnt", bnt.address, converter.address);
        const bntCurrency = await bancorOracle.encodeCurrency("bnt");

        const testCosigner = await TestCosigner.new();

        // Create a random loan
        let loanReceipt = await rcnEngine.createLoan(
            bancorOracle.address, // Contract of the oracle
            borrower, // Borrower of the loan (caller of this method)
            bntCurrency, // Currency of the loan, bnt
            web3.toWei(500), // Requested 500 bnt
            20,
            30,
            86400 * 90, // Duration of the loan, 6 months
            0, // Payment can start right away
            10 ** 40, // This request never expires
            "Loan with emoji 🦓 :)"
        );

        let loanId = 1;
        const eth_address = await converterRamp.ETH_ADDRESS();

        const lendLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32(0x0)
        ]

        const convertParams = [
            1000001,
            0,
            10 ** 9
        ]

        let sendEth = await converterRamp.requiredLendSell(
            bancorProxy.address,
            eth_address,
            lendLoanParams,
            [],
            [],
            convertParams
        );

        sendEth = sendEth;

        await converterRamp.lend(
            bancorProxy.address,
            eth_address,
            lendLoanParams,
            [],
            [],
            convertParams,
            {
                from: lender,
                value: sendEth
            }
        );

        assert.equal(await bnt.balanceOf(converterRamp.address), 0);
        assert.equal((await rcn.balanceOf(converterRamp.address)).toFixed(0), 0);
        assert.equal(await rcnEngine.ownerOf(loanId), lender);

        const payLoanParams = [
            toBytes32(rcnEngine.address),
            toBytes32(loanId.toString(16)),
            toBytes32((100 * 10 ** 18).toString(16)),
            toBytes32(payer)
        ]

        sendEth = await converterRamp.requiredPaySell(
            bancorProxy.address,
            eth_address,
            payLoanParams,
            [],
            convertParams
        );

        await converterRamp.pay(
            bancorProxy.address,
            eth_address,
            payLoanParams,
            [],
            convertParams,
            {
                from: payer,
                value: sendEth
            }
        );

        assert.equal(await bnt.balanceOf(converterRamp.address), 0);
        assert.equal(await rcn.balanceOf(converterRamp.address), 0);
        assert.equal(await rcnEngine.ownerOf(loanId), lender);
    })
})
//
