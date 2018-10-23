pragma solidity ^0.4.24;

import "./interfaces/AvailableProvider.sol";
import "./vendors/bancor/converter/BancorGasPriceLimit.sol";
import "./interfaces/TokenConverter.sol";
import "./utils/Ownable.sol";

contract BancorAvailableProvider is AvailableProvider, Ownable {
    
    BancorGasPriceLimit gasPriceLimit;

    event SetGasPriceLimitSource(address _source);
    
    constructor (BancorGasPriceLimit _gasPriceLimit) public {
        gasPriceLimit = _gasPriceLimit;
    }

    function isAvailable(Token, Token, uint256) external view returns (bool) {
        return tx.gasprice <= gasPriceLimit.gasPrice();
    }
    
    function setGasPriceLimit(BancorGasPriceLimit _gasPriceLimit) external onlyOwner {
        emit SetGasPriceLimitSource(_gasPriceLimit);
        gasPriceLimit = _gasPriceLimit;
    }

}


