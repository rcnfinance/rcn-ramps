pragma solidity ^0.4.19;

import "./interfaces/Engine.sol";
import "./interfaces/Cosigner.sol";
import "./utils/RpSafeMath.sol";
import "./KyberMock.sol";


contract KyberGateway is RpSafeMath {
    address constant internal ETH_TOKEN_ADDRESS = 0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee;

    Token public RCN;
    Token public ETH = Token(ETH_TOKEN_ADDRESS);

    constructor(Token _RCN) public {
        RCN = _RCN;
    }

    /**
        @notice TODO
        @dev TODO

        @param _kyber kyverNetwork market
        @param _rcnEngine the engine of RCN
        @param _index Index of the loan
        @param _cosigner Address of the cosigner, 0x0 for lending without cosigner.
        @param _cosignerData Data required by the cosigner to process the request.
        @param _oracleData Data required by the oracle to return the rate, the content of this field must be provided
            by the url exposed in the url() method of the oracle.

        @return true if the trade and lend was done successfully
    */
    function lend(
        KyberMock _kyber,
        Engine _rcnEngine,
        uint _index,
        Cosigner _cosigner,
        bytes _cosignerData,
        bytes _oracleData
    ) public payable returns (bool) {
        uint256 loanAmount = _rcnEngine.getAmount(_index);
        uint256 rateER;
        (rateER, ) = _kyber.getExpectedRate(ETH, RCN, loanAmount);
        rateER = 10**36 / rateER;

        uint256 targetAmountETH = _kyber.convertRate(loanAmount, rateER);
        uint256 returnAmount = safeSubtract(msg.value, targetAmountETH);
        uint256 totalTokens = _kyber.trade.value(targetAmountETH)(ETH, targetAmountETH, RCN, this, 10 ** 30, 0, this);

        RCN.approve(address(_rcnEngine), totalTokens);

        require(_rcnEngine.lend(_index, _oracleData, _cosigner, _cosignerData), "fail lend");

        require(_rcnEngine.transfer(msg.sender, _index), "fail transfer");

        msg.sender.transfer(returnAmount);// if the sender is a contract, the contract needs a fallback function payable

        return true;
    }
}
