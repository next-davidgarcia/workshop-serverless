const log = require('./log');
const Request = require('./request');

module.exports = {
    request (options) {
        return new Request(options);
    },
    error (name, code = 500, data = false) {
        const e = new Error(name);
        e.code = code;
        e.name = name;
        e.outputBody = data;
        return e;
    },
    log
};
