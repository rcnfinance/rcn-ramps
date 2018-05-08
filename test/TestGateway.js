var TestToken = artifacts.require("./utils/test/TestToken.sol");
var NanoLoanEngine = artifacts.require("./utils/test/ripiocredit/NanoLoanEngine.sol");
var KyberMock = artifacts.require("./KyberMock.sol");
var KyberGateway = artifacts.require("./KyberGateway.sol");
var TestWallet = artifacts.require("./utils/test/TestWallet.sol");

contract('KyberGateway', function(accounts) {
    let ETH_TOKEN_ADDRESS = "0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    let rcnEngine;
    let kyber;
    let mortgageManager;
    let rcn;
    let wallet;

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

    beforeEach("Deploy Tokens, Engine, Kyber, Wallet", async function(){
        // Deploy RCN token
        rcn = await TestToken.new("Ripio Credit Network", "RCN", 18, "1.1", 4000);
        // Deploy RCN Engine
        rcnEngine = await NanoLoanEngine.new(rcn.address);
        // Deploy Kyber network and fund it
        kyber = await KyberMock.new(rcn.address);
        // Deploy Kyber gateway
        kyberGate = await KyberGateway.new(rcn.address);
        // Deploy test Wallet
        wallet = await TestWallet.new(kyber.address, kyberGate.address);
    });

    function getETHBalance(address) {
        return web3.eth.getBalance(address).toNumber();
    };

    it("Test trade ETH/RCN through the wallet", async() => {
        let amountOnETH = 0.2*10**18;
        // Deposit ETH on wallet from account 5
        await wallet.deposit({value: 0.5*10**18, from:accounts[5]});
        // Check the initial ETH balance
        assert.equal(getETHBalance(wallet.address), 0.5*10**18, "The balance of wallet should be 0.5 ETH");
        assert.equal(getETHBalance(kyber.address), 0, "The balance of kyber should be 0 ETH");
        // Create tokens y rates
        await rcn.createTokens(kyber.address, 11254*10**18);
        await kyber.setRateRE(0.0002*10**18);
        await kyber.setRateER(5000*10**18);
        // Trade TEH for RCN
        await wallet.executeTrade(ETH_TOKEN_ADDRESS, amountOnETH, rcn.address, {from:accounts[5]});
        // Check the final ETH balance
        assert.equal(getETHBalance(wallet.address), 0.3*10**18, "The balance of wallet should be 5 ETH ");
        assert.equal(getETHBalance(kyber.address), 0.2*10**18, "The balance of kyber should be 2 ETH");
        // Check the final RCN balance
        assert.equal((await rcn.balanceOf(kyber.address)).toNumber(), 10254*10**18, "The balance of kyber should be 10,254 RCN");
        assert.equal((await rcn.balanceOf(wallet.address)).toNumber(), 1000*10**18, "The balance of wallet should be 1,000 RCN");
    });

    it("Test lend ETH/RCN through the wallet", async() => {
        let loanAmountRCN = 2000*10**18;
        // Deposit ETH on wallet from account 5
        await wallet.deposit({value: 1*10**18, from:accounts[5]});
        // Check the initial ETH balance
        assert.equal(getETHBalance(wallet.address), 1*10**18, "The balance of wallet should be 1 ETH");
        assert.equal(getETHBalance(kyber.address), 0, "The balance of kyber should be 0 ETH");
        // Create tokens y rates
        await rcn.createTokens(kyber.address, 10002*10**18);
        await kyber.setRateRE(0.0002*10**18);
        await kyber.setRateER(5000*10**18);
        // Request a loan for the accounts[2] it should be index 0
        await rcnEngine.createLoan(0x0, accounts[2], 0x0, loanAmountRCN,
            100000000, 100000000, 86400, 0, 10**30, "Test kyberGateway", {from:accounts[2]});
        // Trade ETH to RCN and Lend
        let rateRE = (await kyber.rateRE()).toNumber();
        let loanAmount = (await rcnEngine.getAmount(0)).toNumber();
        let targetAmountETH = (await kyber.convertRate(loanAmount, rateRE)).toNumber();
        await wallet.executeLend(targetAmountETH, kyber.address, rcnEngine.address, 0, 0x0, [], [], {from:accounts[5]});
        // Check the final ETH balance
        assert.equal(getETHBalance(wallet.address), 0.6*10**18, "The balance of wallet should be 0.6 ETH");
        assert.equal(getETHBalance(kyber.address), 0.4*10**18, "The balance of kyber should be 0.4 ETH");
        // Check the final RCN balance
        assert.equal((await rcn.balanceOf(kyber.address)).toNumber(), 8002*10**18, "The balance of kyber should be 8,002 RCN");
        assert.equal((await rcn.balanceOf(accounts[2])).toNumber(), 2000*10**18, "The balance of Acc 2 should be 2,000 RCN");
        assert.equal((await rcn.balanceOf(wallet.address)).toNumber(), 0, "The balance of wallet should be 0 RCN");
        assert.equal((await rcn.balanceOf(accounts[5])).toNumber(), 0, "The balance of Acc 5 should be 0 RCN");
    });

    it("Test lend ETH/RCN through the wallet in wei level", async() => {
        let loanAmountRCN = 10000;
        // Deposit ETH on wallet from account 5
        await wallet.deposit({value: 5, from:accounts[5]});
        // Check the initial ETH balance
        assert.equal(getETHBalance(wallet.address), 5, "The balance of wallet should be 5 wei ETH");
        assert.equal(getETHBalance(kyber.address), 0, "The balance of kyber should be 0 wei ETH");
        // Create tokens y rates
        await rcn.createTokens(kyber.address, 25000);
        await kyber.setRateRE(0.0002*10**18);
        await kyber.setRateER(5000*10**18);
        // Request a loan for the accounts[2] it should be index 0
        await rcnEngine.createLoan(0x0, accounts[2], 0x0, loanAmountRCN,
            100000000, 100000000, 86400, 0, 10**30, "Test kyberGateway", {from:accounts[2]});
        // Trade ETH to RCN and Lend
        let rateRE = (await kyber.rateRE()).toNumber();
        let loanAmount = (await rcnEngine.getAmount(0)).toNumber();
        let targetAmountETH = (await kyber.convertRate(loanAmount, rateRE)).toNumber();
        await wallet.executeLend(targetAmountETH, kyber.address, rcnEngine.address, 0, 0x0, [], [], {from:accounts[5]});
        // Check the final ETH balance
        assert.equal(getETHBalance(wallet.address), 3, "The balance of wallet should be 3 wei ETH");
        assert.equal(getETHBalance(kyber.address), 2, "The balance of kyber should be 2 wei ETH");
        // Check the final RCN balance
        assert.equal((await rcn.balanceOf(kyber.address)).toNumber(), 15000, "The balance of kyber should be 15,000 RCN wei");
        assert.equal((await rcn.balanceOf(accounts[2])).toNumber(), 10000, "The balance of Acc 2 should be 10,000 RCN wei");
        assert.equal((await rcn.balanceOf(wallet.address)).toNumber(), 0, "The balance of wallet should be 0 RCN");
        assert.equal((await rcn.balanceOf(accounts[5])).toNumber(), 0, "The balance of Acc 5 should be 0 RCN");
    });

    it("Test Kyber lend", async() => {
        let loanAmountRCN = 2000*10**18;

        await rcn.createTokens(kyber.address, 2001*10**18);
        await kyber.setRateRE(0.0002*10**18);
        await kyber.setRateER(5000*10**18);
        // Request a loan for the accounts[2] it should be index 0
        await rcnEngine.createLoan(0x0, accounts[2], 0x0, loanAmountRCN,
            100000000, 100000000, 86400, 0, 10**30, "Test kyberGateway", {from:accounts[2]});
        // Trade ETH to RCN and Lend
        await kyberGate.lend(kyber.address, rcnEngine.address, 0, 0x0, [], [], {value: 0.4*10**18, from:accounts[3]});
        // Check the final ETH balance
        assert.equal(getETHBalance(kyber.address), 0.4*10**18, "The balance of kyber should be 0.4 ETH");
        // Check the final RCN balance
        assert.equal((await rcn.balanceOf(kyber.address)).toNumber(), 1*10**18, "The balance of kyber should be 1 RCN");
        assert.equal((await rcn.balanceOf(accounts[2])).toNumber(), 2000*10**18, "The balance of acc2(borrower) should be 2000 RCN");
        assert.equal((await rcn.balanceOf(accounts[3])).toNumber(), 0, "The balance of acc3(lender) should be 0 RCN");
    });

    it("Test Kyber large amount loan", async() => {
        let loanAmountRCN = 499999*10**18;

        await rcn.createTokens(kyber.address, 500000*10**18);
        await kyber.setRateRE(0.00001*10**18);
        await kyber.setRateER(100000*10**18);
        // Request a loan for the accounts[2] it should be index 0
        await rcnEngine.createLoan(0x0, accounts[2], 0x0, loanAmountRCN,
            100000000, 100000000, 86400, 0, 10**30, "Test kyberGateway", {from:accounts[2]});
        // Trade ETH to RCN and Lend
        await kyberGate.lend(kyber.address, rcnEngine.address, 0, 0x0, [], [], {value: 5*10**18, from:accounts[3]});
        // Check the final ETH balance
        assert.equal(getETHBalance(kyber.address), 4.99999*10**18, "The balance of kyber should be 4.99999 ETH");
        // Check the final RCN balance
        assert.equal((await rcn.balanceOf(kyber.address)).toNumber(), 1*10**18, "The balance of kyber should be 1 RCN");
        assert.equal((await rcn.balanceOf(accounts[2])).toNumber(), 499999*10**18, "The balance of acc2(borrower) should be 499999 RCN");
        assert.equal((await rcn.balanceOf(accounts[3])).toNumber(), 0, "The balance of acc3(lender) should be 0 RCN");
    });

    it("Test Kyber small amount loan", async() => {
        let loanAmountRCN = (0.0004*10**18);

        await rcn.createTokens(kyber.address, 0.00041*10**18);
        await kyber.setRateRE(0.00001*10**18);
        await kyber.setRateER(100000*10**18);
        // Request a loan for the accounts[2] it should be index 0
        await rcnEngine.createLoan(0x0, accounts[2], 0x0, loanAmountRCN,
            100000000, 100000000, 86400, 0, 10**30, "Test kyberGateway", {from:accounts[2]});
        // Trade ETH to RCN and Lend
        await kyberGate.lend(kyber.address, rcnEngine.address, 0, 0x0, [], [], {value: 0.0005*10**18, from:accounts[3]});
        // Check the final ETH balance
        assert.equal(getETHBalance(kyber.address), 4*10**9, "The balance of kyber should be 0.000000004 ETH");
        // Check the final RCN balance
        assert.equal((await rcn.balanceOf(kyber.address)).toNumber(), 0.00001*10**18, "The balance of kyber should be 0.00001 RCN");
        assert.equal((await rcn.balanceOf(accounts[2])).toNumber(), 0.0004*10**18, "The balance of acc2(borrower) should be 0.0004 RCN");
        assert.equal((await rcn.balanceOf(accounts[3])).toNumber(), 0, "The balance of acc3(lender) should be 0 RCN");
    });
})
