const { moneyFormat } = require(__dirname + '/index.js');

test('test mxn', () => {
    expect(moneyFormat('mxn')).toBe('$');
});
