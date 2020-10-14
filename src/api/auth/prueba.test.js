const { request } = require( __dirname + '/../../lib/testing');

test('testing api endpoint', async () => {
    try {
        const data = await request({ url: 'api/auth/me' });
    } catch (e) {
        expect(e).toHaveProperty('response');
        expect(e.response).toHaveProperty('status');
        expect(e.response.status).toBe(401);
        expect(e.response).toHaveProperty('data');
        expect(e.response.data).toHaveProperty('message');
        expect(e.response.data.message).toBe('Unauthorized');
    }
});

test('testing api endpoint 404', async () => {
    try {
        const data = await request({ url: 'error' });
    } catch (e) {
        expect(e).toHaveProperty('response');
        expect(e.response).toHaveProperty('status');
        expect(e.response.status).toBe(404);
    }
});
