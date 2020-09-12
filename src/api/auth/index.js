require('module-alias/register');
const app = require('app');
const { createUser, loginUser, getUser } = require('model/users');
const CustomError = app.error;
const { base64decode, reCaptcha } = require('lib/common');

module.exports.login = async (event, context) => {
    const request = app.request({ context, event });
    try {
        const { email, password } = request.body;
        const { user, token } = await loginUser({ email, password });
        request.setUser(user);
        return request.response({
            code: 200,
            data: {
                user,
                token
            },
        });
    } catch (error) {
        return request.error({ error });
    }
};

module.exports.me = async (event, context) => {
    const request = app.request({ context, event });
    try {
        const { email } = request.getLoggedUser();
        const { item } = await getUser({ email });
        if (item !== null) {
            delete item.password;
            return request.response({
                code: 200,
                data: item,
            });
        } else {
            throw CustomError('Not found', 404);
        }
    } catch (error) {
        return request.error({ error });
    }
};

module.exports.createUser = async (event, context) => {
    const request = app.request({ context, event });
    try {
        const { email, password } = request.body;
        const item = request.body;
        const data = await getUser({ email });
        if (data.item === null) {
            item.email = email;
            item.roles = ['user'];
            item.password = password;
            const data = await createUser({ item });
            return request.response({
                code: 201,
                data: data.item,
            });
        } else {
            throw CustomError('Duplicated', 409);
        }
    } catch (error) {
        return request.error({ error });
    }
};
