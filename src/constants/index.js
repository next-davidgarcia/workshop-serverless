const constants = {
    REGEX_PASSWORD: /^(?=.*\d)([!¡@#$%^-¿?&_*{}]*)(?=.*[a-z])(?=.*[A-Z])[!¡@#$%^-¿?&_*{}0-9a-zA-ZÀ-ÿ\u00f1\u00d1]{8,}$/,
    AUTH_TOKEN_DURATION: 60, //minutes
    STAGE: process.env.STAGE,
    REGION: process.env.REGION,
    AUTH_POOL_ID: process.env.AUTH_USER_POOL,
    AUTH_CLIENT_ID: process.env.AUTH_USER_CLIENT,
    VALID_DOMAINS: process.env.VALID_DOMAINS,
    POSTS_TABLE: process.env.POSTS_TABLE,
    BUCKET: process.env.BUCKET,
    COLLECTION: process.env.COLLECTION,
    // SECRETS
    AUTH_TOKEN_SECRET: process.env.AUTH_SECRET,
};

module.exports = constants;
