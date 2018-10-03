pragma solidity ^0.4.24;

import "./interfaces/AvailableProvider.sol";
import "./vendors/bancor/converter/BancorGasPriceLimit.sol";
import "./interfaces/TokenConverter.sol";

contract BancorAvailableProvider is TokenConverter, AvailableProvider, BancorGasPriceLimit {

    function isAvailable(address converter, uint256 _gasPrice) external view returns (bool) {
        return (gasPrice < BancorGasPriceLimit(converter).gasPrice());
    }

}


