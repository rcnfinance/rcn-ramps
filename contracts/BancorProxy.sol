pragma solidity ^0.4.19;


import "./interfaces/Token.sol";
import "./interfaces/TokenConverter.sol";
import "./vendors/bancor/converter/BancorConverter.sol";
import "./vendors/bancor/token/interfaces/IERC20Token.sol";
import "./utils/Ownable.sol";

contract BancorProxy is TokenConverter, Ownable {
    IBancorConverter converterEthBnt;

    mapping(address => mapping(address => BancorConverter)) public converterOf;
    mapping(address => mapping(address => address)) public routerOf;
    mapping(address => mapping(address => IERC20Token[])) public pathCache;

    Token ethToken;

    constructor(
        Token _ethToken
    ) public {
        ethToken = _ethToken;
    }

    function setConverter(
        Token _token1,
        Token _token2,
        BancorConverter _converter
    ) public onlyOwner returns (bool) {
        converterOf[_token1][_token2] = _converter;
        converterOf[_token2][_token1] = _converter;
        uint256 approve = uint256(0) - 1;
        require(_token1.approve(_converter, approve), "Error approving transfer token 1");
        require(_token2.approve(_converter, approve), "Error approving transfer token 2");
        clearCache(_token1, _token2);
        return true;
    }

    function setRouter(
        address _token1,
        address _token2,
        address _router
    ) external onlyOwner returns (bool) {
        routerOf[_token1][_token2] = _router;
        routerOf[_token2][_token1] = _router;
        return true;
    }

    function clearCache(
        Token _from,
        Token _to
    ) public onlyOwner returns (bool) {
        pathCache[_from][_to].length = 0;
        pathCache[_to][_from].length = 0;
        return true;
    }

    function getPath(
        BancorConverter _converter,
        Token _from,
        Token _to
    ) private returns (IERC20Token[]) {
        if (pathCache[_from][_to].length != 0) {
            return pathCache[_from][_to];
        } else {
            IERC20Token token = _converter.token();
            pathCache[_from][_to] = [IERC20Token(_from), token, IERC20Token(_to)];
            return pathCache[_from][_to];
        }
    }

    function getReturn(
        Token _from,
        Token _to,
        uint256 _sell
    ) external view returns (uint256 amount){
        return _getReturn(_from, _to, _sell);
    }

    function _getReturn(
        Token _from,
        Token _to,
        uint256 _sell
    ) internal view returns (uint256 amount){
        Token from = _from == ETH_ADDRESS ? Token(ethToken) : _from;
        Token to = _to == ETH_ADDRESS ? Token(ethToken) : _to;
        BancorConverter converter = converterOf[from][to];
        if (converter != address(0)) {
            return converter.getReturn(IERC20Token(from), IERC20Token(to), _sell);
        }

        Token router = Token(routerOf[from][to]);
        if (router != address(0)) {
            converter = converterOf[router][to];
            return converter.getReturn(
                IERC20Token(router),
                IERC20Token(to),
                _getReturn(from, router, _sell)
            );
        }
        revert("No routing found - BancorProxy");
    }

    function convert(
        Token _from,
        Token _to,
        uint256 _sell,
        uint256 _minReturn
    ) external payable returns (uint256 amount){
        Token from = _from == ETH_ADDRESS ? Token(ethToken) : _from;
        Token to = _to == ETH_ADDRESS ? Token(ethToken) : _to;

        if (from == ethToken) {
            require(msg.value == _sell, "ETH not enought");
        } else {
            require(msg.value == 0, "ETH not required");
            require(from.transferFrom(msg.sender, this, _sell), "Error pulling tokens");
        }

        amount = _convert(from, to, _sell);
        require(amount > _minReturn, "Return amount too low");

        if (to == ethToken) {
            msg.sender.transfer(amount);
        } else {
            require(to.transfer(msg.sender, amount), "Error sending tokens");
        }
    }

    function _convert(
        Token _from,
        Token _to,
        uint256 _fromAmount
    ) internal returns (uint256) {
        BancorConverter converter = converterOf[_from][_to];

        uint256 amount;
        if (converter != address(0)) {
            amount = converter.quickConvert.value(_from == ethToken ? _fromAmount : 0)(
                getPath(converter, _from, _to),
                _fromAmount,
                1
            );
        } else {
            Token router = Token(routerOf[_from][_to]);
            if (router != address(0)) {
                uint256 routerAmount = _convert(_from, router, _fromAmount);
                converter = converterOf[router][_to];
                amount = converter.quickConvert.value(router == ethToken ? routerAmount : 0)(
                    getPath(converter, router, _to),
                    routerAmount,
                    1
                );
            }
        }

        return amount;
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

    function() external payable {}
}
