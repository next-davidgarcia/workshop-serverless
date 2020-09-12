require('module-alias/register');
const dynamo = require('dynamodb');
const Joi = require('joi');
const {
    REGION,
    POSTS_TABLE,
} = require('constants');
dynamo.AWS.config.update({ region: REGION });

const schema = {
    slug: Joi.string().required(),
    image: Joi.string(),
    title: Joi.string().required(),
    description: Joi.string(),
    text: Joi.string().required(),
    user: Joi.string().email().required(),
    tags: Joi.array().items(Joi.string()).required(),
};


const dynamoSchema = {
    hashKey : 'slug',
    schema: {},
    tableName: POSTS_TABLE,
};

for (let key in schema) {
    if (['tags'].includes(key) === true) {
        dynamoSchema.schema[key] = dynamo.types.stringSet();
    } else {
        dynamoSchema.schema[key] = schema[key];
    }
}

const Posts = dynamo.define(POSTS_TABLE, dynamoSchema);


const Schema = Joi.object().keys(schema);

module.exports = { Posts, Schema };


