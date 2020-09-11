const app = require('app');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
const CustomError = app.error;
const Joi = require('joi');
const { intersection } = require('lodash');
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');
const mailer = require('lib/mailer');
const uuid = require('short-uuid').generate;
const { encrypt, decrypt, random, zeroFill, cleanPhone, genAuthCode, base64encode, base64decode } = require('lib/common');
const {
    AUTH_TOKEN_SECRET, AUTH_TOKEN_DURATION, AUTH_POOL_ID, AUTH_CLIENT_ID,
    PATHS, WEB_ADMIN_BASE_URL, PRIVATE_BUCKET,
} = require('constants');

global.fetch = require('node-fetch');
const s3 = new AWS.S3();
const sns = new AWS.SNS({ apiVersion: '2010-03-31' });
const User = require(__dirname + '/User.js');
const cognito = new AWS.CognitoIdentityServiceProvider();
const userPool = new AmazonCognitoIdentity.CognitoUserPool({
    UserPoolId : AUTH_POOL_ID,
    ClientId : AUTH_CLIENT_ID
});

class Auth {

    getUserToken(token) {
        const info = jwt.verify(token, AUTH_TOKEN_SECRET);
        return info.data;
    }

    generateToken (user) {
        return jwt.sign({
            exp: Math.floor(Date.now() + (AUTH_TOKEN_DURATION * 60 * 1000)),
            data: user
        }, AUTH_TOKEN_SECRET);
    }

    isAuth (userRoles = [], roles = []) {
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

    async validateModel(item) {
        return new Promise((resolve, reject) => {
            Joi.validate(item, User, (err) => {
                return err ? reject(CustomError(err.message, 412)) : resolve(item);
            });
        });
    }

    /**
     *
     * @param { email, password }
     * @returns {Promise<user>}
     * @throws Exception
     */
    async login({ email = '', password = '' }) {
        const self = this;
        return new Promise((resolve, reject) => {
            email = (email || '').trim();
            password = (password || '').trim();
            const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
                Username: email,
                Password: password,
            });
            const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
                Username: email,
                Pool: userPool
            });
            cognitoUser.authenticateUser(authenticationDetails, {
                onSuccess: (result) => {
                    const user = self.parseLoginUser(result);
                    resolve({ user, token: self.generateToken(user) });
                },
                onFailure: (err) => {
                    if ((err.code === 'NotAuthorizedException') || (err.code === 'UserNotFoundException')) {
                        reject(CustomError('Wrong user or password', 401));
                    } else if(err.code === 'PasswordResetRequiredException') {
                        reject(CustomError('Change password required', 400));
                    } else {
                        reject(err);
                    }
                }
            });
        });
    }

    async updateUserShop({ user, shopId }) {
        const { email } = user;
        const UserAttributes = [
            { Name: 'profile', Value: '' + shopId }
        ];
        await cognito.adminUpdateUserAttributes({ UserPoolId: AUTH_POOL_ID, Username: email, UserAttributes }).promise();
        user.shopId = shopId;
        const token = this.generateToken(user);
        return { token, user };
    }

    async updateUserAttributes({ user }) {
        await this.validateModel(user);
        const { email, name, surname } = user;
        const UserAttributes = [
            { Name: 'name', Value: '' + name },
            { Name: 'middle_name', Value: '' + surname }
        ];
        await cognito.adminUpdateUserAttributes({ UserPoolId: AUTH_POOL_ID, Username: email, UserAttributes }).promise();
        const token = this.generateToken(user);
        return { user, token };
    }

    parseLoginUser(result) {
        const item = result.idToken.payload;
        const user = {
            email: item.email,
            name: item.name,
            surname: item.middle_name,
            roles: [],
            shopId: item.profile || -1,
            id: item.sub,
            phone: item.phone_number,
            country: item.locale,
            cp: parseInt(item.zoneinfo),
            phoneValidated: !!item.phone_number_verified,
        };
        if (item['cognito:groups'] && Array.isArray(item['cognito:groups'])) {
            user.roles.push(...item['cognito:groups']);
        }
        if (user.roles.length === 0) {
            user.roles.push('shop');
        }
        if (user.shopId === '-1') {
            user.shopId = -1;
        }
        return user;
    }

    async deleteUser({ email }) {
        return cognito.adminDeleteUser({ UserPoolId: AUTH_POOL_ID, Username: email }).promise();
    }

    /**
     * @param action
     * @param email
     * @param phone
     * @param uuid -> si es código corto para móvil
     * @returns {Promise<{code: *}>}
     */
    async saveCode({ action, email = '', uuid = false, phone = false }) {
        email = ('' || email).trim();
        const code = (uuid === false) ? genAuthCode() : zeroFill(random(0, 999999), 6);
        const content = { action, email, code, phone };
        const name = (uuid === false) ? base64encode(code) : base64encode(uuid);
        const Bucket = PRIVATE_BUCKET;
        const Key = `${ PATHS.SECRET_CODES }${ name }.code`;
        const ACL = 'private';
        const ServerSideEncryption = 'AES256';
        const Body = encrypt(content, 30);
        await s3.putObject({ Body, Bucket, Key, ACL, ServerSideEncryption }).promise();
        return { code };
    }

    async checkCode({ code, action, uuid = false }) {
        const name = (uuid === false) ? base64encode(code) : base64encode(uuid);
        const Bucket = PRIVATE_BUCKET;
        const Key = `${ PATHS.SECRET_CODES }${ name }.code`;
        let encrypted = '';
        try {
            const { Body } = await s3.getObject({ Bucket, Key }).promise();
            encrypted = Body.toString('utf-8');
        } catch (e) {
            if (e.code === 'NoSuchKey') {
                throw CustomError('Wrong code', 406);
            } else {
                throw e;
            }
        }
        try {
            const data = decrypt(encrypted);
            if ((data.code === code) && (action === data.action)) {
                await s3.deleteObject({ Bucket, Key }).promise();
                return { email: data.email, phone: data.phone };
            } else {
                throw CustomError('Wrong code', 406);
            }
        } catch (e) {
            throw CustomError('Expired code', 406);
        }
    }

    async sendCode({ email = '', action }) {
        email = ('' || email).trim();
        if (['activate', 'reset'].includes(action)) {
            const { code } = await this.saveCode({ action, email });
            const flags = {};
            const subject = (action === 'activate') ? 'Valida tu cuenta': 'Recupera tu contraseña';
            const template = (action === 'activate') ? 'shopActivation' : 'resetPassword';
            const to = email;
            flags.URL = (action === 'activate') ?
                `${ WEB_ADMIN_BASE_URL }register?code=${ code }`:
                `${ WEB_ADMIN_BASE_URL }login?code=${ code }`;
            flags.CODE = code;
            await mailer.sendMail({ to, subject, template, flags });
        } else {
            throw CustomError('Not valid action', 400);
        }
    }

    async requestResetPassword({ email = '' }) {
        email = ('' || email).trim();
        const { user } = await this.getUserByEmail({ email });
        if (user !== null) {
            await this.sendCode({ action: 'reset', email });
        } else {
            throw CustomError('Not found', 404);
        }
    }

    async resetPassword({ code, password }) {
        const { email } = await this.checkCode({ code, action: 'reset' });
        if (email !== false) {
            try {
                await cognito.adminSetUserPassword({
                    Password: password,
                    UserPoolId: AUTH_POOL_ID,
                    Username: email,
                    Permanent: true
                }).promise();
            } catch (e) {
                if (e.name === 'InvalidPasswordException') {
                    throw CustomError('Password not valid', 412);
                } else if (e.name === 'UserNotFoundException') {
                    throw CustomError('User not found', 404);
                } else {
                    throw e;
                }
            }
        } else {
            throw CustomError('Wrong or expired code', 406);
        }
    }

    async changePassword({ email = '', password = '', oldPassword = ''}) {
        email = ('' || email).trim();
        password = ('' || password).trim();
        oldPassword = ('' || oldPassword).trim();
        try {

            await this.login({ email, password: oldPassword });
        } catch (e) {
            throw CustomError('Wrong User or Password', 409);
        }
        try {
            await cognito.adminSetUserPassword({
                Password: password,
                UserPoolId: AUTH_POOL_ID,
                Username: email,
                Permanent: true
            }).promise();
        } catch (e) {
            if (e.name === 'InvalidPasswordException') {
                throw CustomError('Password not valid', 412);
            } else if (e.name === 'UserNotFoundException') {
                throw CustomError('User not found', 404);
            } else {
                throw e;
            }
        }
    }

    async disableUser({ email }) {
        return cognito.adminDisableUser({ UserPoolId: AUTH_POOL_ID, Username: email }).promise();
    }

    /**
     * { email, password, phone_number, shopId, name, middle_name, roles }
     * @returns {Promise<{user: *}>}
     */
    async createUser(params) {
        let { email, password } = params;
        email = ('' || email).trim();
        password = ('' || password).trim();
        const oldPassword = 'Tu5' + uuid(); // Tu5 para que la política pase.
        const req = {
            Username: email,
            UserPoolId: AUTH_POOL_ID, /* required */
            ForceAliasCreation: true,
            MessageAction: 'SUPPRESS',
            TemporaryPassword: oldPassword,
            DesiredDeliveryMediums: [],
            UserAttributes: [
                { Name: 'email_verified', Value: "true" }, // para que NO envíe e-mails
            ]
        };
        ['email', 'phone_number', 'name', 'middle_name', 'shopId', 'locale', 'zoneinfo'].forEach((Name) => {
            let Value = '' + params[Name];
            if (Name === 'shopId') {
                Name = 'profile';
            }
            if (Value) {
                req.UserAttributes.push({ Name, Value });
            }
        });
        try {
            await cognito.adminCreateUser(req).promise();
            const [{ user }] = await Promise.all([
                this.getUserByEmail({ email }),
                cognito.adminSetUserPassword({ Password: password, UserPoolId: AUTH_POOL_ID, Username: email, Permanent: true }).promise(),
                this.disableUser({ email })
            ]);
            if (user !== null) {
                await this.sendCode({ email, action: 'activate' });
                return { user };
            } else {
                throw CustomError('Error creating user (not found after creation)', 500);
            }
        } catch (e) {
            if (e.code === 'UsernameExistsException') {
                throw CustomError('Duplicated', 409);
            } else if (e.code === 'InvalidPasswordException') {
                throw CustomError('Invalid password', 412);
            } else {
                throw e;
            }
        }
    }

    async confirmUser({ email }) {
        return cognito.adminConfirmSignUp({ UserPoolId: AUTH_POOL_ID, Username: email }).promise();
    }

    async activateUser({ code }) {
        const { email } = await this.checkCode({ code, action: 'activate' });
        if (email !== false) {
            await cognito.adminEnableUser({ UserPoolId: AUTH_POOL_ID, Username: email }).promise();
        } else {
            throw CustomError('Wrong or expired code', 406);
        }
        return { email };
    }

    getAttr(attrs, Name) {
        const t = attrs.find((i) => i.Name === Name);
        return t ? t.Value : '';
    }

    /**
     *
     * @param { email }
     * @returns {Promise<*>}
     */
    async getUserByEmail({ email = '' }) {
        try {
            email = ('' || email).trim();
            const [{ UserAttributes }, { Groups }] = await Promise.all([
                cognito.adminGetUser({ UserPoolId: AUTH_POOL_ID, Username: email }).promise(),
                cognito.adminListGroupsForUser({ UserPoolId: AUTH_POOL_ID, Username: email, Limit: 10 }).promise(),
            ]);
            const user = {
                id: this.getAttr(UserAttributes, 'sub'),
                email,
                phone: this.getAttr(UserAttributes, 'phone_number'),
                name: this.getAttr(UserAttributes, 'name'),
                shopId: this.getAttr(UserAttributes, 'profile'),
                country: this.getAttr(UserAttributes, 'locale'),
                cp: parseInt(this.getAttr(UserAttributes, 'zoneinfo')),
                phoneValidated: !!this.getAttr(UserAttributes, 'phone_number_verified'),
                roles: []
            };
            if (Groups.length !== 0) {
                user.roles.push(...Groups.map(i => i.GroupName));
            } else {
                user.roles.push('shop');
            }
            if (user.shopId === '-1') {
                user.shopId = -1;
            }
            return { user };
        } catch (e) {
            if (e.name === 'UserNotFoundException') {
                return { user: null };
            } else {
                throw e;
            }
        }
    }

    async validateMobileRequestCode({ user, phone }) {
        const PhoneNumber = cleanPhone(phone);
        const uuid = user.id;
        const { email } = user;
        const action = 'mobile';
        const { code } = await this.saveCode({ action, uuid, email, phone: PhoneNumber });
        const Message = `El código de verificación para habilitar su tienda en Comercio a Distancia es ${ code }`;
        await sns.publish({ Message, PhoneNumber }).promise();
    }

    async verifyPhone({ user }) {
        const { email } = user;
        const UserAttributes = [
            { Name: 'phone_number_verified', Value: "True" },
            { Name: 'phone_number', Value: user.phone }
        ];
        await cognito.adminUpdateUserAttributes({ UserPoolId: AUTH_POOL_ID, Username: email, UserAttributes }).promise();
        const token = this.generateToken(user);
        return { user, token };
    }

    async validateMobile({ user, phone, code }, request) {
        const uuid = user.id;
        const { email } = user;
        const action = 'mobile';
        const data = await this.checkCode({ code, action, uuid });
        if ((email === data.email) && (data.phone === phone)) {
            request.log.info(`User modify mobile. Old: ${ user.phone }. New: ${ data.phone }`);
            user.phoneValidated = true;
            user.phone = data.phone;
            return await this.verifyPhone({ user });
        } else {
            throw CustomError('Code not valid', 400);
        }
    }
}

module.exports = new Auth();
