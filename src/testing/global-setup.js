const { setup: setupDevServer } = require('jest-dev-server');

module.exports = async function globalSetup() {
    const command = process.env.ciTesting ? 'npm run test-ci-server' : 'npm run test-local-server';
    process.env.apiUrl = 'http://localhost:3000/local';
    process.env.testing = 1;
    await setupDevServer({
        command,
        launchTimeout: 10000,
        port: 3000,
        debug: true
    });
};
