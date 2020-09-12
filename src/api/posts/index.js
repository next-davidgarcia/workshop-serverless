require('module-alias/register');
const app = require('app');
const { listPosts, getPost, createPost, updatePost, deletePost } = require('model/posts');
const CustomError = app.error;


module.exports.list = async (event, context) => {
    const request = app.request({ context, event });
    try {
        const { last, size } = request.query;
        const data = await listPosts({ last, size });
        return request.response({
            code: 200,
            data: data.items,
            last: data.last,
        });
    } catch (error) {
        return request.error({ error });
    }
};

module.exports.get = async (event, context) => {
    const request = app.request({ context, event });
    try {
        const { slug } = request.params;
        const { item } = await getPost({ slug });
        if (item !== null) {
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

module.exports.post = async (event, context) => {
    const request = app.request({ context, event });
    try {
        const item = request.body;
        const user = request.getLoggedUser();
        item.user = user.email;
        const data = await createPost({ item });
        return request.response({
            code: 201,
            data: data.item,
        });
    } catch (error) {
        return request.error({ error });
    }
};

module.exports.put = async (event, context) => {
    const request = app.request({ context, event });
    try {
        const item = request.body;
        const { slug } = request.params;
        const data = await updatePost({ slug, item });
        return request.response({
            code: 202,
            data: data.item,
        });
    } catch (error) {
        return request.error({ error });
    }
};

module.exports.del = async (event, context) => {
    const request = app.request({ context, event });
    try {
        const { slug } = request.params;
        await deletePost({ slug });
        return request.response({
            code: 202
        });
    } catch (error) {
        return request.error({ error });
    }
};
