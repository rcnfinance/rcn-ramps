pragma solidity ^0.4.24;

import "./vendors/kyber/KyberNetworkProxy.sol";
import "./vendors/kyber/KyberNetwork.sol";
import "./vendors/kyber/ERC20Interface.sol";
import "./interfaces/TokenConverter.sol";
import "./interfaces/AvailableProvider.sol";
import "./utils/Ownable.sol";

contract KyberProxy is TokenConverter, AvailableProvider, Ownable {
    ERC20 constant internal ETH_TOKEN_ADDRESS = ERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);

    KyberNetworkProxy kyber;

    event Swap(address indexed sender, ERC20 srcToken, ERC20 destToken, uint amount);

    event WithdrawTokens(address _token, address _to, uint256 _amount);
    event WithdrawEth(address _to, uint256 _amount);
    event SetKyber(address _kyber);

    constructor (KyberNetworkProxy _kyber) public {
        kyber = _kyber;
        emit SetKyber(_kyber);
    }

    function setKyber(KyberNetworkProxy _kyber) external onlyOwner returns (bool) {
        kyber = _kyber;
        emit SetKyber(_kyber);

        return true;
    }

    function isAvailable(
        Token,
        Token,
        uint256
    ) external view returns (bool) {
        KyberNetworkProxy _kyber = kyber;

        return tx.gasprice <= _kyber.maxGasPrice() && _kyber.enabled();
    }

    function getReturnFrom(
        Token _from,
        Token _to,
        uint256 _srcQty
    ) external view returns (uint256) {
        (uint256 rate,) = kyber.getExpectedRate(ERC20(_from), ERC20(_to), _srcQty);

        return (_srcQty * rate) / 10 ** 18;
    }

    function convertFrom(
        Token _from,
        Token _to,
        uint256 _srcQty,
        uint256 _minReturn
    ) external payable returns (uint256 destAmount) {

        ERC20 srcToken = ERC20(_from);
        ERC20 destToken = ERC20(_to);

        if (srcToken == ETH_TOKEN_ADDRESS && destToken != ETH_TOKEN_ADDRESS) {
            require(msg.value == _srcQty, "ETH not enought");
            destAmount = execSwapEtherToToken(destToken, _srcQty, msg.sender);
        } else if (srcToken != ETH_TOKEN_ADDRESS && destToken == ETH_TOKEN_ADDRESS) {
            require(msg.value == 0, "ETH not required");
            destAmount = execSwapTokenToEther(srcToken, _srcQty, msg.sender);
        } else {
            require(msg.value == 0, "ETH not required");
            destAmount = execSwapTokenToToken(srcToken, _srcQty, destToken, msg.sender);
        }

        require(destAmount > _minReturn, "Return amount too low");
        emit Swap(msg.sender, srcToken, destToken, destAmount);

        return destAmount;
    }

    /*
    @dev Swap the user's ETH to ERC20 token
    @param token destination token contract address
    @param destAddress address to send swapped tokens to
    */
    function execSwapEtherToToken(
        ERC20 _token,
        uint _srcQty,
        address _destAddress
    ) internal returns (uint) {
        // Swap the ETH to ERC20 token
        uint destAmount = kyber.swapEtherToToken.value(_srcQty)(_token, 0);

        // Send the swapped tokens to the destination address
        require(_token.transfer(_destAddress, destAmount), "Error sending tokens");

        return destAmount;
    }

    /*
    @dev Swap the user's ERC20 token to ETH
    @param token source token contract address
    @param tokenQty amount of source tokens
    @param destAddress address to send swapped ETH to
    */
    function execSwapTokenToEther(
        ERC20 _token,
        uint256 _tokenQty,
        address _destAddress
    ) internal returns (uint) {

        // Check that the player has transferred the token to this contract
        require(_token.transferFrom(msg.sender, this, _tokenQty), "Error pulling tokens");

        // Set the spender's token allowance to tokenQty
        require(_token.approve(kyber, _tokenQty), "Error pulling tokens");

        // Swap the ERC20 token to ETH
        uint destAmount = kyber.swapTokenToEther(_token, _tokenQty, 0);

        // Send the swapped ETH to the destination address
        require(_destAddress.send(destAmount), "Error sending ETH");

        return destAmount;

    }

    /*
    @dev Swap the user's ERC20 token to another ERC20 token
    @param srcToken source token contract address
    @param srcQty amount of source tokens
    @param destToken destination token contract address
    @param destAddress address to send swapped tokens to
    */
    function execSwapTokenToToken(
        ERC20 _srcToken,
        uint256 _srcQty,
        ERC20 _destToken,
        address _destAddress
    ) internal returns (uint) {

        // Check that the player has transferred the token to this contract
        require(_srcToken.transferFrom(msg.sender, this, _srcQty), "Error pulling tokens");

        // Set the spender's token allowance to tokenQty
        require(_srcToken.approve(kyber, _srcQty), "Error approve transfer tokens");

        // Swap the ERC20 token to ERC20
        uint destAmount = kyber.swapTokenToToken(_srcToken, _srcQty, _destToken, 0);

        // Send the swapped tokens to the destination address
        require(_destToken.transfer(_destAddress, destAmount), "Error sending tokens");

        return destAmount;
    }

    function withdrawTokens(
        Token _token,
        address _to,
        uint256 _amount
    ) external onlyOwner returns (bool) {
        emit WithdrawTokens(_token, _to, _amount);
        return _token.transfer(_to, _amount);
    }

    function withdrawEther(
        address _to,
        uint256 _amount
    ) external onlyOwner {
        emit WithdrawEth(_to, _amount);
        _to.transfer(_amount);
    }

    function setConverter(
        KyberNetworkProxy _converter
    ) public onlyOwner returns (bool) {
        kyber = _converter;
    }

    function getConverter() public view returns (address) {
        return address(kyber);
    }

    function() external payable {}
}
