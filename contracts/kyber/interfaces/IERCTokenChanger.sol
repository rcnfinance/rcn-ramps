pragma solidity ^0.4.23;


contract IERCTokenChanger {
    // ERC TokenChanger
    function changeableTokenCount() public constant returns (uint16 count);
    function changeableToken(uint16 _tokenIndex) public constant returns (address tokenAddress);
    function getReturn(address _fromToken, address _toToken, uint256 _amount) public constant returns (uint256 amount);
    function change(address _fromToken, address _toToken, uint256 _amount, uint256 _minReturn) public returns (uint256 amount);
    // Events
    event Update();
    event Change(address indexed _fromToken, address indexed _toToken, address indexed _changer, uint256 _amount, uint256 _return);
}
