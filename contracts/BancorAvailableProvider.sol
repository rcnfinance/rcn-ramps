pragma solidity ^0.4.24;

import "./interfaces/AvailableProvider.sol";
import "./vendors/bancor/converter/BancorGasPriceLimit.sol";
import "./interfaces/TokenConverter.sol";
import "./utils/Ownable.sol";

contract BancorAvailableProvider is AvailableProvider, Ownable {
    
    address converter; 
    
    constructor (address _converter) public {
        converter = _converter;
    }

    function isAvailable(uint256 _gasPrice) external view returns (bool) {
        return (_gasPrice < BancorGasPriceLimit(converter).gasPrice());
    }
    
    function setConverter(address _converter) onlyOwner external {
        converter = _converter;
    }

}


