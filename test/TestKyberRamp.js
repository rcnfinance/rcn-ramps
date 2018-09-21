const MANAToken = artifacts.require("./vendors/mocks/MANATokenMock.sol");
const RCNToken = artifacts.require("./vendors/mocks/RCNTokenMock.sol");

//Engine
const NanoLoanEngine = artifacts.require("./vendors/rcn/NanoLoanEngine.sol");


// Kyber network
const KyberProxyMock = artifacts.require("./vendors/mocks/KyberProxyMock.sol");
const KyberOracle = artifacts.require("./vendors/rcn/KyberOracle.sol");
const KyberNetworkProxy = artifacts.require("./vendors/kyber/KyberNetworkProxy.sol");
const KyberProxy = artifacts.require("./KyberProxy.sol");

const ConverterRamp = artifacts.require('./ConverterRamp.sol');

let engine;

let converterRamp;
let kyberProxy;
let kyberNetworkProxy;

// kyber converters
let converter;
// tokens tokens
let eth;
let rcn;
let mana;
// accounts
let borrower;
let lender;
let signer;
let payer;

contract('ConverterRamp', function(accounts) {
    
    const manaCurrency = "0x4d414e4100000000000000000000000000000000000000000000000000000000";

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

    function toBytes32(source) {
        const rl = 64;
        source = source.toString().replace("0x", "");
        if (source.length < rl) {
            const diff = 64 - source.length;
            source = "0".repeat(diff) + source;
        }
        return "0x" + source;
    }

    beforeEach("Deploy Tokens, Kyber, Converter", async function(){
        
        // set accounts address;
        borrower = accounts[0];
        console.log("Borrower: " + borrower);

        lender = accounts[1];
        console.log("Lender: " + lender);

        payer = accounts[2];
        console.log("Payer: " + payer);

        signer = accounts[3];
        console.log("Signer: " + signer);
        console.log("----------------------------");

        console.log("Deploy MANA token.");
        mana = await MANAToken.new();
        console.log(mana.address);
        console.log("----------------------------");
        
        console.log("Deploy RCN token.");
        rcn = await RCNToken.new();
        console.log(rcn.address);
        console.log("----------------------------");

        console.log("Deploy RCN engine.");
        engine = await NanoLoanEngine.new(rcn.address);
        console.log(engine.address);
        console.log("----------------------------");

        console.log("Deploy Ramp.");
        converterRamp = await ConverterRamp.new();
        console.log(converterRamp.address);
        console.log("----------------------------");
   
        console.log("Deploy kyber network.");
        kyberProxyNetwork = await KyberProxyMock.new(accounts[9], mana.address, rcn.address);
        await mana.mint(kyberProxyNetwork.address, 1000000*10**18);
        await rcn.mint(kyberProxyNetwork.address, 1000000*10**18);
        console.log(kyberProxyNetwork.address);
        console.log("----------------------------"); 
        await kyberProxyNetwork.setRateRM(1262385660474240000);
        await kyberProxyNetwork.setRateMR(792150949832820000);

        console.log("Deploy kyber proxy.");
        kyberProxy = await KyberProxy.new(0x0, kyberProxyNetwork.address);
        console.log(kyberProxy.address);
        console.log("----------------------------");

        /*console.log("Deploy kyber oracle.");
        kyberOracle = await KyberOracle.new();
        await kyberOracle.setRcn(rcn.address);
        await kyberOracle.setKyber(kyberProxyNetwork.address);
        await kyberOracle.addCurrencyLink("MANA", mana.address, 18);
        console.log(kyberOracle.address);
        console.log("----------------------------")
    

        assert.equal(await kyberOracle.tickerToToken(manaCurrency), mana.address);*/
        
    })

    it("Should lend and pay using the ramp (Kyber)", async() => {
        // Create a random loan
        let loanReceipt = await engine.createLoan(
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

        await mana.mint(lender, 10000 * 10 ** 18);
        await mana.approve(converterRamp.address, 10000 * 10 ** 18, {from:lender});

        const lendLoanParams = [
            toBytes32(engine.address),
            toBytes32(loanId.toString(16)),
            toBytes32(0x0)
        ]

        const convertParams = [
            50,
            0,
            0
        ]
        
        await converterRamp.lend(
            kyberProxy.address,
            mana.address,
            lendLoanParams,
            [],
            [],
            convertParams,
            {
                from: lender
            }
        );

        //assert.equal(await mana.balanceOf(converterRamp.address), 0);
        //assert.equal(await rcn.balanceOf(converterRamp.address), 0);
        //assert.equal(await engine.ownerOf(loanId), lender);

        await mana.mint(payer, 10000 * 10 ** 18);
        await mana.approve(converterRamp.address, 10000 * 10 ** 18, {from:payer});

        const payLoanParams = [
            toBytes32(engine.address),
            toBytes32(loanId.toString(16)),
            toBytes32((100 * 10 ** 18).toString(16)),
            toBytes32(payer)
        ]

        /*await converterRamp.pay(
            converter.address,
            mana.address,
            payLoanParams,
            [],
            convertParams,
            {
                from: payer
            }
        );*/
    })

})