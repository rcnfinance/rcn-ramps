let ConversionRates = artifacts.require("./ConversionRates.sol");
let TestToken = artifacts.require("./utils/test/TestToken.sol");
let Reserve = artifacts.require("./KyberReserve.sol");
let Network = artifacts.require("./KyberNetwork.sol");
let WhiteList = artifacts.require("./WhiteList.sol");
let ExpectedRate = artifacts.require("./ExpectedRate.sol");
let FeeBurner = artifacts.require("./FeeBurner.sol");
let KyberGateway = artifacts.require("./KyberGateway.sol");
let NanoLoanEngine = artifacts.require("./NanoLoanEngine.sol");
let TestOracle = artifacts.require("./TestOracle.sol");

let Helper = require("./helper.js");
let BigNumber = require('bignumber.js');

//global variables
//////////////////
let precisionUnits = new BigNumber(10).pow(18);
let highNumber = new BigNumber(10).pow(50);
let ethAddress = '0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const gasPrice = precisionUnits;
let negligibleRateDiff = 15;

//permission groups
let admin;
let operator;
let alerter;
let sanityRates;
let lender;
let borrower;

//contracts
let pricing;
let reserve;
let whiteList;
let expectedRate;
let network;
let feeBurner;
let kyberGate;
let engine;
let oracle;

//block data
let priceUpdateBlock;
let currentBlock;
let validRateDurationInBlocks = 5000;

//tokens data
////////////
let rcnToken;

// imbalance data
let minimalRecordResolution = 2; //low resolution so I don't lose too much data. then easier to compare calculated imbalance values.
let maxPerBlockImbalance = 4000;
let maxTotalImbalance = maxPerBlockImbalance * 12;

// all price steps in bps (basic price steps).
// 100 bps means rate change will be: price * (100 + 10000) / 10000 == raise rate in 1%
// higher rate is better for user. will get more dst quantity for his tokens.
// all x values represent token imbalance. y values represent equivalent steps in bps.
// buyImbalance represents coin shortage. higher buy imbalance = more tokens were bought.
// generally. speaking, if imbalance is higher we want to have:
//      - smaller buy bps (negative) to lower rate when buying token with ether.
//      - bigger sell bps to have higher rate when buying ether with token.
////////////////////

//quantity and imbalance buy steps
let qtyBuyStepX = [-1400, -700, -150, 0, 100, 350, 700,  1400];
qtyBuyStepX = qtyBuyStepX.map(x => new BigNumber(x).mul(precisionUnits));// Wei to Token
let qtyBuyStepY = [ 1000,   75,   25, 0,  0, -70, -160, -3000];
let imbalanceBuyStepX = [-8500, -2800, -1500, 0, 1500, 2800,  4500];
imbalanceBuyStepX = imbalanceBuyStepX.map(x => new BigNumber(x).mul(precisionUnits));// Wei to Token
let imbalanceBuyStepY = [ 1300,   130,    43, 0,   0,  -110, -1600];
//sell
//sell price will be 1 / buy (assuming no spread) so sell is actually buy price in other direction
let qtySellStepX = [-1400, -700, -150, 0, 150, 350, 700, 1400];
qtySellStepX = qtySellStepX.map(x => new BigNumber(x).mul(precisionUnits));// Wei to Token
let qtySellStepY = [-300,   -80,  -15, 0,   0, 120, 170, 3000];

//sell imbalance step
let imbalanceSellStepX = [-8500, -2800, -1500, 0, 1500, 2800,  4500];
imbalanceSellStepX = imbalanceSellStepX.map(x => new BigNumber(x).mul(precisionUnits));// Wei to Token
let imbalanceSellStepY = [-1500,  -320,   -75, 0,    0,  110,   650];


//compact data.
let sells = [];
let buys = [];
let indices = [];
let compactBuyArr = [];
let compactSellArr = [];

//buy is ether to token rate. sale is token to ether rate. so sell == 1 / buy. assuming we have no spread.
let ethersToToken = new BigNumber(5000).mul(precisionUnits)
let tokensToEther = new BigNumber(0.0002).mul(precisionUnits);

contract('KyberGateway', function(accounts) {
    async function assertThrow(promise) {
        try {
          await promise;
        } catch (error) {
          const invalidJump = error.message.search('invalid JUMP') >= 0;
          const revert = error.message.search('revert') >= 0;
          const invalidOpcode = error.message.search('invalid opcode') >0;
          const outOfGas = error.message.search('out of gas') >= 0;
          assert(
            invalidJump || outOfGas || revert || invalidOpcode,
            "Expected throw, got '" + error + "' instead",
          );
          return;
        }
        assert.fail('Expected throw not received');
    };

    beforeEach("Deploy Tokens, Engine, Kyber", async function(){
        // set account addresses
        admin        = accounts[0];
        operator     = accounts[1];
        alerter      = accounts[2];
        helpBorrower = accounts[3];
        lender       = accounts[4];
        borrower     = accounts[5];

        currentBlock = priceUpdateBlock = await Helper.getCurrentBlock();

        //init contracts
        pricing = await ConversionRates.new(admin, {});

        //set pricing general parameters
        await pricing.setValidRateDurationInBlocks(validRateDurationInBlocks, {from:admin});

        //create and add token addresses...
        rcnToken = await TestToken.new("Ripio Credit Network", "RCN", 18);
        await pricing.addToken(rcnToken.address, {from:admin});
        await pricing.setTokenControlInfo(rcnToken.address, minimalRecordResolution, maxPerBlockImbalance, maxTotalImbalance, {from:admin});
        await pricing.enableTokenTrade(rcnToken.address, {from:admin});

        //add operator
        await pricing.addOperator(operator, {from:admin});

        buys.length = sells.length = indices.length = 0;

        await pricing.setBaseRate([rcnToken.address], [ethersToToken], [tokensToEther], buys, sells, currentBlock, indices, {from: operator});

        //set compact data
        compactBuyArr = [0, 0, 0, 0, 0, 06, 07, 08, 09, 10, 11, 12, 13, 14];
        let compactBuyHex = Helper.bytesToHex(compactBuyArr);
        buys.push(compactBuyHex);

        compactSellArr = [0, 0, 0, 0, 0, 26, 27, 28, 29, 30, 31, 32, 33, 34];
        let compactSellHex = Helper.bytesToHex(compactSellArr);
        sells.push(compactSellHex);

        indices[0] = 0;

        assert.equal(indices.length, sells.length, "bad sells array size");
        assert.equal(indices.length, buys.length, "bad buys array size");

        await pricing.setCompactData(buys, sells, currentBlock, indices, {from: operator});

        await pricing.setQtyStepFunction(rcnToken.address, qtyBuyStepX, qtyBuyStepY, qtySellStepX, qtySellStepY, {from:operator});
        await pricing.setImbalanceStepFunction(rcnToken.address, imbalanceBuyStepX, imbalanceBuyStepY, imbalanceSellStepX, imbalanceSellStepY, {from:operator});


        network = await Network.new(admin);
        await network.addOperator(operator);
        reserve = await Reserve.new(network.address, pricing.address, admin);
        await pricing.setReserveAddress(reserve.address);
        await reserve.addAlerter(alerter);
        await rcnToken.createTokens(reserve.address, new BigNumber(1000).mul(precisionUnits));

        // add reserves
        await network.addReserve(reserve.address, true, {from:admin});

        //set contracts
        feeBurner = await FeeBurner.new(admin, rcnToken.address, network.address);
        let kgtToken = await TestToken.new("kyber genesis token", "KGT", 0);
        whiteList = await WhiteList.new(admin, kgtToken.address);
        await whiteList.addOperator(operator, {from:admin});
        await whiteList.setCategoryCap(0, new BigNumber(30000).mul(precisionUnits), {from:operator});
        await whiteList.setSgdToEthRate(new BigNumber(30000).mul(precisionUnits), {from:operator});
        assert.equal((await whiteList.getOperators())[0], operator, "wrong opertor");

        expectedRate = await ExpectedRate.new(network.address, admin);
        await network.setParams(whiteList.address, expectedRate.address, feeBurner.address, gasPrice.valueOf(), negligibleRateDiff, {from:admin});
        await network.setEnable(true, {from:admin});
        let price = await network.maxGasPrice();
        assert.equal(price.valueOf(), gasPrice.valueOf(), "price equal gasPrice");

        //list tokens per reserve
        await network.listPairForReserve(reserve.address, ethAddress, rcnToken.address, true, {from:admin});
        await network.listPairForReserve(reserve.address, rcnToken.address, ethAddress, true, {from:admin});

        // Deploy RCN Engine
        engine = await NanoLoanEngine.new(rcnToken.address);
        // Deployen vivo Oracle and add currencies
        oracle = await TestOracle.new(rcnToken.address);
        // Deploy Kyber gateway
        kyberGate = await KyberGateway.new(rcnToken.address);
    });

    it("Simple test to KyberGateway lend()", async() => {
        let prevReserveBal = (await rcnToken.balanceOf(reserve.address)).toString();
        let rcnAmount = new BigNumber(400).mul(precisionUnits);
        let loanReceipt = await engine.createLoan(0x0, borrower, 0x0,  rcnAmount, 1, 1, 86400, 0, 10**30, "", {from:borrower});
        let loanId = loanReceipt.logs[0].args._index;
        //set high imbalance values - to avoid block trade due to total imbalance per block
        let highImbalance = rcnAmount.mul(4);
        await pricing.setTokenControlInfo(rcnToken.address, new BigNumber(10).pow(14), highImbalance, highImbalance, {from:admin});
        // check previus balances
        assert.equal((await rcnToken.balanceOf(lender)).toString(), "0", "The balance of lender should be 0 RCN");
        assert.equal((await rcnToken.balanceOf(borrower)).toString(), "0", "The balance of borrower should be 0 RCN");

        await kyberGate.lend(network.address, engine.address, loanId, 0x0, [], [], highNumber, 0, { value: toETHAmount(rcnAmount), from: lender});
        // check post balances
        let borrowerBal = await rcnToken.balanceOf(borrower);
        let lenderBal = await rcnToken.balanceOf(lender);
        let reserveBal = await rcnToken.balanceOf(reserve.address);
        assert.equal((await rcnToken.balanceOf(kyberGate.address)).toString(), "0", "The balance of kyberGate should be 0 RCN");
        assert.equal(borrowerBal.toString(), rcnAmount.toString(), "The borrower balance should be 400 RCN");
        assert.equal(reserveBal.plus(lenderBal).plus(borrowerBal).toString(), prevReserveBal, "The sum of balances should be 1000 RCN");
    });

    it("Should transfer the ownership of the loan", async() => {
        let rcnAmount = new BigNumber(400).mul(precisionUnits);
        let loanReceipt = await engine.createLoan(0x0, borrower, 0x0,  rcnAmount, 1, 1, 86400, 0, 10**30, "", {from:borrower});
        let loanId = loanReceipt.logs[0].args._index;
        //set high imbalance values - to avoid block trade due to total imbalance per block
        let highImbalance = rcnAmount.mul(4);
        await pricing.setTokenControlInfo(rcnToken.address, new BigNumber(10).pow(14), highImbalance, highImbalance, {from:admin});
        await kyberGate.lend(network.address, engine.address, loanId, 0x0, [], [], highNumber, 0, { value: toETHAmount(rcnAmount), from: lender});
        assert.equal(await engine.ownerOf(loanId), lender, "The owner of the loan should be the caller account(lender)");
    });

    it("Should transfer the exceeding ETH amount", async() => {
        let rcnAmount = new BigNumber(400).mul(precisionUnits);
        let loanReceipt = await engine.createLoan(0x0, borrower, 0x0,  rcnAmount, 1, 1, 86400, 0, 10**30, "", {from:borrower});
        let loanId = loanReceipt.logs[0].args._index;
        //set high imbalance values - to avoid block trade due to total imbalance per block
        let highImbalance = rcnAmount.mul(4);
        await pricing.setTokenControlInfo(rcnToken.address, new BigNumber(10).pow(14), highImbalance, highImbalance, {from:admin});

        let prevBalance = await web3.eth.getBalance(lender);
        let lendReceipt = await kyberGate.lend(network.address, engine.address, loanId, 0x0, [], [], highNumber, 0, { value: toETHAmount(rcnAmount), from: lender});

        assert.equal((await web3.eth.getBalance(kyberGate.address)).toString(), "0", "Should not remain gas in kyber gateway");
        let gasPrice = (await web3.eth.getTransaction(lendReceipt.tx)).gasPrice;
        // to calculate the gas spend in ETH
        let gasUsed = lendReceipt.receipt.gasUsed;
        let finalBalance = await web3.eth.getBalance(lender);
        let spendDelta = (prevBalance.sub(finalBalance.add(gasPrice.mul(gasUsed)).add(toETHAmount(rcnAmount)))).toNumber();
        assert.isAtMost(spendDelta, 5000, "The spend delta should be small");
    });

    it("Test Kyber lend() small amount loan", async() => {
        let rcnAmount = 5000;
        let loanReceipt = await engine.createLoan(0x0, borrower, 0x0,  rcnAmount, 1, 1, 86400, 0, 10**30, "", {from:borrower});
        let loanId = loanReceipt.logs[0].args._index;
        //set high imbalance values - to avoid block trade due to total imbalance per block
        let highImbalance = new BigNumber(2000).mul(precisionUnits);
        await pricing.setTokenControlInfo(rcnToken.address, new BigNumber(10).pow(14), highImbalance, highImbalance, {from:admin});

        await kyberGate.lend(network.address, engine.address, loanId, 0x0, [], [], highNumber, 0, { value: toETHAmount(rcnAmount), from: lender});
        // check post balances
        assert.equal((await rcnToken.balanceOf(kyberGate.address)).toString(), "0", "The balance of kyberGate should be 0 RCN");
        assert.equal((await rcnToken.balanceOf(borrower)).toString(), rcnAmount.toString(), "The balance of borrower should be 5000 Wei RCN");
    });

    it("Test Kyber lend() large amount loan", async() => {
        let prevBalanceReserve = await rcnToken.balanceOf(reserve.address);
        let rcnAmount = new BigNumber(499999).mul(precisionUnits);

        let loanReceipt = await engine.createLoan(0x0, borrower, 0x0,  rcnAmount, 1, 1, 86400, 0, 10**30, "", {from:borrower});
        await rcnToken.createTokens(reserve.address, new BigNumber(499990000000000009).mul(precisionUnits));
        let loanId = loanReceipt.logs[0].args._index;
        //set high imbalance values - to avoid block trade due to total imbalance per block
        let highImbalance = new BigNumber(900000).mul(precisionUnits);
        await pricing.setTokenControlInfo(rcnToken.address, new BigNumber(10).pow(14), highImbalance, highImbalance, {from:admin});

        await kyberGate.lend(network.address, engine.address, loanId, 0x0, [], [], highNumber, 0,
                              { value: toETHAmount(rcnAmount).mul(new BigNumber(1.5)).round(), from: lender});
        // check post balances
        assert.equal((await rcnToken.balanceOf(kyberGate.address)).toString(), "0", "The balance of kyberGate should be 0 RCN");
        assert.equal((await rcnToken.balanceOf(borrower)).toString(), rcnAmount.toString(), "The balance of borrower should be 499999 RCN");
    });

    it("Test Oracle", async() => {
        let loanAmountArg = new BigNumber(1).mul(precisionUnits);
        let prevReserveBal = (await rcnToken.balanceOf(reserve.address)).toString();
        let rateArg = new BigNumber(308);
        let decimals = new BigNumber(2);
        let rcnAmount = toRCN(loanAmountArg, rateArg, decimals);
        let arg = web3.sha3("ARG");
        await oracle.addCurrencyRate(arg, rateArg, decimals);

        let loanReceipt = await engine.createLoan(oracle.address, borrower, arg, loanAmountArg, 1, 1, 86400, 0, 10**30, "", {from:borrower});
        let loanId = loanReceipt.logs[0].args._index;
        //set high imbalance values - to avoid block trade due to total imbalance per block
        let highImbalance = new BigNumber(2000).mul(precisionUnits);
        await pricing.setTokenControlInfo(rcnToken.address, new BigNumber(10).pow(14), highImbalance, highImbalance, {from:admin});

        let raiseAmount = toETHAmount(rcnAmount);
        await kyberGate.lend(network.address, engine.address, loanId, 0x0, [], [], highNumber, 0, { value: raiseAmount, from: lender});

        // check post balances
        let borrowerBal = await rcnToken.balanceOf(borrower);
        let lenderBal = await rcnToken.balanceOf(lender);
        let reserveBal = await rcnToken.balanceOf(reserve.address);

        assert.equal((await rcnToken.balanceOf(kyberGate.address)).toNumber(), 0, "The balance of kyberGate should be 0 RCN");
        assert.equal(borrowerBal.toString(), rcnAmount.toString(), "Wrong borrower balance");
        assert.equal(reserveBal.plus(lenderBal).plus(borrowerBal).toString(), prevReserveBal.toString(), "The sum of balances should be 1000 RCN");

        await kyberGate.pay(network.address, engine.address, loanId, loanAmountArg, [], highNumber, 0,
          { value: toETHAmount(rcnAmount).mul(1.05), from: helpBorrower});

        assert.equal((await engine.getStatus(loanId)).toNumber(), 2);
    });

    it("Simple test to KyberGateway pay() a loan", async() => {
        let prevReserveBal = (await rcnToken.balanceOf(reserve.address)).toNumber();
        let rcnAmount = new BigNumber(400).mul(precisionUnits);
        let loanReceipt = await engine.createLoan(0x0, borrower, 0x0,  rcnAmount, 1, 1, 86400, 0, 10**30, "", {from:borrower});
        let loanId = loanReceipt.logs[0].args._index;
        //set high imbalance values - to avoid block trade due to total imbalance per block
        let highImbalance = new BigNumber(2000).mul(precisionUnits);
        await pricing.setTokenControlInfo(rcnToken.address, new BigNumber(10).pow(14), highImbalance, highImbalance, {from:admin});
        // check previus balances
        assert.equal((await rcnToken.balanceOf(lender)).toString(), "0", "The balance of lender should be 0 RCN");
        assert.equal((await rcnToken.balanceOf(borrower)).toString(), "0", "The balance of borrower should be 0 RCN");

        await kyberGate.lend(network.address, engine.address, loanId, 0x0, [], [], highNumber, 0, { value: toETHAmount(rcnAmount), from: lender});
        // check post balances
        let borrowerBal = await rcnToken.balanceOf(borrower);
        let lenderBal = await rcnToken.balanceOf(lender);
        let reserveBal = await rcnToken.balanceOf(reserve.address);
        assert.equal((await rcnToken.balanceOf(kyberGate.address)).toString(), "0", "The balance of kyberGate should be 0 RCN");
        assert.equal(borrowerBal.toString(), rcnAmount.toString(), "The borrower balance should be 400 RCN");
        assert.equal(reserveBal.plus(lenderBal).plus(borrowerBal).toString(), prevReserveBal.toString(), "The sum of balances should be 1000 RCN");

        let payAmount = new BigNumber(49).mul(precisionUnits);
        await kyberGate.pay(network.address, engine.address, loanId, payAmount, [], highNumber, 0, { value: toETHAmount(payAmount), from: helpBorrower});

        // check post balances
        let loanBal = (await engine.getLenderBalance(loanId)).toString();
        assert.equal(loanBal, payAmount, "The balance of kyberGate should be 0 RCN");
    });

    it("Test Kyber rebuy", async() => {
        let rcnAmount = new BigNumber(400).mul(precisionUnits);
        let loanReceipt = await engine.createLoan(0x0, borrower, 0x0,  rcnAmount, 1, 1, 86400, 0, 10**30, "", {from:borrower});
        let loanId = loanReceipt.logs[0].args._index;

        //set high imbalance values - to avoid block trade due to total imbalance per block
        let highImbalance = rcnAmount * 4 ;
        await pricing.setTokenControlInfo(rcnToken.address, new BigNumber(10).pow(18), highImbalance, highImbalance, {from:admin});

        await Helper.sendEtherWithPromise(accounts[8], reserve.address, web3.toWei(10));
        await rcnToken.createTokens(borrower, rcnAmount);
        await rcnToken.approve(network.address, rcnAmount, {from:borrower});

        assert.equal((await rcnToken.balanceOf(borrower)).toString(), rcnAmount.toString());

        let prevETHBalance = (await web3.eth.getBalance(lender)).toString();
        await kyberGate.lend(network.address, engine.address, loanId, 0x0, [], [], 0, 0, { value: toETHAmount(rcnAmount), from: lender});

        assert.equal((await rcnToken.balanceOf(lender)).toString(), "0", "The balance of lender should be 0 RCN");
        assert.isAbove(prevETHBalance, (await web3.eth.getBalance(lender)).toString(), "The balance of lender should be above 0 ETH");
        assert.equal((await rcnToken.balanceOf(kyberGate.address)).toString(), "0", "The balance of kyberGate should be 0 RCN");

        let payAmount = new BigNumber(111).mul(precisionUnits);
        prevETHBalance = (await web3.eth.getBalance(helpBorrower)).toString();
        await kyberGate.pay(network.address, engine.address, loanId, payAmount, [], 0, 0, { value: toETHAmount(payAmount), from: helpBorrower});
        // check post balances
        let loanBal = (await engine.getLenderBalance(loanId)).toString();
        assert.equal(loanBal, payAmount, "The balance of kyberGate should be 0 RCN");
        assert.equal((await rcnToken.balanceOf(lender)).toString(), "0", "The balance of lender should be 0 RCN");
        assert.isAbove(prevETHBalance, (await web3.eth.getBalance(helpBorrower)).toString(), "The balance of lender should be above 0 ETH");
        assert.equal((await rcnToken.balanceOf(kyberGate.address)).toString(), "0", "The balance of kyberGate should be 0 RCN");
    });
})

function toRCN(amount, rate, decimals){
    return amount.mul(rate.dividedBy(new BigNumber(10).pow(decimals))).round();
}

function toETHAmount(rcnAmount) {
    function maxQtyRaise() {
        for (let i = 0; i < qtyBuyStepX.length; i++)
            if (rcnAmount <= qtyBuyStepX[i])
                return qtyBuyStepY[i];
        return qtyBuyStepY[qtyBuyStepY.length - 1];
    };
    function maxImbalanceRaise(){
        for (let i = 0; i < imbalanceBuyStepX.length; i++)
            if (rcnAmount <= imbalanceBuyStepX[i])
                return imbalanceBuyStepY[i];
        return imbalanceBuyStepY[imbalanceBuyStepY.length - 1];
    };

    let sumRaise = ((maxQtyRaise() + maxImbalanceRaise()) / 10000) * (-1);
    let factorRaise = new BigNumber(1).plus(new BigNumber(sumRaise));

    return tokensToEther.mul(factorRaise).mul(rcnAmount).dividedBy(precisionUnits).round();
}



function addBps (rate, bps) {
  return (rate.mul(10000 + bps).div(10000));
};
