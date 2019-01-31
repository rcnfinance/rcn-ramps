module.exports.address0x = '0x0000000000000000000000000000000000000000';
module.exports.bytes320x = '0x0000000000000000000000000000000000000000000000000000000000000000';

module.exports.STATUS_ONGOING = '1';
module.exports.STATUS_PAID = '2';
module.exports.STATUS_ERROR = '4';

// the promiseFunction should be a function
module.exports.tryCatchRevert = async (promise, message) => {
    let headMsg = 'revert ';
    if (message === '') {
        headMsg = headMsg.slice(0, headMsg.length - 1);
        console.warn('    \u001b[93m\u001b[2m\u001b[1m⬐ Warning:\u001b[0m\u001b[30m\u001b[1m There is an empty revert/require message');
    }
    try {
        if (promise instanceof Function) {
            await promise();
        } else {
            await promise;
        }
    } catch (error) {
        assert(
            error.message.search(headMsg + message) >= 0 || process.env.SOLIDITY_COVERAGE,
            'Expected a revert \'' + headMsg + message + '\', got ' + error.message + '\' instead'
        );
        return;
    }
    assert.fail('Expected throw not received');
};

module.exports.toEvents = async (promise, ...events) => {
    const logs = (await promise).logs;

    let eventObjs = [].concat.apply(
        [], events.map(
            event => logs.filter(
                log => log.event === event
            )
        )
    );

    if (eventObjs.length === 0 || eventObjs.some(x => x === undefined)) {
        console.warn('\t\u001b[91m\u001b[2m\u001b[1mError: The event dont find');
        assert.fail();
    }
    eventObjs = eventObjs.map(x => x.args);
    return (eventObjs.length === 1) ? eventObjs[0] : eventObjs;
};
