/* global artifacts, web3 */
/* eslint-disable no-underscore-dangle, no-unused-vars */
const BN = require('bn.js');
const moment = require('moment');

const NetworkProxy = artifacts.require('./vendors/kyber/KyberNetworkProxy.sol');
const TestToken = artifacts.require('./vendors/rcn/TestToken.sol');

function stdlog (input) {
    console.log(`${moment().format('YYYY-MM-DD HH:mm:ss.SSS')}] ${input}`);
}

function tx (result, call) {
    const logs = (result.logs.length > 0) ? result.logs[0] : { address: null, event: null };

    console.log();
    console.log(`   ${call}`);
    console.log('   ------------------------');
    console.log(`   > transaction hash: ${result.tx}`);
    console.log(`   > contract address: ${logs.address}`);
    console.log(`   > gas used: ${result.receipt.gasUsed}`);
    console.log(`   > event: ${logs.event}`);
    console.log();
}

async function main () {
    const accounts = web3.eth.accounts._provider.addresses;
    const userWallet = accounts[4];

    // Set the instances
    const NetworkProxyInstance = await NetworkProxy.at(NetworkProxy.address);

    const rcn = await TestToken.new('RCN', 'RCN', 18, '1.1', 4000);
    stdlog(`RCN (${rcn.address})`);

    const mana = await TestToken.new('MANA', 'MANA', 18, '1.0', 6000);
    stdlog(`MANA (${mana.address})`);

    stdlog('- START -');
    stdlog(`KyberNetworkProxy (${NetworkProxy.address})`);

    stdlog(`RNC balance of ${userWallet} = ${web3.utils.fromWei(await rcn.balanceOf(userWallet))}`);
    stdlog(`MANA balance of ${userWallet} = ${web3.utils.fromWei(await mana.balanceOf(userWallet))}`);

    // Approve the KyberNetwork contract to spend user's tokens
    await rcn.approve(
        NetworkProxy.address,
        web3.utils.toWei(new BN(100000)),
        { from: userWallet },
    );

    const { expectedRate, slippageRate } = await NetworkProxyInstance.getExpectedRate(
        rcn.address, // srcToken
        mana.address, // destToken
        1, // srcQty
    );

    const result = await NetworkProxyInstance.trade(
        rcn.address, // srcToken
        web3.utils.toWei(new BN(10)), // srcAmount
        mana.address, // destToken
        userWallet, // destAddress
        web3.utils.toWei(new BN(100000)), // maxDestAmount
        expectedRate, // minConversionRate
        0, // walletId
        { from: userWallet },
    );
    tx(result, 'RCN <-> MANA trade()');

    stdlog(`RCN balance of ${userWallet} = ${web3.utils.fromWei(await rcn.balanceOf(userWallet))}`);
    stdlog(`MANA balance of ${userWallet} = ${web3.utils.fromWei(await mana.balanceOf(userWallet))}`);

    stdlog('- END -');
    callback();
};

main();
