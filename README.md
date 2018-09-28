# rcn-ramps

Ganache
Install the Ganache AppImage by downloading here https://truffleframework.com/ganache. To use the provided Ganache snapshot, install ganache-cli.

sudo npm install -g ganache-cli
Truffle
Install the latest Truffle v5 beta.

sudo npm install -g truffle@beta
Install the rest of the NPM packages
npm install

Interacting with the Bancor contracts locally

    TODO: make documentation of bancor integration

Interacting with the Kyber contracts locally

1A. Run Ganache with local snapshot
A Ganache snapshot has already been pre-made with the Kyber contracts deployed. You can immediately interact with the contracts without having to do migrations. The snapshot is stored in db folder.

The user wallet  should be contain some ETH and test ERC20 tokens.

NOTE: The mnemonic provided is used only for testing. 

To run the snapshot locally, run the command:

ganache-cli --db db --accounts 10 --mnemonic 'private key' --networkId 5777 --debug

1B. Run Ganache and deploy the Kyber contracts from scratch
If you wish to deploy the Kyber contracts yourself, you can run the following commands:

Run ganache-cli in one terminal session

ganache-cli --accounts 10 --mnemonic 'private key' --networkId 5777 --debug
In a new terminal session, connect to the ganache network, and run the truffle migration scripts

truffle migrate --network development
2. Running the example scripts
You can directly interact with the Kyber contracts on the Ganache network. We have provided some example scripts in the example directory.

For the Truffle examples:

truffle exec test/kyber/swapEtherToToken.js
truffle exec test/kyber/swapTokenToEther.js
truffle exec test/kyber/swapTokenToToken.js

For the Solidity examples, they are already deployed in the Ganache network using the Truffle migration scripts. You can interact with the Solidity examples using truffle console.