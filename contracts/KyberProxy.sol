pragma solidity ^0.4.24;

import "./vendors/kyber/KyberNetworkProxy.sol";
import "./vendors/kyber/ERC20Interface.sol";
import "./interfaces/TokenConverter.sol";
import "./utils/Ownable.sol";

contract KyberProxy is TokenConverter, Ownable {
    
    uint256 private constant MAX_UINT = uint256(0) - 1;

    KyberNetworkProxy public converter;
    Token ethToken;

    event ETHReceived(address indexed sender, uint amount);
    event Swap(address indexed sender, ERC20 srcToken, ERC20 destToken, uint amount);

    constructor(Token _ethToken) public {
        ethToken = _ethToken;
    }

    function getReturn(
        Token srcToken, 
        Token destToken, 
        uint256 srcQty
    ) external view returns (uint256) {
        (uint256 amount,) = converter.getExpectedRate(ERC20(srcToken), ERC20(destToken), srcQty);
        return amount;
    }

    function convert(
        Token srcToken,
        Token destToken, 
        uint256 srcQty, 
        uint256 minReturn
    ) external payable returns (uint256 destAmount) {
        
        destAmount = _convert(ERC20(srcToken), ERC20(destToken), srcQty);
        require(destAmount > minReturn, "Return amount too low");
        
        if (ERC20(destToken) == ERC20(ethToken))
            msg.sender.transfer(destAmount);
        else    
            require(destToken.transfer(msg.sender, destAmount), "Error sending tokens");

        emit Swap(msg.sender, ERC20(srcToken), ERC20(destToken), destAmount);
        return destAmount;
    }

    function _convert(
        ERC20 srcToken,
        ERC20 destToken,   
        uint256 srcQty
    ) internal returns (uint256) {
                
        // Check that the player has transferred the token to this contract
        require(srcToken.transferFrom(msg.sender, this, srcQty), "Error pulling tokens");
        require(srcToken.approve(converter, srcQty));

        (uint minConversionRate,) = converter.getExpectedRate(srcToken, ERC20(ETH_ADDRESS), srcQty);

        if (ERC20(ethToken) == ERC20(ETH_ADDRESS)) {
            destAmount = converter.swapEtherToToken.value(msg.value)(srcToken, minConversionRate);
            return destAmount;
        }

        uint destAmount = converter.trade(
            srcToken,
            srcQty, 
            destToken, 
            this, 
            MAX_UINT, 
            minConversionRate, 
            0
        );

        return destAmount;

    } 

    function withdrawTokens(
        Token _token,
        address _to,
        uint256 _amount
    ) external onlyOwner returns (bool) {
        return _token.transfer(_to, _amount);
    }

    function withdrawEther(
        address _to,
        uint256 _amount
    ) external onlyOwner {
        _to.transfer(_amount);
    }

    /*
    *  @notice Can only be called by operators
    *  @dev Sets the KyberNetworkProxy address
    *  @param _converter KyberNetworkProxy contract address
    */
    function setConverter(
        KyberNetworkProxy _converter
    ) public onlyOwner returns (bool) {
       converter = _converter;
    }

    function() external payable {
        emit ETHReceived(msg.sender, msg.value);
    }
	
}