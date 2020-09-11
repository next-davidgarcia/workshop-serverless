// EJMPLO BÚSQUEDA POR USER
// { $.user = 821a7977-c5c1-4294-b61c-44135c07fab0 } en la función de turno

class Log {
    constructor(request) {
        this._request = request;
    }
    info (msg = '', code) {
        console.log(this._logJson('info', msg, null, code));
    }

    debug(msg = '') {
        if (this._request.isDev()) {
            console.log(this._logJson('debug', msg, null));
        }
    }

    error ({ error, e, msg, message, code }) {
        error = error || e;
        message = message || msg || error.message;
        code = code || error.code || 500;
        console.error(this._logJson('error', message, error, code));
    }

    _logJson(type, message, error = null, code = undefined) {
        const base = {
            type,
            uuid: this._request.id(),
            timestamp: this._request.getDate(),
            ip: this._request.ip(),
            path: this._request._event.path,
            method: this._request._method,
            user: this._request.getUserId() || 'not-logged',
            message: message
        };
        if (code !== undefined) {
            base.code = code;
        }
        if (error !== null) {
            base.error = error;
        }
        return JSON.stringify(base);
    }
}

module.exports = Log;
