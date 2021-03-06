// /login/login.js

const jwt = require('jsonwebtoken');
const AWS = require("aws-sdk");
const bcrypt = require('bcrypt');

const JWT_EXPIRATION_TIME = '5m';

let response;

/**
 *
 * @param record - record from AWS RDSDataServices
 * @returns {undefined}
 */
function buildUserData(record) {
    return {
        "player_uuid": record[1].stringValue,
        "username": record[2].stringValue
    };
}

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
    const { username, password } = JSON.parse(event.body);


    console.log("Authenticating: ", username);
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

        const rdsParams = {
            secretArn: 'arn:aws:secretsmanager:eu-central-1:597880501761:secret:rds-db-credentials/cluster-R2Q7TW2NSOTZSLDRPBDOIMSQE4/crossroads_dba-sJjF7R',
            resourceArn: 'arn:aws:rds:eu-central-1:597880501761:cluster:crossroads-db',
            database: 'crossroads_dev',
            sql: 'SELECT * from players where username = :un',
            parameters: [{
              name: 'un',
              value: {
                  "stringValue" : username
              }
            }]
        }

        const rdsDataService = new AWS.RDSDataService();
        const userData = await rdsDataService.executeStatement(rdsParams).promise().catch((err) => {
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
        console.log("Userdata:", JSON.stringify(userData, null, 2));
        if (userData.records.length !== 1){
            response = { // Error response
                statusCode: 401,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Cannot find unique user!',
                }),
            };
            return response;
        }

        const user = buildUserData(userData.records[0]);

        if (bcrypt.compareSync(password, userData.records[0][3].stringValue)){
            // Issue JWT
            const token = jwt.sign({ user }, jwtSecret, { expiresIn: JWT_EXPIRATION_TIME });
            response = { // Success response
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    token,
                }),
            };
        }
    } catch (e) {
        response = { // Error response
            statusCode: 401,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                error: e.message,
            }),
        };
    }
    return response;
};