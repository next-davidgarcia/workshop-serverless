require('module-alias/register');
const dynamo = require('dynamodb');
const Joi = require('joi');
const {
    REGION,
    USERS_TABLE,
} = require('constants');
dynamo.AWS.config.update({ region: REGION });

const schema = {
    email: Joi.string().email().required(),
    name: Joi.string().required(),
    surname: Joi.string().required(),
    password: Joi.string().required(),
    roles: Joi.array().items(Joi.string()).required(),
};


const dynamoSchema = {
    hashKey : 'email',
    schema: {},
    tableName: USERS_TABLE,
};

for (let key in schema) {
    if (['roles'].includes(key) === true) {
        dynamoSchema.schema[key] = dynamo.types.stringSet();
    } else {
        dynamoSchema.schema[key] = schema[key];
    }
}

const Users = dynamo.define(USERS_TABLE, dynamoSchema);


const Schema = Joi.object().keys(schema);

module.exports = { Users, Schema };


