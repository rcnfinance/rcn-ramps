const TestToken = artifacts.require("./utils/test/TestToken.sol");

//RCN
//const NanoLoanEngine = artifacts.require("./vendors/rcn/NanoLoanEngine.sol");

// Kyber network
const KyberMock = artifacts.require("./vendors/mocks/KyberMock.sol");
const KyberOracle = artifacts.require("./vendors/rcn/KyberOracle.sol");
const KyberProxy = artifacts.require("./KyberProxy.sol");
const KyberNetworkProxy = artifacts.require("./vendors/kyber/KyberNetworkProxy");

const ConverterRamp = artifacts.require('./ConverterRamp.sol');

let converterRamp;
let kyberProxy;

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

contract('KyberIntegration', function(accounts) {
    
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

    beforeEach("Deploy Tokens, Kyber, Converter", async function(){
        
        // set accounts address;
        borrower = accounts[0];
        lender = accounts[1];
        payer = accounts[2];
        signer = accounts[3];

        console.log("Deploy MANA token.");
        mana = await TestToken.new("Mana", "MANA", 18, "1.0", 6000);
        console.log(mana.address);
        console.log("----------------------------")
        
        console.log("Deploy RCN token.");
        rcn = await TestToken.new("Ripio Credit Network", "RCN", 18, "1.1", 4000);
        console.log(rcn.address);
        console.log("----------------------------")
        
        console.log("Deploy Ramp.");
        converterRamp = await ConverterRamp.new();
        console.log(converterRamp.address);
        console.log("----------------------------")
        
        
        console.log("converter RCN-MANA");
        converter = await KyberNetworkProxy.new(0x0);
        console.log(converter.address);
        console.log("----------------------------")

        await rcn.createTokens(converter.address, 2500000 * 10 **18)
        await mana.createTokens(converter.address, 6500000 * 10 **18)
        
        console.log("Deploy kyber network.");
        kyberNetwork = await KyberMock.new(mana.address, rcn.address)
        await mana.createTokens(kyberNetwork.address, 1000000*10**18);
        await rcn.createTokens(kyberNetwork.address, 1000000*10**18);
        await kyberNetwork.setRateRM(1262385660474240000);
        await kyberNetwork.setRateMR(792150949832820000);
        console.log(kyberNetwork.address);
        console.log("----------------------------")

        console.log("Deploy kyber proxy.");
        kyberProxy = await KyberProxy.new(kyberNetwork.address)
        console.log(kyberProxy.address);
        console.log("----------------------------")

        console.log("Deploy kyber oracle.");
        kyberOracle = await KyberOracle.new()
        await kyberOracle.setRcn(rcn.address)
        await kyberOracle.setKyber(kyberNetwork.address)
        await kyberOracle.addCurrencyLink("MANA", mana.address, 18)
        console.log(kyberOracle.address);
        console.log("----------------------------")

        assert.equal(await kyberOracle.tickerToToken(manaCurrency), mana.address)
    })

    it("Should swap token to token.", async() => {

    })

})