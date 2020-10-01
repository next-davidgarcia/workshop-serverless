const jwt = require('jsonwebtoken');
const { intersection } = require('lodash');
const { AUTH_TOKEN_SECRET, AUTH_TOKEN_DURATION } = require('constants');

function getToken(user) {
    return jwt.sign({
        exp: new Date().getTime() + (AUTH_TOKEN_DURATION * 60),
        data: user,
    }, AUTH_TOKEN_SECRET);
}


function getUserByToken(token) {
    const info = jwt.verify(token, AUTH_TOKEN_SECRET);
    return info.data;
}

function isAuth (userRoles = [], roles = []) {
    if (!Array.isArray(roles)) {
        roles = [roles];
    }
    if (roles.length !== 0) {
        const inter = intersection(roles, userRoles);
        return inter.length !== 0;
    } else {
        return true;
    }
}

module.exports = { getHash, checkHash, isAuth, getUserByToken, getToken };
