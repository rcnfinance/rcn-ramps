pragma solidity ^0.4.24;

import "./vendors/kyber/KyberNetworkProxy.sol";
import "./vendors/kyber/ERC20Interface.sol";
import "./interfaces/TokenConverter.sol";
import "./utils/Ownable.sol";

contract KyberProxy is TokenConverter, Ownable {
      
    mapping(address => mapping(address => KyberNetworkProxy)) public converterOf;
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
        uint256 amount;
        KyberNetworkProxy converter = converterOf[srcToken][destToken];
        (amount,) = converter.getExpectedRate(ERC20(srcToken), ERC20(destToken), srcQty);
        return amount;
    }

    function convert(
        Token _from,
        Token _to, 
        uint256 _sell, 
        uint256 minReturn
    ) external payable returns (uint256 amount) {

        Token from = _from == ETH_ADDRESS ? Token(ethToken) : _from;
        Token to = _to == ETH_ADDRESS ? Token(ethToken) : _to;

        if (from == ethToken) {
            require(msg.value == _sell, "ETH not enought");
        } else {
            require(msg.value == 0, "ETH not required");
            require(from.transferFrom(msg.sender, this, _sell), "Error pulling tokens");
        }

        amount = _convert(ERC20(from), ERC20(to), _sell);
        require(amount > minReturn, "Return amount too low");

        if (to == ethToken) {
            msg.sender.transfer(amount);
        } else {
            require(to.transfer(msg.sender, amount), "Error sending tokens");
        }

    }

    function _convert(
        ERC20 srcToken,
        ERC20 destToken,   
        uint256 srcQty
    ) internal returns (uint256) {
        
        KyberNetworkProxy converter = converterOf[srcToken][destToken];
        
        // Check that the player has transferred the token to this contract
        require(srcToken.transferFrom(msg.sender, this, srcQty));

        // Mitigate ERC20 Approve front-running attack, by initially setting
        // allowance to 0
        // Set the spender's token allowance to tokenQty
        require(srcToken.approve(converter, 0));
        require(srcToken.approve(converter, srcQty));

        uint minConversionRate;
        (minConversionRate,) = converter.getExpectedRate(srcToken, ERC20(ETH_ADDRESS), srcQty);

        uint destAmount = converter.swapTokenToToken(
            srcToken, 
            srcQty, 
            destToken, 
            minConversionRate
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
        Token _token1,
        Token _token2,
        KyberNetworkProxy _converter
    ) public onlyOwner returns (bool) {
        converterOf[_token1][_token2] = _converter;
        converterOf[_token2][_token1] = _converter;
        uint256 approve = uint256(0) - 1;
        require(_token1.approve(_converter, approve), "Error approving transfer token 1");
        require(_token2.approve(_converter, approve), "Error approving transfer token 2");

        return true;
    }

    function() external payable {}
	
}