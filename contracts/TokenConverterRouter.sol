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
    event Converted(address _converter, address _from, address _to, uint256 _amount, uint256 _return, uint256 _gasPrice);
    event SetAvailableProvider(address _converter, address _provider);
    event SetExtraLimit(uint256 _extraLimit);
    event RemovedConverter(address _converter);
    
    /*
     *  @notice External function isWorker.
     *  @dev Takes _worker, checks if the worker is valid. 
     *  @param _worker Worker address.
     *  @return bool True if worker is valid, false otherwise.
     */
    function _issetConverter(address _converter) internal view returns (bool) {
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
        require(!_issetConverter(_converter), "The converter it already exist");
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
        require(_issetConverter(_converter), "The converter is not exist.");
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
        AvailableProvider _provider
    ) external onlyOwner {
        emit SetAvailableProvider(_converter, _provider);
        availability[_converter] = _provider;        
    }
    
    function setExtraLimit(uint256 _extraLimit) external onlyOwner {
        emit SetExtraLimit(_extraLimit);
        extraLimit = _extraLimit;
    }

    function convert(Token _from, Token _to, uint256 _amount, uint256 _minReturn) external payable returns (uint256) {
        TokenConverter converter = _getBestConverter(_from, _to, _amount);

        if (_from == ETH_ADDRESS) {
            require(msg.value == _amount, "ETH not enought");
        } else {
            require(msg.value == 0, "ETH not required");
            require(_from.transferFrom(msg.sender, this, _amount), "Error pulling Token amount");
            require(_from.approve(converter, _amount), "Error approving token transfer");
        }

        uint256 result = converter.convert.value(msg.value)(_from, _to, _amount, _minReturn);
        require(result >= _minReturn, "Funds received not enought");

        emit Converted({
            _converter: converter,
            _from: _from,
            _to: _to,
            _amount: _amount,
            _return: result,
            _gasPrice: tx.gasprice
        });

        if (_from != ETH_ADDRESS) {
            require(_from.approve(converter, 0), "Error removing approve");
        }

        if (_to == ETH_ADDRESS) {
            msg.sender.transfer(result);
        } else {
            require(_to.transfer(msg.sender, result), "Error sending tokens");
        }

        if (_isSimulation()) {
            // this is a simulation, we need a pessimistic simulation we add
            // the extraLimit. reasons: this algorithm is not deterministic
            // different gas depending on the best route (Kyber, Bancor, etc)
            _addExtraGasLimit();
        }
    }

    function getReturn(Token _from, Token _to, uint256 _amount) external view returns (uint256) {
        return _getBestConverter(_from, _to, _amount).getReturn(_from, _to, _amount);
    }

    function _isSimulation() internal view returns (bool) {
        return gasleft() > block.gaslimit;
    }
    
    function _addExtraGasLimit() internal view {
        uint256 limit;
        uint256 startGas;
        while (limit < extraLimit) {          
            startGas = gasleft();
            assembly {
                let x := mload(0x0)
            }
            limit += startGas - gasleft();
        }
    }

    function _getBestConverter(Token _from, Token _to, uint256 _amount) internal view returns (TokenConverter) {
        uint maxRate;
        TokenConverter converter;
        TokenConverter best;
        uint length = converters.length;

        for (uint256 i = 0; i < length; i++) {
            converter = converters[i];
            if (_isAvailable(converter, _from, _to, _amount)) {
                uint newRate = converter.getReturn(_from, _to, _amount);
                if (newRate > maxRate) {
                    maxRate = newRate;
                    best = converter;
                }
            }
        }
        
        return best;
    }

    function _isAvailable(address converter, Token _from, Token _to, uint256 _amount) internal view returns (bool) {
        AvailableProvider provider = availability[converter];
        return provider != address(0) ? provider.isAvailable(_from, _to, _amount) : true;
    }

    function() external payable {}
}