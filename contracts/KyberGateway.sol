pragma solidity ^0.4.19;

import "./rcn/NanoLoanEngine.sol";
import "./kyber/interfaces/ERC20Interface.sol";
import "./kyber/KyberNetwork.sol";
import "./rcn/interfaces/Cosigner.sol";
import "./utils/RpSafeMath.sol";

contract KyberGateway is RpSafeMath {
    ERC20 constant internal ETH = ERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);
    uint constant internal MAX_UINT = 2**256 - 1;

    /**
        @notice Performs the a trade on kyber network and pay an amount on loan in nanoLoanEngine

        @param _network kyverNetwork market
        @param _engine the engine of RCN
        @param _index Index of the loan
        @param _amount Amount of pay in loan currency
        @param _oracleData Data required by the oracle to return the rate, the content of this field must be provided
            by the url exposed in the url() method of the oracle.
        @param _minChangeRCN minimum repurchase change amount

        @return true if the trade and pay was done successfully
    */
    function pay(
        KyberNetwork _network,
        NanoLoanEngine _engine,
        uint _index,
        uint _amount,
        bytes _oracleData,
        uint _minChangeRCN,
        uint _minConversionRate
    ) public payable returns (bool) {
        require(msg.value > 0);

        Token rcn = _engine.rcn();
        uint initialBalance = rcn.balanceOf(this);

        uint boughtRCN = _network.trade.value(msg.value)(ETH, msg.value, rcn, this, MAX_UINT, _minConversionRate, 0);
        require(rcn.balanceOf(this) - initialBalance == boughtRCN);

        uint requiredRcn = _engine.convertRate(_engine.getOracle(_index), _engine.getCurrency(_index), _oracleData, _amount);
        require(boughtRCN >= requiredRcn, "insufficient found");

        rcn.approve(address(_engine), requiredRcn);
        require(_engine.pay(_index, requiredRcn, msg.sender, _oracleData));
        rcn.approve(address(_engine), 0);

        require(rebuyAndReturn(_network, rcn, _minChangeRCN, safeSubtract(boughtRCN, requiredRcn)));
        require(rcn.balanceOf(this) == initialBalance);

        return true;
    }

    /**
        @notice Performs the a trade on kyber network and lend a loan in nanoLoanEngine

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
        uint _minChangeRCN,
        uint _minConversionRate
    ) public payable returns (bool) {
        require(msg.value > 0);

        Token rcn = _engine.rcn();
        uint initialBalance = rcn.balanceOf(this);

        uint boughtRCN = _network.trade.value(msg.value)(ETH, msg.value, rcn, this, MAX_UINT, _minConversionRate, this);
        require(rcn.balanceOf(this) - initialBalance == boughtRCN);

        uint requiredRcn = getRequiredRcnLend(_engine, _index, _cosignerData, _oracleData);
        require(boughtRCN >= requiredRcn, "insufficient found");

        rcn.approve(address(_engine), requiredRcn);
        require(_engine.lend(_index, _oracleData, _cosigner, _cosignerData), "fail lend");
        rcn.approve(address(_engine), 0);

        require(_engine.transfer(msg.sender, _index), "fail transfer");
        require(rebuyAndReturn(_network, rcn, _minChangeRCN, safeSubtract(boughtRCN, requiredRcn)));
        require(rcn.balanceOf(this) == initialBalance);

        return true;
    }
    /**
        @notice rebuy ETH and transfer to the sender or transfer the change on RCN to the sender

        @param _network kyverNetwork market
        @param _rcn RCN token
        @param _minChangeRCN minimum repurchase change amount
        @param _change amount of change on RCN of the previous trade

        @return true if the trade was done successfully or if the transfer of RCN was done successfully
    */
    function rebuyAndReturn(
        KyberNetwork _network,
        Token _rcn,
        uint _minChangeRCN,
        uint _change
    ) internal returns (bool) {
        if (_change != 0) {
            if(_minChangeRCN < _change){
                uint prevBalanceUser = msg.sender.balance;
                _rcn.approve(address(_network), _change);
                _change = _network.trade.value(0)(_rcn, _change, ETH, msg.sender, MAX_UINT, 0, this);
                _rcn.approve(address(_network), 0);
                require(msg.sender.balance - prevBalanceUser == _change);
            }else{
                require(_rcn.transfer(msg.sender, _change), "RCN transfer fail");
            }
        }
        return true;
    }
    /**
        @notice get the require amount of RCN to performs a lend

        @param _engine the engine of RCN
        @param _index Index of the loan
        @param _oracleData Data required by the oracle to return the rate, the content of this field must be provided
            by the url exposed in the url() method of the oracle.
        @param _cosignerData Data required by the cosigner to process the request.

        @return require amount of RCN
    */
    function getRequiredRcnLend(
        NanoLoanEngine _engine,
        uint _index,
        bytes _cosignerData,
        bytes _oracleData
    ) public returns(uint required){
        Cosigner cosigner = Cosigner(_engine.getCosigner(_index));

        if (cosigner != address(0)) {
            required += cosigner.cost(_engine, _index, _oracleData, _cosignerData);
        }
        required += _engine.convertRate(_engine.getOracle(_index), _engine.getCurrency(_index), _oracleData, _engine.getAmount(_index));
    }
}
