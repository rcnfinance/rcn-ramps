/* global artifacts, web3 */
/* eslint-disable no-unused-vars */
const BN = require('bn.js');
const fs = require('fs');

const Reserve = artifacts.require('./KyberReserve.sol');

const KNC = artifacts.require('./vendors/mocks/KyberNetworkCrystal.sol');
const RCN = artifacts.require('./vendors/mocks/RcnToken.sol');
const MANA = artifacts.require('./vendors/mocks/ManaToken.sol');
const ZIL = artifacts.require('./vendors/mocks/ZilliqaToken.sol');

const tokenConfig = JSON.parse(fs.readFileSync('../../config/tokens.json', 'utf8'));
const networkConfig = JSON.parse(fs.readFileSync('../../config/network.json', 'utf8'));

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

    const admin = accounts[0];
    const userWallet = accounts[4];

    // Set the instances
    const ReserveInstance = await Reserve.at(Reserve.address);
    const KNCInstance = await KNC.at(KNC.address);
    const RCNInstance = await RCN.at(RCN.address);
    const MANAInstance = await MANA.at(MANA.address);
    const ZILInstance = await ZIL.at(ZIL.address);

    // Set token amounts to transfer to user and reserve wallet
    const KNCAmount = (
        new BN(10000).mul(new BN(10).pow(await KNCInstance.decimals()))
    ).toString();
    const RCNAmount = (
        new BN(10000).mul(new BN(10).pow(await RCNInstance.decimals()))
    ).toString();
    const MANAamount = (
        new BN(10000).mul(new BN(10).pow(await MANAInstance.decimals()))
    ).toString();
    const ZILAmount = (
        new BN(10000).mul(new BN(10).pow(await ZILInstance.decimals()))
    ).toString();

    // Transfer tokens to the user
    tx(await KNCInstance.transfer(userWallet, KNCAmount), 'transfer()');
    tx(await RCNInstance.transfer(userWallet, RCNAmount), 'transfer()');
    tx(await MANAInstance.transfer(userWallet, MANAamount), 'transfer()');
    tx(await ZILInstance.transfer(userWallet, ZILAmount), 'transfer()');

    // Transfer tokens and ETH to the reserve
    tx(await KNCInstance.transfer(Reserve.address, KNCAmount), 'transfer()');
    tx(await RCNInstance.transfer(Reserve.address, RCNAmount), 'transfer()');
    tx(await MANAInstance.transfer(Reserve.address, MANAamount), 'transfer()');
    tx(await ZILInstance.transfer(Reserve.address, ZILAmount), 'transfer()');
    tx(
        await ReserveInstance.sendTransaction(
            { from: admin, value: web3.utils.toWei(new BN(50)) },
        ),
        'sendTransaction()',
    );
};
