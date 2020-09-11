const Log = require('../log');
const { v1: uuid } = require('uuid');
const { xss } = require('lib/common');
const { VALID_DOMAINS, STAGE, AUTH_PASS_HEADER }= require('constants');
const HTTP_CODES = require(__dirname + '/http-codes');
const CORS_HEADERS = require(__dirname + '/cors-headers');


module.exports = class Request {
    constructor ({ event, context }) {
        context.callbackWaitsForEmptyEventLoop = false;
        this._event = event;
        this._context = context;
        this._stage = STAGE;
        this._id = this._context.awsRequestId || uuid();
        this._date = new Date();
        this._user = null;
        this._method = event.httpMethod;
        this._parseEvent();
        this._validateOrigin();
        this._setUser();
        this.log = new Log(this);
        this.log.info('New request');
    }

    id () {
        return this._id;
    }

    isDev() {
        return this._stage === 'dev' || this._stage === 'pre' || this._stage === 'local';
    }

    ip() {
        return this._ip;
    }

    _validateOrigin () {
        if (VALID_DOMAINS !== 'null') {
            let origin = (this.headers.origin || this.headers.Origin || this.headers.Referer || this.headers.referer || '').trim().replace('https://', '').replace('http://', '');
            origin = origin.split('/')[0];
            const domains = VALID_DOMAINS.split(',');
            if (domains.includes(origin) === false) {
                throw new Error('Forbidden');
            }
        }
    }

    _setUser (user = false) {
        try {
            if (this._user === null) {
                this._user = user || JSON.parse(this._event.requestContext.authorizer.principalId);
            }
        } catch (e) {
            this._user = null;
        }
    }

    setUser (user) {
        this._setUser(user);
    }

    getLoggedUser() {
        this._setUser();
        if (this._user !== null) {
            return this._user;
        } else {
            throw new Error('User Not Logged');
        }
    }

    // se podrían hacer cosas de roles
    isAuth(auth = {}) {
        return (this._user !== null);
    }

    isAdmin() {
        const { roles } = this.getLoggedUser();
        return roles.includes('admin');
    }

    isLogged() {
        try {
            this.getLoggedUser();
            return true;
        } catch (e) {
            return false;
        }
    }

    error({ error, msg, code, headers = {}}) {
        const out = this._getErrorCode(error, code, msg);
        if (out.code >= 500) {
            this.log.error({ error, code: out.code });
            if (this.isDev() === true) {
                out.message = error.message;
                console.log(error);
            } else {
                out.message = 'Internal Error';
            }
        } else {
            this.log.info(`Code: ${ error.code }. Message: ${ error.name || error.message }`, out.code);
        }

        return {
            headers: this._parseResponseHeaders(headers),
            statusCode: out.code,
            body: JSON.stringify(out)
        };
    }

    isAuthInShop(id) {
        const { shopId } = this.getLoggedUser();
        const isAdmin = this.isAdmin();
        if ((isAdmin === false) && (id !== shopId)) {
            const e = new Error('Forbidden');
            e.code = 403;
            throw e;
        } else {
            return true;
        }
    }

    _getErrorCode (error = {}, code = false, message = false) {
        message = message || error.message || error.name;
        code = code || error.code || false;

        if ((code === false) || (isNaN(code) === true)) {
            code = 500;
        }

        if (HTTP_CODES.hasOwnProperty(code)) {
            message = HTTP_CODES[code];
        }

        return { code, message };
    }

    _cleanHeaders(headers = {}) {
        const result = {};
        const cleaned = xss(headers);
        for (let key in cleaned) {
            const low = key.toLowerCase();
            const value = cleaned[key];
            result[low] = value;
            result[key] = value;
        }
        if (result['authorization'] !== undefined && result[AUTH_PASS_HEADER] === undefined) {
            result[AUTH_PASS_HEADER] = result['authorization'];
        }
        return result;
    }

    _parseEvent () {
        const event = this._event || {};
        this.query = xss(event.queryStringParameters || {});
        if (event.body) {
            try {
                this.body = JSON.parse(xss(event.body));
            } catch (e) {
                this.body = xss(event.body);
            }
        }
        this.headers = this._cleanHeaders(event.headers);
        this.params = xss(event.pathParameters || {});
        try {
            this._ip = this.headers['X-Forwarded-For']
            || event.requestContext.identity.userAgent
            || event.requestContext.identity.sourceIp
            || event.identity.sourceIP;
        } catch (e) {
            this.ip = 'not-found';
        }
    }

    response({ data = false, code = 200, count = false, msg = false, headers = {}}) {
        try {
            // pillar token si hay y poner en headers
            const out = {};
            if (count !== false) {
                out.count = count;
            }
            if (data !== false) {
                out.data = data;
            } else if (msg === false && HTTP_CODES.hasOwnProperty(code)) {
                out.message = HTTP_CODES[code];
            }

            if (msg !== false) {
                out.message = msg;
            }
            this.log.info('Response finished', code);
            return {
                headers: this._parseResponseHeaders(headers),
                statusCode: code,
                body: JSON.stringify(out)
            };
        } catch (error) {
            this.error({ error });
        }
    }

    _parseResponseHeaders(headers = {}) {
        const result = {
            ...CORS_HEADERS,
            ...headers,
        };
        //Set new headers
        result['Strict-Transport-Security'] = 'max-age=63072000; includeSubdomains; preload';
        result['Content-Security-Policy'] = `default-src 'none'; img-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'`;
        result['X-Content-Type-Options'] = 'nosniff';
        result['X-Frame-Options'] = 'DENY';
        result['X-XSS-Protection'] = '1; mode=block';
        result['Referrer-Policy'] = 'same-origin';
        return result;
    }

    getUserId () {
        try {
            const { id } = this.getLoggedUser();
            return id;
        } catch (e) {
            return null;
        }
    }

    getTime() {
        return this._date.getTime();
    }

    getDate() {
        return this._date;
    }
};
