const axios = require('axios');
const apiUrl = process.env.apiUrl || 'http://localhost:3000';

const request = async ({ method =  'GET', url, data = false, baseURL = apiUrl, token = false }) => {
    const options = {
        method,
        url,
        baseURL,
        data
    };
    if (token !== false) {
        options.headers = {
            'auth-token': token
        };
    }
    return await axios(options);
};

module.exports = { request };
