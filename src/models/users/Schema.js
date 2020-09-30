const Joi = require('joi');

const schema = {
    email: Joi.string().email().required(),
    name: Joi.string().required(),
    middle_name: Joi.string().required(),
    password: Joi.string().required(),
    roles: Joi.array().items(Joi.string()).required(),
};

const Schema = Joi.object().keys(schema);

module.exports = { Schema };


