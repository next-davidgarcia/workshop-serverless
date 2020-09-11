const Joi = require('joi');
const {
    REGEX_PASSWORD,
    COUNTRIES,
} = require('constants');

module.exports = Joi.object().keys({
    id: Joi.string(),
    country : Joi.string().required().allow(COUNTRIES),
    cp: Joi.number().required(),
    phone : Joi.string().required(),
    email: Joi.string().email().required(),
    surname: Joi.string().required(),
    name: Joi.string().required(),
    phoneValidated: Joi.boolean(),
    password: Joi.string().regex(REGEX_PASSWORD),
    shopId: Joi.any(),
    roles: Joi.array().items(Joi.string().allow(['shop', 'admin'])),
});
