require('module-alias/register');
const app = require('app');
const Joi = require('joi');
const CustomError = app.error;
const { Schema, Users } = require(__dirname + '/Schema');
const auth = require('lib/auth');

async function deleteItem({ email }) {
    return new Promise((resolve, reject) => {
        Users.destroy(email, (err) => {
            return (err) ? reject(err): resolve();
        });
    });
}

function parseDynamoItem(acc) {
    if (acc !== null) {
        const item = acc.toJSON ? acc.toJSON() : acc;
        return item;
    } else {
        return null;
    }
}

async function validate(item) {
    return new Promise((resolve, reject) => {
        Joi.validate(item, Schema, (err) => {
            return err ? reject(CustomError(err.message, 412)) : resolve(item);
        });
    });
}

async function getItem({ email }) {
    return new Promise((resolve, reject) => {
        Users.get(email, (err, acc) => {
            if (err) {
                reject(err);
            } else {
                resolve({ item: parseDynamoItem(acc) });
            }
        });
    });
}

async function postItem({ item }) {
    const old = (await getItem({ email: item.email })).item;
    if (old === null) {
        item.password = (await auth.getHash({ text: item.password })).hash;
        await validate(item);
        const elem = new Users(item);
        await elem.save();
        const result = parseDynamoItem(item);
        delete result.password;
        return { item: result };
    } else {
        throw CustomError('Duplicated', 412);
    }
}

async function login({ email, password }) {
    const user = (await getItem({ email })).item;
    if (user !== null) {
        const { result } = await auth.checkHash({ text: password, hash: user.password });
        if (result === true) {
            delete user.password;
            const token = auth.getToken(user);
            return { user, token };
        }
    }
    throw CustomError('Bad Request', 400);
}

module.exports.createUser = postItem;
module.exports.getUser = getItem;
module.exports.loginUser = login;
