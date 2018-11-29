const TestToken = artifacts.require('./vendors/rcn/TestToken.sol');
// Engine
const NanoLoanEngine = artifacts.require('./vendors/rcn/NanoLoanEngine.sol');
// Kyber network
const KyberOracle = artifacts.require('./vendors/rcn/KyberOracle.sol');
const KyberNetworkProxy = artifacts.require('./vendors/kyber/KyberNetworkProxy.sol');
const KyberProxy = artifacts.require('./KyberProxy.sol');

const ConverterRamp = artifacts.require('./ConverterRamp.sol');

const Helper = require('../Helper.js');
// const Web3Utils = require('web3-utils');
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

contract('ConverterRamp', function (accounts) {
    const manaCurrency = '0x4d414e4100000000000000000000000000000000000000000000000000000000';
    let engine;
    let converterRamp;
    let kyberProxy;
    let kyberNetworkProxy;
    let kyberOracle;

    // tokens
    let rcn;
    let mana;

    before('Deploy Tokens, Kyber, Converter', async function () {
        mana = await TestToken.new('MANA', 'MANA', bn('18'), '1.0', bn('6000'));
        rcn = await TestToken.new('RCN', 'RCN', bn('18'), '1.1', bn('4000'));
        engine = await NanoLoanEngine.new(rcn.address);
        converterRamp = await ConverterRamp.new();

        kyberNetworkProxy = await KyberNetworkProxy.new(accounts[9], mana.address, rcn.address);
        await kyberNetworkProxy.setExpectedRate(bn('1'));
        await kyberNetworkProxy.setSlippageRate(bn('1'));
        await kyberNetworkProxy.setAmount(bn('500'));

        kyberProxy = await KyberProxy.new(kyberNetworkProxy.address);
        kyberOracle = await KyberOracle.new();

        await kyberOracle.setRcn(rcn.address);
        await kyberOracle.setKyber(kyberProxy.address);
        await kyberOracle.addCurrencyLink('MANA', mana.address, bn('18'));

        assert.equal(await kyberOracle.tickerToToken(manaCurrency), mana.address);
    });

    it('Should lend and pay using the ramp (Kyber) rcn -> mana', async () => {
        const borrower = accounts[2];
        const lender = accounts[3];
        const payer = accounts[4];
        const amount = bn('10000');

        await mana.createTokens(kyberNetworkProxy.address, amount);
        await rcn.createTokens(kyberNetworkProxy.address, amount);
        // Create a random loan
        await engine.createLoan(
            0x0, // Contract of the oracle
            borrower, // Borrower of the loan (caller of this method)
            0x0, // Currency of the loan is RCN
            amount, // Requested RCN
            bn('20'),
            bn('30'),
            bn('86400').mulbn('90'), // Duration of the loan, 6 months
            bn('0'), // Payment can start right away
            bn('10000000000000000000000000000000000000000'), // This request never expires
            'Loan with emoji 🦓 :)'
        );

        const loanId = 1;

        await mana.createTokens(lender, amount);
        await mana.approve(converterRamp.address, amount, { from: lender });

        const lendLoanParams = [
            Helper.toBytes32(engine.address),
            Helper.toBytes32(loanId.toString(16)),
            Helper.toBytes32(0x0),
        ];

        const convertParams = [
            bn('50'),
            bn('0'),
            bn('0'),
        ];

        await converterRamp.lend(
            kyberProxy.address,
            mana.address,
            lendLoanParams,
            [],
            [],
            convertParams,
            { from: lender }
        );

        assert.equal(await mana.balanceOf(converterRamp.address), 0);
        assert.equal(await rcn.balanceOf(converterRamp.address), 0);
        assert.equal(await engine.ownerOf(loanId), lender);

        await mana.createTokens(payer, amount);
        await mana.approve(converterRamp.address, amount, { from: payer });

        const payLoanParams = [
            Helper.toBytes32(engine.address),
            Helper.toBytes32(loanId.toString(16)),
            Helper.toBytes32((amount).toString(16)),
            Helper.toBytes32(payer),
        ];

        await converterRamp.pay(
            kyberProxy.address,
            mana.address,
            payLoanParams,
            [],
            convertParams,
            { from: payer }
        );
    });
});
