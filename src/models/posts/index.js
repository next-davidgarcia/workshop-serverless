require('module-alias/register');
const app = require('app');
const Joi = require('joi');
const { sanitizeSlug } = require('lib/common');
const CustomError = app.error;
const { Schema, Posts } = require(__dirname + '/Schema');

async function deleteItem({ slug }) {
    return new Promise((resolve, reject) => {
        Posts.destroy(slug, (err) => {
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

async function getItem({ slug }) {
    return new Promise((resolve, reject) => {
        Posts.get(slug, (err, acc) => {
            if (err) {
                reject(err);
            } else {
                resolve({ item: parseDynamoItem(acc) });
            }
        });
    });
}

async function list ({ size = 20, last }) {
    return new Promise((resolve, reject) => {
        try {
            size = parseInt(size);
            const query = Posts.scan().limit(size);

            if (last) {
                query.startKey({ slug: last });
            }

            query.exec(async (err, data) => {
                try {
                    if (err !== null) {
                        return reject(err);
                    } else {
                        const newLast = data.LastEvaluatedKey ? data.LastEvaluatedKey.slug : undefined;
                        const result = data.Items.map((item) => parseDynamoItem(item));
                        if (newLast !== undefined && result.length === 0) {
                            resolve(await list({ last: newLast, size }));
                        } else {
                            resolve({ items: result, last: newLast });
                        }
                    }
                } catch (e) {
                    reject(e);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}



async function putItem({ item, slug }) {
    const old = (await getItem({ slug })).item;
    // hacer check de todo
    if (old !== null) {
        item.slug = slug;
        await validate(item);
        await Posts.update(item);
        return { item: parseDynamoItem(item) };
    } else {
        throw CustomError('Not found', 404);
    }
}

async function postItem({ item }) {
    item.slug = sanitizeSlug(item.slug);
    const old = (await getItem({ slug: item.slug })).item;
    if (old === null) {
        await validate(item);
        const elem = new Posts(item);
        await elem.save();
        return { item: parseDynamoItem(item) };
    } else {
        throw CustomError('Duplicated', 412);
    }
}

module.exports.createPost = postItem;
module.exports.updatePost = putItem;
module.exports.getPost = getItem;
module.exports.listPosts = list;
module.exports.deletePost = deleteItem;

