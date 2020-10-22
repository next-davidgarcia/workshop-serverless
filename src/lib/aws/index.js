const AWSXRay = require('aws-xray-sdk-core');
const lib = require('aws-sdk-original');

module.exports = (process.env.SRS_LOCAL === 'true') ? lib : AWSXRay.captureAWS(lib);
