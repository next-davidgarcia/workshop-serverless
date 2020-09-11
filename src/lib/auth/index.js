const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { intersection } = require('lodash');
const { AUTH_TOKEN_SECRET } = require('constants');

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

function getHash({ text }) {
    return new Promise((resolve, reject) => {
        const saltRounds = 10;
        bcrypt.genSalt(saltRounds, (err, salt) => {
            bcrypt.hash(text, salt, (err, hash) => {
                return err ? reject(err) : resolve({ hash });
            });
        });
    });
}

function checkHash({ text, hash }) {
    return new Promise((resolve, reject) => {
        bcrypt.compare(text, hash, (err, result) => {
            return err ? reject(err) : resolve({ result });
        });
    });
}

module.exports = { getHash, checkHash, isAuth, getUserByToken, getToken };
