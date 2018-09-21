pragma solidity ^0.4.24;

import "./vendors/kyber/KyberNetworkProxy.sol";
import "./vendors/kyber/KyberNetwork.sol";
import "./vendors/kyber/ERC20Interface.sol";
import "./interfaces/TokenConverter.sol";
import "./utils/Ownable.sol";

contract KyberProxy is TokenConverter, Ownable {
    
    uint256 private constant MAX_UINT = uint256(0) - 1;

    KyberNetworkProxy kyber;
    Token ethToken;

    event ETHReceived(address indexed sender, uint amount);
    event Swap(address indexed sender, Token srcToken, Token destToken, uint amount);

    constructor (Token _ethToken, KyberNetworkProxy _kyber) public {
        ethToken = _ethToken;
        kyber = _kyber;
    }

    function getReturn(
        Token from,
        Token to, 
        uint256 srcQty
    ) external view returns (uint256) {
        ERC20 srcToken = ERC20(from);
        ERC20 destToken = ERC20(to);   
        (uint256 amount,) = kyber.getExpectedRate(srcToken, destToken, srcQty);
        return amount;
    }

    function convert(
        Token srcToken,
        Token destToken, 
        uint256 srcQty, 
        uint256 minReturn
    ) external payable returns (uint256 destAmount) {
        
        destAmount = _convert(srcToken, destToken, srcQty);
        require(destAmount > minReturn, "Return amount too low");
        
        if (destToken == ethToken)
            msg.sender.transfer(destAmount);
        else    
            require(destToken.transfer(msg.sender, destAmount), "Error sending tokens");

        emit Swap(msg.sender, srcToken, destToken, destAmount);
        return destAmount;
    }

    function _convert(
        Token from,
        Token to,   
        uint256 srcQty
    ) internal returns (uint256) {

        ERC20 srcToken = ERC20(from);
        ERC20 destToken = ERC20(to);       
        
        // Check that the player has transferred the token to this contract
        require(srcToken.transferFrom(msg.sender, this, srcQty), "Error pulling tokens");
        require(srcToken.approve(kyber, srcQty));

        uint minConversionRate = this.getReturn(from, to, srcQty);

        if (ethToken == ETH_ADDRESS) 
            destAmount = kyber.swapEtherToToken.value(msg.value)(srcToken, minConversionRate);
        else 
            uint destAmount = kyber.trade(
                srcToken,           // srcToken
                srcQty,             // srcQty
                destToken,          // destToken 
                this,               // destAddress
                MAX_UINT,           // maxDestAmount
                minConversionRate,  // minConversionRate
                0                   // walletId
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

    function setConverter(
        KyberNetworkProxy _converter
    ) public onlyOwner returns (bool) {
       kyber = _converter;
    }

    function() external payable {
        emit ETHReceived(msg.sender, msg.value);
    }
	
}