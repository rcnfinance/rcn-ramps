pragma solidity ^0.4.24;

import "./interfaces/TokenConverter.sol";
import "./interfaces/AvailableProvider.sol";
import "./interfaces/Token.sol";
import "./utils/Ownable.sol";
import "./vendors/bancor/converter/BancorGasPriceLimit.sol";

contract TokenConverterRouter is TokenConverter, Ownable {
    address public constant ETH_ADDRESS = 0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee;

    TokenConverter[] public converters;
    
    mapping(address => uint256) private converterToIndex;    
    mapping (address => AvailableProvider) public availability;

    uint256 extraLimit;
    
    event AddedConverter(address _converter);
    event RemovedConverter(address _converter);
    
    /*
     *  @notice External function isWorker.
     *  @dev Takes _worker, checks if the worker is valid. 
     *  @param _worker Worker address.
     *  @return bool True if worker is valid, false otherwise.
     */
    function issetConverter(address _converter) private view returns (bool) {
        return converterToIndex[_converter] != 0;
    }
    
    /*
    *  @notice External function allConverters.
    *  @dev Return all convertes.
    *  @return array with all address the converters.
    */
    function getConverters() external view returns (address[] memory result) {
        result = new address[](converters.length - 1);
        for (uint256 i = 1; i < converters.length; i++) {
            result[i - 1] = converters[i];
        }
    }
    
    /*
     *  @notice External function addConverter.
     *  @dev Takes _converter.
     *       Add converter.
     *  @param _converter Converter address.
     *  @return bool True if converter is added, false otherwise.
     */
    function addConverter(TokenConverter _converter) external onlyOwner returns (bool) {
        require(!issetConverter(_converter), "The converter it already exist");
        uint256 index = converters.push(_converter) - 1;
        converterToIndex[_converter] = index;
        emit AddedConverter(_converter);
        return true;
    }
    
    /*
     *  @notice External function removeConverter.
     *  @dev Takes _converter and removes the converter.
     *  @param _worker Converter address.
     *  @return bool true if existed, false otherwise.
     */
    function removeConverter(address _converter) external onlyOwner returns (bool) {
        require(issetConverter(_converter), "The converter is not exist.");
        uint256 index = converterToIndex[_converter];
        TokenConverter lastConverter = converters[converters.length - 1];
        converterToIndex[lastConverter] = index;
        converters[index] = lastConverter;
        converters.length--;
        delete converterToIndex[_converter];
        emit RemovedConverter(_converter);
        return true;
    }
    
    function setAvailableProvider(
        TokenConverter _converter,
        AvailableProvider _availabilityContract
    ) external onlyOwner {
        require(issetConverter(_converter), "The converter is not exist.");
        availability[_converter] = _availabilityContract;        
    }
    
    function convert(Token _from, Token _to, uint256 _amount, uint256 _minReturn) external payable returns (uint256) {
        TokenConverter converter = _getBetterProxy(_from, _to, _amount);

        if (_from == ETH_ADDRESS) {
            require(msg.value == _amount, "ETH not enought");
        } else {
            require(msg.value == 0, "ETH not required");
            require(_from.transferFrom(msg.sender, this, _amount), "Error pulling Token amount");
            require(_from.approve(converter, _amount), "Error approving token transfer");
        }

        uint result = converter.convert.value(msg.value)(_from, _to, _amount, _minReturn);

        if (_from != ETH_ADDRESS) {
            require(_from.approve(converter, 0), "Error removing approve");
        }

        if (_to == ETH_ADDRESS) {
            msg.sender.transfer(result);
        } else {
            require(_to.transfer(msg.sender, result), "Error sending tokens");
        }

        if (isSimulation()) {
            // this is a simulation, we need a pessimistic simulation we add
            // the extraLimit. reasons: this algorithm is not deterministic
            // different gas depending on the best route (Kyber, Bancor, etc)
            addExtraGasLimit();
        }
    }

    function getReturn(Token _from, Token _to, uint256 _amount) external view returns (uint256) {
        return _getBetterProxy(_from, _to, _amount).getReturn(_from, _to, _amount);
    }

    function isSimulation() private view returns (bool) {
        return (gasleft() > block.gaslimit); 
    }
    
    function addExtraGasLimit() internal {
        uint256 limit = 0;
        while (limit < extraLimit) {          
            uint256 startGas = gasleft();
            assembly { create() }
            limit += (startGas - gasleft());
        }
    }

    function _getBetterProxy(Token _from, Token _to, uint256 _amount) internal view returns (TokenConverter) {
        uint maxRate;
        TokenConverter converter;
        TokenConverter betterProxy;
        uint length = converters.length;

        for (uint256 i = 0; i < length; i++) {
            converter = TokenConverter(converters[i]);
            if (_isAvailable(converter, _from, _to, _amount)) {
                uint newRate = converter.getReturn(_from, _to, _amount);
                if (newRate > maxRate) {
                    maxRate = newRate;
                    betterProxy = converter;
                }
            }
        }
        
        return betterProxy;
    }

    function _isAvailable(address converter, Token _from, Token _to, uint256 _amount) private view returns (bool) {
        address provider = availability[converter];
        return AvailableProvider(provider).isAvailable(_from, _to, _amount); 
    }

    function setExtraLimit(uint256 _extraLimit) public onlyOwner {
        extraLimit = _extraLimit;
    }

    function() external payable {}

}