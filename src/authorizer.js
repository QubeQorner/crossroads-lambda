// /authorizer.js

const _ = require('lodash');
const jwt = require('jsonwebtoken');
const utils = require('./lib/utils');

let response;

/**
 * Returns a boolean whether or not a user is allowed to call a particular method
 * A user with scopes: ['pangolins'] can
 * call 'arn:aws:execute-api:ap-southeast-1::random-api-id/dev/GET/pangolins'
 *
 */
const authorizeUser = (userScopes, methodArn) => {
    return _.some(userScopes, scope => _.endsWith(methodArn, scope));
};

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
exports.handler = async (event, context) => {
    const token = event.authorizationToken;

    try {

        const secretsManager = new AWS.SecretsManager();
        const secretParam = {
            SecretId: 'crossroads-prod'
        };
        const secret = await secretsManager.getSecretValue(secretParam).promise().catch((err) => {
            return { // Error response
                statusCode: 401,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: err,
                }),
            };
        });

        console.log(secret);

        const jwtSecret = JSON.parse(secret.SecretString).jwtSecret;

        // Verify JWT
        const decoded = jwt.verify(token, jwtSecret);
        const user = decoded.user;

        // Checks if the user's scopes allow her to call the current function
        // const isAllowed = authorizeUser(user.scopes, event.methodArn);
        const isAllowed = true;
        const effect = isAllowed ? 'Allow' : 'Deny';
        const userId = user.username;
        const authorizerContext = { user: JSON.stringify(user) };
        // Return an IAM policy document for the current endpoint
        return  utils.buildIAMPolicy(userId, effect, event.methodArn, authorizerContext);
    } catch (e) {
        console.error(e);
        return 'Unauthorized'; // Return a 401 Unauthorized response
    }
};