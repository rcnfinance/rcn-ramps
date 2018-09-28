const { readFileSync } = require('fs');
const HDWalletProvider = require('truffle-hdwallet-provider');

const mnemonic = readFileSync('./mnemonic', 'utf-8');
const infuraApikey = readFileSync('./infura_access_token', 'utf-8');

module.exports = {
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  networks: {
    development: {
      provider: new HDWalletProvider(mnemonic, 'http://localhost:8545', 0, 10),
      host: 'localhost',
      port: 8545,
      network_id: 5777,
      gas: 6721975,
      gasPrice: 20000000000,
      confirmations: 0,
      timeoutBlocks: 50,
      skipDryRun: true,
    },
    ropsten: {
      provider: function () {
        return new HDWalletProvider(mnemonic, `https://ropsten.infura.io/v3/${infuraApikey}`);
      },
      network_id: 1
    }
  }
};
