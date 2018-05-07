pragma solidity ^0.4.19;

import "./KyberMock.sol";
import "./KyberGateway.sol";
import "./utils/test/ripiocredit/NanoLoanEngine.sol";
import "./utils/RpSafeMath.sol";


contract TestWallet is RpSafeMath {
    event Deposit(address addr, uint256 amount);
    event Trade(Token src, uint amountETH, Token dest, uint amountRCN);

    KyberMock kyberMock;
    KyberGateway kyberGate;

    constructor(KyberMock _kyberMock, KyberGateway _kyberGate) public {
        kyberMock = _kyberMock;
        kyberGate = _kyberGate;
    }

    function() public payable {
        deposit();
    }

    function deposit() public payable {
        emit Deposit(msg.sender, msg.value);
    }

    function getContractBalance() public view returns(uint256){
        return address(this).balance;
    }

    function executeTrade(Token _src, uint _srcAmount, Token _dest) public returns(uint256){
        require(getContractBalance() >= _srcAmount, "executeTrade, Insufficient funds");

        uint256 totalTokens = kyberMock.trade.value(_srcAmount)(_src, _srcAmount, _dest, this, 10 ** 30, 0, this);

        emit Trade(_src, _srcAmount, _dest, totalTokens);

        return totalTokens;
    }

    function executeLend(uint256 _targetAmountETH, KyberMock _kyberMock, NanoLoanEngine _rcnEngine, uint256 _idLoan, Cosigner _cosigner,
        bytes _cosignerData, bytes _oracleData) public {
          require(getContractBalance() >= _targetAmountETH, "executeLend, Insufficient funds");

          kyberGate.lend.value(_targetAmountETH)(_kyberMock, _rcnEngine, _idLoan, _cosigner, _cosignerData, _oracleData);
    }
}
