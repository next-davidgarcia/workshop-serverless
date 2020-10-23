require('module-alias/register');
const app = require('app');
const Joi = require('joi');
const AWS = require('aws-sdk');
const CustomError = app.error;
const { Schema } = require(__dirname + '/Schema');
const { getToken } = require('lib/auth');
global.fetch = require('node-fetch');
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');
const uuid = require('short-uuid').generate;
const { AUTH_POOL_ID, AUTH_CLIENT_ID, COLLECTION, } = require('constants');
const cognito = new AWS.CognitoIdentityServiceProvider();
const userPool = new AmazonCognitoIdentity.CognitoUserPool({
    UserPoolId : AUTH_POOL_ID,
    ClientId : AUTH_CLIENT_ID
});
const rek = new AWS.Rekognition();
const CollectionId = COLLECTION;


async function validate(item) {
    return new Promise((resolve, reject) => {
        Joi.validate(item, Schema, (err) => {
            return err ? reject(CustomError(err.message, 412)) : resolve(item);
        });
    });
}

function getAttr(attrs, Name) {
    const t = attrs.find((i) => i.Name === Name);
    return t ? t.Value : '';
}

async function getItem({ email }) {
    try {
        email = ('' || email).trim();
        const { UserAttributes } = await cognito.adminGetUser({
            UserPoolId: AUTH_POOL_ID,
            Username: email,
        }).promise();
        const item = {
            id: getAttr(UserAttributes, 'sub'),
            email,
            name: getAttr(UserAttributes, 'name'),
            middle_name: getAttr(UserAttributes, 'middle_name'),
            roles: ['user'],
        };
        return { item };
    } catch (e) {
        if (e.name === 'UserNotFoundException') {
            return { item: null };
        } else {
            throw e;
        }
    }
}

function getReq(item) {
    const oldPassword = 'Tu5$' + uuid(); // Tu5 para que la política pase.
    const req = {
        Username: item.email,
        UserPoolId: AUTH_POOL_ID, /* required */
        ForceAliasCreation: true,
        MessageAction: 'SUPPRESS',
        TemporaryPassword: oldPassword,
        DesiredDeliveryMediums: [],
        UserAttributes: [
            { Name: 'email_verified', Value: "true" }
        ]
    };
    // OJOOOOOOOO -> en el front, poner middle_name
    ['email', 'name', 'middle_name'].forEach((Name) => {
        const Value = '' + item[Name];
        if (Value) {
            req.UserAttributes.push({ Name, Value });
        }
    });
    return req;
}

async function postItem({ item }) {
    try {
        await validate(item);
        const { email, password } = item;
        const req = getReq(item);
        await cognito.adminCreateUser(req).promise();
        const [{ user }] = await Promise.all([
            getItem({ email }),
            cognito.adminSetUserPassword({ Password: password, UserPoolId: AUTH_POOL_ID, Username: email, Permanent: true }).promise()
        ]);
        return { item: user };
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

async function login({ email, password }) {
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
                const item = result.idToken.payload;
                const user = {
                    email: item.email,
                    name: item.name,
                    middle_name: item.middle_name,
                    roles: ['user'],
                };
                resolve({ user, token: getToken(user) });
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

async function addFace({ email, image }) {
    // await rek.createCollection({ CollectionId }).promise();
    const ExternalImageId = email.replace('@',':::');
    const Bytes = new Buffer(image.replace(/^data:image\/\w+;base64,/, ""),'base64');
    const params = {
        CollectionId,
        ExternalImageId,
        Image: {
            Bytes
        },
    };
    await rek.indexFaces(params).promise();
}

async function loginUserFace({ image }) {
    const Bytes = new Buffer(image.replace(/^data:image\/\w+;base64,/, ""),'base64');
    const params = {
        CollectionId,
        Image: {
            Bytes
        },
        FaceMatchThreshold: 95,
        MaxFaces: 1
    };
    const data = await rek.searchFacesByImage(params).promise();
    if(data.FaceMatches.length === 0) {
        throw CustomError('Wrong user or password', 401);
    } else {
        const face = data.FaceMatches[0].Face;
        const email = face.ExternalImageId.replace(':::','@');
        const user = (await getItem({ email })).item;
        return { user, token: getToken(user) };
    }
}

module.exports.createUser = postItem;
module.exports.getUser = getItem;
module.exports.loginUser = login;
module.exports.addFace = addFace;
module.exports.loginUserFace = loginUserFace;
