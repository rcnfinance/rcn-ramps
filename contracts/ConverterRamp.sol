pragma solidity ^0.4.19;

import "./interfaces/TokenConverter.sol";
import "./rcn/interfaces/Engine.sol";
import "./utils/LrpSafeMath.sol";


contract ConverterRamp is Ownable {
    using LrpSafeMath for uint256;

    address public constant ETH_ADDRESS = 0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee;
    uint256 public constant AUTO_MARGIN = 1000001;
    // index of convert rules for pay and lend
    uint256 public constant I_MARGIN_SPEND = 0;    // Extra sell percent of amount, 100.000 = 100%
    uint256 public constant I_MAX_SPEND = 1;       // Max spend on perform a sell, 0 = maximum
    uint256 public constant I_REBUY_THRESHOLD = 2; // Threshold of rebuy change, 0 if want to rebuy always
    // index of loan parameters for pay and lend
    uint256 public constant I_ENGINE = 0;     // NanoLoanEngine contract
    uint256 public constant I_INDEX = 1;      // Loan index on Loans array of NanoLoanEngine
    // for pay
    uint256 public constant I_PAY_AMOUNT = 2; // Amount to pay of the loan
    uint256 public constant I_PAY_FROM = 3;   // The identity of the payer of loan
    // for lend
    uint256 public constant I_LEND_COSIGNER = 2; // Cosigner contract

    event RequiredRebuy(address token, uint256 amount);
    event Return(address token, address to, uint256 amount);
    event OptimalSell(address token, uint256 amount);
    event RequiredRcn(uint256 required);
    event RunAutoMargin(uint256 loops, uint256 increment);

    function pay(
        TokenConverter _converter,
        Token _fromToken,
        bytes32[4] _loanParams,
        bytes _oracleData,
        uint256[3] _convertRules
    ) external payable returns (bool) {
        Token rcn = Engine(address(_loanParams[I_ENGINE])).rcn();

        uint256 initialBalance = rcn.balanceOf(this);
        uint256 requiredRcn = _getRequiredRcnPay(_loanParams, _oracleData);
        emit RequiredRcn(requiredRcn);

        uint256 optimalSell = _getOptimalSell(_converter, _fromToken, rcn, requiredRcn, _convertRules[I_MARGIN_SPEND]);
        emit OptimalSell(_fromToken, optimalSell);

        pullAmount(_fromToken, optimalSell);
        uint256 bought = _convertSafe(_converter, _fromToken, rcn, optimalSell);

        // Pay loan
        require(
            _executeOptimalPay({
                _params: _loanParams,
                _oracleData: _oracleData,
                _rcnToPay: bought
            }),
            "Error paying the loan"
        );

        require(
            _rebuyAndReturn({
                _converter: _converter,
                _fromToken: rcn,
                _toToken: _fromToken,
                _amount: rcn.balanceOf(this) - initialBalance,
                _spentAmount: optimalSell,
                _convertRules: _convertRules
            }),
            "Error rebuying the tokens"
        );

        require(rcn.balanceOf(this) == initialBalance, "Converter balance has incremented");
        return true;
    }

    function requiredLendSell(
        TokenConverter _converter,
        Token _fromToken,
        bytes32[3] _loanParams,
        bytes _oracleData,
        bytes _cosignerData,
        uint256[3] _convertRules
    ) external returns (uint256) {
        Token rcn = Engine(address(_loanParams[I_ENGINE])).rcn();
        return _getOptimalSell(
            _converter,
            _fromToken,
            rcn,
            _getRequiredRcnLend(_loanParams, _oracleData, _cosignerData),
            _convertRules[I_MARGIN_SPEND]
        );
    }

    function requiredPaySell(
        TokenConverter _converter,
        Token _fromToken,
        bytes32[4] _loanParams,
        bytes _oracleData,
        uint256[3] _convertRules
    ) external returns (uint256) {
        Token rcn = Engine(address(_loanParams[I_ENGINE])).rcn();
        return _getOptimalSell(
            _converter,
            _fromToken,
            rcn,
            _getRequiredRcnPay(_loanParams, _oracleData),
            _convertRules[I_MARGIN_SPEND]
        );
    }

    function lend(
        TokenConverter _converter,
        Token _fromToken,
        bytes32[3] _loanParams,
        bytes _oracleData,
        bytes _cosignerData,
        uint256[3] _convertRules
    ) external payable returns (bool) {
        Token rcn = Engine(address(_loanParams[I_ENGINE])).rcn();
        uint256 initialBalance = rcn.balanceOf(this);
        uint256 requiredRcn = _getRequiredRcnLend(_loanParams, _oracleData, _cosignerData);
        emit RequiredRcn(requiredRcn);

        uint256 optimalSell = _getOptimalSell(_converter, _fromToken, rcn, requiredRcn, _convertRules[I_MARGIN_SPEND]);
        emit OptimalSell(_fromToken, optimalSell);

        pullAmount(_fromToken, optimalSell);
        uint256 bought = _convertSafe(_converter, _fromToken, rcn, optimalSell);

        // Lend loan
        require(rcn.approve(address(_loanParams[0]), bought), "Error approving lend token transfer");
        require(_executeLend(_loanParams, _oracleData, _cosignerData), "Error lending the loan");
        require(rcn.approve(address(_loanParams[0]), 0), "Error removing approve");
        require(_executeTransfer(_loanParams, msg.sender), "Error transfering the loan");

        require(
            _rebuyAndReturn({
                _converter: _converter,
                _fromToken: rcn,
                _toToken: _fromToken,
                _amount: rcn.balanceOf(this) - initialBalance,
                _spentAmount: optimalSell,
                _convertRules: _convertRules
            }),
            "Error rebuying the tokens"
        );

        require(rcn.balanceOf(this) == initialBalance, "The contract balance should not change");

        return true;
    }

    function pullAmount(
        Token _token,
        uint256 _amount
    ) private {
        if (_token == ETH_ADDRESS) {
            require(msg.value >= _amount, "Error pulling ETH amount");
            if (msg.value > _amount) {
                msg.sender.transfer(msg.value - _amount);
            }
        } else {
            require(_token.transferFrom(msg.sender, this, _amount), "Error pulling Token amount");
        }
    }

    function transfer(
        Token _token,
        address _to,
        uint256 _amount
    ) private {
        if (_token == ETH_ADDRESS) {
            _to.transfer(_amount);
        } else {
            require(_token.transfer(_to, _amount), "Error sending tokens");
        }
    }

    function _rebuyAndReturn(
        TokenConverter _converter,
        Token _fromToken,
        Token _toToken,
        uint256 _amount,
        uint256 _spentAmount,
        uint256[3] memory _convertRules
    ) internal returns (bool) {
        uint256 threshold = _convertRules[I_REBUY_THRESHOLD];
        uint256 bought = 0;

        if (_amount != 0) {
            if (_amount > threshold) {
                bought = _convertSafe(_converter, _fromToken, _toToken, _amount);
                emit RequiredRebuy(_toToken, _amount);
                emit Return(_toToken, msg.sender, bought);
                transfer(_toToken, msg.sender, bought);
            } else {
                emit Return(_fromToken, msg.sender, _amount);
                transfer(_fromToken, msg.sender, _amount);
            }
        }

        uint256 maxSpend = _convertRules[I_MAX_SPEND];
        require(_spentAmount.safeSubtract(bought) <= maxSpend || maxSpend == 0, "Max spend exceeded");

        return true;
    }

    function _getOptimalSell(
        TokenConverter _converter,
        Token _fromToken,
        Token _toToken,
        uint256 _requiredTo,
        uint256 _extraSell
    ) internal returns (uint256 sellAmount) {
        uint256 sellRate = (10 ** 18 * _converter.getReturn(_toToken, _fromToken, _requiredTo)) / _requiredTo;
        if (_extraSell == AUTO_MARGIN) {
            uint256 expectedReturn = 0;
            uint256 optimalSell = _applyRate(_requiredTo, sellRate);
            uint256 increment = _applyRate(_requiredTo / 100000, sellRate);
            uint256 returnRebuy;
            uint256 cl;

            while (expectedReturn < _requiredTo && cl < 10) {
                optimalSell += increment;
                returnRebuy = _converter.getReturn(_fromToken, _toToken, optimalSell);
                optimalSell = (optimalSell * _requiredTo) / returnRebuy;
                expectedReturn = returnRebuy;
                cl++;
            }
            emit RunAutoMargin(cl, increment);

            return optimalSell;
        } else {
            return _applyRate(_requiredTo, sellRate).safeMult(uint256(100000).safeAdd(_extraSell)) / 100000;
        }
    }

    function _convertSafe(
        TokenConverter _converter,
        Token _fromToken,
        Token _toToken,
        uint256 _fromAmount
    ) internal returns (uint256 bought) {
        if (_fromToken != ETH_ADDRESS) require(_fromToken.approve(_converter, _fromAmount), "Error approving token transfer");
        uint256 prevBalance = _toToken != ETH_ADDRESS ? _toToken.balanceOf(this) : address(this).balance;
        uint256 sendEth = _fromToken == ETH_ADDRESS ? _fromAmount : 0;
        uint256 boughtAmount = _converter.convert.value(sendEth)(_fromToken, _toToken, _fromAmount, 1);
        require(
            boughtAmount == (_toToken != ETH_ADDRESS ? _toToken.balanceOf(this) : address(this).balance) - prevBalance,
            "Bought amound does does not match"
        );
        if (_fromToken != ETH_ADDRESS) require(_fromToken.approve(_converter, 0), "Error removing token approve");
        return boughtAmount;
    }

    function _executeOptimalPay(
        bytes32[4] memory _params,
        bytes _oracleData,
        uint256 _rcnToPay
    ) internal returns (bool) {
        Engine engine = Engine(address(_params[I_ENGINE]));
        uint256 index = uint256(_params[I_INDEX]);
        Oracle oracle = engine.getOracle(index);

        uint256 toPay;

        if (oracle == address(0)) {
            toPay = _rcnToPay;
        } else {
            uint256 rate;
            uint256 decimals;
            bytes32 currency = engine.getCurrency(index);

            (rate, decimals) = oracle.getRate(currency, _oracleData);
            toPay = ((_rcnToPay * 1000000000000000000) / rate) / 10 ** (18 - decimals);
        }

        Token rcn = engine.rcn();
        require(rcn.approve(engine, _rcnToPay), "Error on payment approve");
        require(engine.pay(index, toPay, address(_params[I_PAY_FROM]), _oracleData), "Error paying the loan");
        require(rcn.approve(engine, 0), "Error removing the payment approve");

        return true;
    }

    function _executeLend(
        bytes32[3] memory _params,
        bytes _oracleData,
        bytes _cosignerData
    ) internal returns (bool) {
        Engine engine = Engine(address(_params[I_ENGINE]));
        uint256 index = uint256(_params[I_INDEX]);
        return engine.lend(index, _oracleData, CosignerBasalt(address(_params[I_LEND_COSIGNER])), _cosignerData);
    }

    function _executeTransfer(
        bytes32[3] memory _params,
        address _to
    ) internal returns (bool) {
        return Engine(address(_params[I_ENGINE])).transfer(_to, uint256(_params[1]));
    }

    function _applyRate(
        uint256 _amount,
        uint256 _rate
    ) internal pure returns (uint256) {
        return _amount.safeMult(_rate) / 10 ** 18;
    }

    function _getRequiredRcnLend(
        bytes32[3] memory _params,
        bytes _oracleData,
        bytes _cosignerData
    ) internal view returns (uint256 required) {
        Engine engine = Engine(address(_params[I_ENGINE]));
        uint256 index = uint256(_params[I_INDEX]);
        CosignerBasalt cosigner = CosignerBasalt(address(_params[I_LEND_COSIGNER]));

        if (cosigner != address(0)) {
            required += cosigner.cost(engine, index, _cosignerData, _oracleData);
        }
        required += engine.convertRate(engine.getOracle(index), engine.getCurrency(index), _oracleData, engine.getAmount(index));
    }

    function _getRequiredRcnPay(
        bytes32[4] memory _params,
        bytes _oracleData
    ) internal view returns (uint256) {
        Engine engine = Engine(address(_params[I_ENGINE]));
        uint256 index = uint256(_params[I_INDEX]);
        uint256 amount = uint256(_params[I_PAY_AMOUNT]);
        return engine.convertRate(engine.getOracle(index), engine.getCurrency(index), _oracleData, amount);
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
