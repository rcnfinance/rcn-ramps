pragma solidity ^0.5.0;

import "../../rcn/basalt/interfaces/Engine.sol";
import "../../interfaces/Cosigner.sol";


contract ConvertRateView {
    function convertRate(Oracle oracle, bytes32 currency, bytes memory data, uint256 amount) public view returns (uint256);
}


contract TestCosignerBasalt is Cosigner {
    function url() public view returns (string memory) {}

    function cost(address engine, uint256 index, bytes memory data, bytes memory oracleData) public view returns (uint256) {
        return _cost(engine, index, data, oracleData);
    }

    function _cost(address engine, uint256 index, bytes memory, bytes memory oracleData) internal view returns (uint256) {
        return ConvertRateView(engine).convertRate(
            Engine(engine).getOracle(index),
            Engine(engine).getCurrency(index),
            oracleData,
            Engine(engine).getAmount(index)
        ) / 100;
    }

    function requestCosign(Engine engine, uint256 index, bytes memory data, bytes memory oracleData) public returns (bool) {
        return engine.cosign(index, cost(address(engine), index, data, oracleData));
    }

    function claim(address, uint256, bytes memory) public returns (bool) { }
}
