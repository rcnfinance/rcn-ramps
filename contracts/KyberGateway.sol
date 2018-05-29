pragma solidity ^0.4.19;

import "./rcn/NanoLoanEngine.sol";
import "./kyber/interfaces/ERC20Interface.sol";
import "./kyber/KyberNetwork.sol";
import "./rcn/interfaces/Cosigner.sol";
import "./utils/RpSafeMath.sol";

contract KyberGateway is RpSafeMath {
    ERC20 constant internal ETH = ERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);

    /**
        @notice TODO
        @dev TODO

        @param _network kyverNetwork market
        @param _engine the engine of RCN
        @param _index Index of the loan
        @param _cosigner Address of the cosigner, 0x0 for lending without cosigner.
        @param _cosignerData Data required by the cosigner to process the request.
        @param _oracleData Data required by the oracle to return the rate, the content of this field must be provided
            by the url exposed in the url() method of the oracle.
        @param _minChangeRCN minimum repurchase change amount

        @return true if the trade and lend was done successfully
    */
    function lend(
        KyberNetwork _network,
        NanoLoanEngine _engine,
        uint _index,
        Cosigner _cosigner,
        bytes _cosignerData,
        bytes _oracleData,
        uint _minChangeRCN
    ) public payable returns (bool) {
        require(tx.gasprice <= _network.maxGasPrice(), "The gas price is too much");
        require(_network.enabled(), "The network is down");
        require(msg.value > 0);

        uint rcnAmount = getRequiredRcnLend(_engine, _index, _oracleData, _cosignerData);
        Token rcn = _engine.rcn();
        uint boughtRCN = _network.trade.value(msg.value)(ETH, msg.value, rcn, this, 10 ** 30, 0, 0);
        require(boughtRCN >= rcnAmount, "insufficient found");

        rcn.approve(address(_engine), rcnAmount);
        require(_engine.lend(_index, _oracleData, _cosigner, _cosignerData), "fail lend");
        require(_engine.transfer(msg.sender, _index), "fail transfer");

        uint change = safeSubtract(boughtRCN, rcnAmount);
        if(_minChangeRCN <= change){
            change = _network.trade(rcn, change, ETH, this, 10 ** 30, 0, this);
            msg.sender.transfer(change);
        }else{
            rcn.transfer(msg.sender, change);
        }

        return true;
    }

    /**
        @notice TODO
        @dev TODO

        @param _network kyverNetwork market
        @param _calculatedEthAmount pre-calculate amount of ETH
        @param _rcnAmount the expected amount of RCN

        @return the expected amount of ETH
    */
    function toETHAmount(
        KyberNetwork _network,
        uint _calculatedEthAmount,
        uint _rcnAmount,
        NanoLoanEngine _engine
    ) public view returns(uint){
        Token rcn = _engine.rcn();
        uint rate;
        (rate, ) = _network.getExpectedRate(ETH, rcn, _calculatedEthAmount);

        return (safeMult(10**18, _rcnAmount)/rate) + 1;// add one for the presicion
    }

    function getRequiredRcnLend(
        NanoLoanEngine _engine,
        uint _index,
        bytes _oracleData,
        bytes _cosignerData
    ) public returns(uint required){
        Cosigner cosigner = Cosigner(_engine.getCosigner(_index));

        if (cosigner != address(0)) {
            required += cosigner.cost(_engine, _index, _oracleData, _cosignerData);
        }
        required += _engine.convertRate(_engine.getOracle(_index), _engine.getCurrency(_index), _oracleData, _engine.getAmount(_index));
    }
}
