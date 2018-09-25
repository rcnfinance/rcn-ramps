const { readFileSync } = require('fs');
const HDWalletProvider = require('truffle-hdwallet-provider');

const mnemonic = readFileSync('./mnemonic', 'utf-8');
const infuraApikey = readFileSync('./infura_access_token', 'utf-8');

module.exports = {
  solc: {
    optimizer: {
      enabled: true,
      runs: 400
    }
  },
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },
    ropsten: {
      provider: function () {
        return new HDWalletProvider(mnemonic, `https://ropsten.infura.io/v3/${infuraApikey}`);
      },
      network_id: 1
    }
  }
};
