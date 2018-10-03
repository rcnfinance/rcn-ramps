pragma solidity ^0.4.24;

import "./interfaces/TokenConverter.sol";
import "./interfaces/AvailableProvider.sol";
import "./interfaces/Token.sol";
import "./utils/Ownable.sol";
import "./vendors/bancor/converter/BancorGasPriceLimit.sol";

contract TokenConverterRoute is TokenConverter, Ownable {
    
    address public constant ETH_ADDRESS = 0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee;
    uint256 constant internal MAX_UINT = uint256(0) - 1;
    TokenConverter[] public converters;
    mapping (address => AvailableProvider) public availability;
    
    function addConverter(TokenConverter converter) onlyOwner external {
        converters.push(converter);
    }
    
    function addAvailableProvider(TokenConverter converter, AvailableProvider availabilityContract) onlyOwner external {
        availability[converter] = availabilityContract;        
    }
    
    function removeConverter(address converter) onlyOwner public returns (bool) {
        
        require(converter != address(0), "The address to remove not is available.");
        uint length = converters.length;
        require(length > 0, "Not exist element for remove.");
        
        for (uint i = 0; i < length; i++) {
            if (converters[i] == converter) {
                converters[i] =  converters[length-1];
                require(1 <= length, "Reverts on overflow.");
                converters.length--;
                return true;
            }
        }
        
        return false;
        
    }
    
    function convert(Token _from, Token _to, uint256 _amount, uint256 _minReturn) external payable returns (uint256) {
        
        if (_from == ETH_ADDRESS) {
            require(msg.value == _amount, "ETH not enought");
        } else {
            require(msg.value == 0, "ETH not required");
            require(_from.transferFrom(msg.sender, this, _amount), "Error pulling Token amount");
            require(_from.approve(converter, _amount), "Error approving token transfer");
        }

        address betterProxy = _getBetterProxy(_from, _to, _amount);        
        TokenConverter converter =  TokenConverter(betterProxy);
        uint result = converter.convert.value(msg.value)(_from, _to, _amount, _minReturn);

        if (_to == ETH_ADDRESS) {
            msg.sender.transfer(result);
        } else {
            require(_to.transfer(msg.sender, result), "Error sending tokens");
        }   

    }

    function getReturn(Token _from, Token _to, uint256 _amount) external view returns (uint256) {
        address betterProxy = _getBetterProxy(_from, _to, _amount);
        TokenConverter converter =  TokenConverter(betterProxy);
        return converter.getReturn(_from, _to, _amount);
    }
    
    function _getBetterProxy(Token _from, Token _to, uint256 _amount) private view returns (address) {
        uint minRate = MAX_UINT;
        address betterProxy = 0x0;
     
        uint length = converters.length;
        for (uint256 i = 0; i < length; i++) {
            
            TokenConverter converter = TokenConverter(converters[i]);
            if (_isAvailable(converter, tx.gasprice)) {
                
                uint newRate = converter.getReturn(_from, _to, _amount);
                if (newRate > 0 && newRate < minRate) {
                    minRate = newRate;
                    betterProxy = converter;
                }
                
            }
                
        }
        
        return betterProxy;
    }

    function _isAvailable(address converter, uint256 _gasPrice) private view returns (bool) {
        address provider = availability[converter];
        return AvailableProvider(provider).isAvailable(_gasPrice); 
    }

    function() external payable {}

}