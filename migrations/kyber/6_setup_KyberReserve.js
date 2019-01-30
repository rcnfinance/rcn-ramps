/* global artifacts */
/* eslint-disable no-unused-vars, no-eval */
const fs = require('fs');

const Network = artifacts.require('./vendors/kyber/KyberNetwork.sol');
const ConversionRates = artifacts.require('./vendors/kyber/ConversionRates.sol');
const SanityRates = artifacts.require('./vendors/kyber/SanityRates.sol');
const Reserve = artifacts.require('./vendors/kyber/KyberReserve.sol');

const KNC = artifacts.require('./vendors/mocks/KyberNetworkCrystal.sol');
const RCN = artifacts.require('./vendors/mocks/RcnToken.sol');
const MANA = artifacts.require('./vendors/mocks/ManaToken.sol');
const ZIL = artifacts.require('./vendors/mocks/ZilliqaToken.sol');

const tokenConfig = JSON.parse(fs.readFileSync('../../config/tokens.json', 'utf8'));

function tx (result, call) {
    const logs = (result.logs.length > 0) ? result.logs[0] : { address: null, event: null };

    console.log();
    console.log(`   Calling ${call}`);
    console.log('   ------------------------');
    console.log(`   > transaction hash: ${result.tx}`);
    console.log(`   > contract address: ${logs.address}`);
    console.log(`   > gas used: ${result.receipt.gasUsed}`);
    console.log(`   > event: ${logs.event}`);
    console.log();
}

module.exports = async (deployer, network, accounts) => {
    if (deployer.network != 'kyber') return;

    const userWallet = accounts[4];

    // Set the instances
    const NetworkInstance = await Network.at(Network.address);
    const ReserveInstance = await Reserve.at(Reserve.address);

    // Set the reserve contract addresses
    tx(
        await ReserveInstance.setContracts(
            Network.address,
            ConversionRates.address,
            SanityRates.address,
        ),
        'setContracts()',
    );

    // Add reserve to network
    tx(await NetworkInstance.addReserve(Reserve.address, true), 'addReserve()');

    Object.keys(tokenConfig).forEach(async (key) => {
    // Add the withdrawal address for each token
        tx(
            await ReserveInstance.approveWithdrawAddress(eval(key).address, userWallet, true),
            'approveWithdrawAddress()',
        );

        // List token pairs for the reserve
        tx(
            await NetworkInstance.listPairForReserve(
                Reserve.address,
                eval(key).address,
                true,
                true,
                true,
            ),
            'listPairForReserve()',
        );
    });
};
