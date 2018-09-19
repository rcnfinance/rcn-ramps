pragma solidity ^0.4.24;

import "./vendors/kyber/KyberNetworkProxy.sol";
import "./vendors/kyber/ERC20Interface.sol";
import "./interfaces/TokenConverter.sol";
import "./utils/Ownable.sol";

contract KyberProxy is TokenConverter, Ownable {
    
    uint256 private constant MAX_UINT = uint256(0) - 1;

    KyberNetworkProxy public converter;
    Token ethToken;

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
    ) external payable returns (uint256 amount) {

        require(msg.value == 0, "ETH not required");
        
        amount = _convert(ERC20(srcToken), ERC20(destToken), srcQty);
        require(amount > minReturn, "Return amount too low");
        require(destToken.transfer(msg.sender, amount), "Error sending tokens");
        
        return amount;
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

        uint destAmount = converter.trade(
            srcToken, 
            srcQty, 
            destToken, 
            this, 
            MAX_UINT, 
            minConversionRate, 
            0x0
        );

        // Send the swapped tokens to the destination address
        emit Swap(msg.sender, srcToken, destToken, destAmount);

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
       converter = _converter;
    }

    function() external payable {}
	
}