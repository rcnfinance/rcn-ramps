var TestToken = artifacts.require("./utils/test/TestToken.sol");
var NanoLoanEngine = artifacts.require("./utils/test/ripiocredit/NanoLoanEngine.sol");
var KyberMock = artifacts.require("./KyberMock.sol");
var KyberGateway = artifacts.require("./KyberGateway.sol");

contract('KyberGateway', function(accounts) {
    let ETH_TOKEN_ADDRESS = "0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    let rcnEngine;
    let kyber;
    let mortgageManager;
    let rcn;

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
        // Deploy RCN token
        rcn = await TestToken.new("Ripio Credit Network", "RCN", 18, "1.1", 4000);
        // Deploy RCN Engine
        rcnEngine = await NanoLoanEngine.new(rcn.address);
        // Deploy Kyber network and fund it
        kyber = await KyberMock.new(rcn.address);
        // Deploy Kyber gateway
        kyberGate = await KyberGateway.new(rcn.address);
    });

    function getETHBalance(address) {
        return web3.eth.getBalance(address).toNumber();
    };

    it("Should transfer the ownership of the loan", async() => {
        let loanReceipt = await rcnEngine.createLoan(0x0, accounts[2], 0x0,  web3.toWei(10), 1, 1, 86400, 0, 10**30, "", {from:accounts[2]})
        let loanId = loanReceipt["logs"][0]["args"]["_index"];

        await rcn.createTokens(kyber.address, web3.toWei(100))
        await kyber.setRateRE(web3.toWei(0.0002))
        await kyber.setRateER(web3.toWei(4000))

        await kyberGate.lend(kyber.address, rcnEngine.address, loanId, 0x0, [], [], true, 0, { value: web3.toWei(20), from: accounts[2]})

        assert.equal(await rcnEngine.ownerOf(loanId), accounts[2], "The owner of the loan should be the caller account")
    });

    it("Should transfer the exceeding ETH amount", async() => {
        let loanReceipt = await rcnEngine.createLoan(0x0, accounts[2], 0x0, web3.toWei(6000), 1, 1, 86400, 0, 10**30, "", {from:accounts[2]})
        let loanId = loanReceipt["logs"][0]["args"]["_index"];

        await rcn.createTokens(kyber.address, web3.toWei(10000));
        await kyber.setRateER(web3.toWei(4000));
        await kyber.setRateRE(web3.toWei(0.0002));

        let prevBalance = await web3.eth.getBalance(accounts[2]);
        await kyberGate.lend(kyber.address, rcnEngine.address, loanId, 0x0, [], [], true, 0, { value: web3.toWei(12), from: accounts[2]});
        let diffExpected = prevBalance - await web3.eth.getBalance(accounts[2]);

        assert.equal(await web3.eth.getBalance(kyberGate.address), 0, "Should not remain gas in kyber gateway");
        assert.equal(await rcn.balanceOf(kyberGate.address), 0, "Should not remain any tokens in gateway");
        let amountInETH = web3.toWei(1.5);
        assert.isBelow(Math.abs(diffExpected - amountInETH), web3.toWei(0.03), "Account balance should only have lost 1.5 ETH");
    });

    it("Test Kyber lend", async() => {
        let loanAmountRCN = web3.toWei(2000);

        await rcn.createTokens(kyber.address, web3.toWei(2001));
        await kyber.setRateRE(web3.toWei(0.0002));
        await kyber.setRateER(web3.toWei(4000));
        // Request a loan for the accounts[2] it should be index 0
        await rcnEngine.createLoan(0x0, accounts[2], 0x0, loanAmountRCN,
            100000000, 100000000, 86400, 0, 10**30, "Test kyberGateway", {from:accounts[2]});
        // Trade ETH to RCN and Lend
        await kyberGate.lend(kyber.address, rcnEngine.address, 0, 0x0, [], [], false, 1, {value: web3.toWei(0.5), from:accounts[3]});
        // Check the final ETH balance
        assert.equal(getETHBalance(kyber.address), web3.toWei(0.5), "The balance of kyber should be 0.5 ETH");
        // Check the final RCN balance
        assert.equal((await rcn.balanceOf(kyber.address)).toNumber(), web3.toWei(1), "The balance of kyber should be 1 RCN");
        assert.equal((await rcn.balanceOf(accounts[2])).toNumber(), web3.toWei(2000), "The balance of acc2(borrower) should be 2000 RCN");
        assert.equal((await rcn.balanceOf(accounts[3])).toNumber(), 0, "The balance of acc3(lender) should be 0 RCN");
        // check the lender of the loan
        let loanOwner = await rcnEngine.ownerOf(0);
        assert.equal(loanOwner, accounts[3], "The lender should be account 3");
    });

    it("Test Kyber large amount loan", async() => {
        let loanAmountRCN = web3.toWei(499999);

        await rcn.createTokens(kyber.address, web3.toWei(500000));
        await kyber.setRateRE(web3.toWei(0.00001));
        await kyber.setRateER(web3.toWei(100000));
        // Request a loan for the accounts[2] it should be index 0
        await rcnEngine.createLoan(0x0, accounts[2], 0x0, loanAmountRCN,
            100000000, 100000000, 86400, 0, 10**30, "Test kyberGateway", {from:accounts[2]});
        // Trade ETH to RCN and Lend
        await kyberGate.lend(kyber.address, rcnEngine.address, 0, 0x0, [], [], true, 0, {value: web3.toWei(5), from:accounts[3]});
        // Check the final RCN balance
        assert.equal((await rcn.balanceOf(accounts[2])).toNumber(), web3.toWei(499999), "The balance of acc2(borrower) should be 499999 RCN");
        assert.equal((await rcn.balanceOf(accounts[3])).toNumber(), 0, "The balance of acc3(lender) should be 0 RCN");
    });

    it("Test Kyber small amount loan", async() => {
        let loanAmountRCN = (web3.toWei(0.0004));

        await rcn.createTokens(kyber.address, web3.toWei(0.00041));
        await kyber.setRateRE(web3.toWei(0.00001));
        await kyber.setRateER(web3.toWei(100000));
        // Request a loan for the accounts[2] it should be index 0
        await rcnEngine.createLoan(0x0, accounts[2], 0x0, loanAmountRCN,
            100000000, 100000000, 86400, 0, 10**30, "Test kyberGateway", {from:accounts[2]});
        // Trade ETH to RCN and Lend
        await kyberGate.lend(kyber.address, rcnEngine.address, 0, 0x0, [], [], true, 0, {value: web3.toWei(0.0005), from:accounts[3]});
        // Check the final RCN balance
        assert.equal((await rcn.balanceOf(accounts[2])).toNumber(), web3.toWei(0.0004), "The balance of acc2(borrower) should be 0.0004 RCN");
        assert.equal((await rcn.balanceOf(accounts[3])).toNumber(), 0, "The balance of acc3(lender) should be 0 RCN");
    });
})
