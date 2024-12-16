import { Duration, Stack } from "aws-cdk-lib";
import {
  CfnApiKey,
  CfnDataSource,
  CfnGraphQLApi,
  CfnGraphQLSchema,
} from "aws-cdk-lib/aws-appsync";
import {
  Effect,
  Policy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Code, Function, LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import config from "../config";
import { AppsyncProps } from "./interfaces";
import fs = require("fs");
import path = require("path");

const { PROJECT_NAME } = config;

export class Appsync extends Stack {
  public readonly privateApi: CfnGraphQLApi;
  public readonly privateDynamoDatasource: CfnDataSource;
  public readonly publicDynamoDatasource: CfnDataSource;
  public readonly privateLambdaDatasource: CfnDataSource;
  public readonly publicLambdaDatasource: CfnDataSource;
  public readonly publicApi: CfnGraphQLApi;
  public readonly apiKey: CfnApiKey;

  constructor(scope: Construct, id: string, props: AppsyncProps) {
    super(scope, id, props.stackProps);
    const awsLayerArn = StringParameter.valueForStringParameter(
      this,
      `${PROJECT_NAME}AwsLayerArn`
    );

    const awsLayer = LayerVersion.fromLayerVersionArn(
      this,
      "AppsyncAwsLayerFromArn",
      awsLayerArn
    );

    this.privateApi = new CfnGraphQLApi(this, `${PROJECT_NAME}Api`, {
      authenticationType: "AMAZON_COGNITO_USER_POOLS",
      userPoolConfig: {
        awsRegion: "us-east-1",
        userPoolId: props.cognito.userpool.userPoolId,
        defaultAction: "ALLOW",
      },
      name: `${PROJECT_NAME}Api`,
    });

    const dynamoDsName = `${PROJECT_NAME}PrivateDynamoDataSource`;

    this.privateDynamoDatasource = new CfnDataSource(this, dynamoDsName, {
      apiId: this.privateApi.attrApiId,
      name: dynamoDsName,
      type: "AMAZON_DYNAMODB",
      dynamoDbConfig: {
        awsRegion: "us-east-1",
        tableName: props.dynamodb.table.tableName,
      },
      serviceRoleArn: props.appsyncPre.privateApiRole.roleArn,
    });

    // TODO: Parameterize this
    const DOMAIN = "";

    const privateFn = new Function(
      this,
      `${PROJECT_NAME}PrivateAppsyncDatasource`,
      {
        runtime: Runtime.NODEJS_22_X,
        handler: "index.handler",
        code: Code.fromAsset(
          path.join(__dirname, "../assets/lambda/appsyncPrivateDatasource"),
          {
            exclude: ["node_modules"],
          }
        ),
        environment: {
          DYNAMODB_TABLE: `${PROJECT_NAME}`,
          DOMAIN,
        },
        timeout: Duration.minutes(1),
        layers: [awsLayer],
      }
    );

    const publicFn = new Function(
      this,
      `${PROJECT_NAME}PublicAppsyncDatasource`,
      {
        runtime: Runtime.NODEJS_22_X,
        handler: "index.handler",
        code: Code.fromAsset(
          path.join(__dirname, "../assets/lambda/appsyncPublicDatasource"),
          {
            exclude: ["node_modules"],
          }
        ),
        environment: {
          DYNAMODB_TABLE: `${PROJECT_NAME}`,
          DOMAIN,
          COGNITO_CLIENT_ID: props.cognito.appsyncclient.ref,
          COGNITO_USER_POOL_ID: props.cognito.userpool.userPoolId,
        },
        timeout: Duration.minutes(1),
        layers: [awsLayer],
      }
    );

    const cognitoPolicy = new Policy(this, `${PROJECT_NAME}CognitoPolicy`);
    const cognitoPolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
    });

    cognitoPolicyStatement.addActions(
      "cognito-idp:AdminInitiateAuth",
      "cognito-idp:AdminGetUser"
    );

    cognitoPolicyStatement.addResources(
      props.cognito.userpool.userPoolArn,
      `${props.cognito.userpool.userPoolArn}/*`
    );

    cognitoPolicy.addStatements(cognitoPolicyStatement);

    const privateDsRole = privateFn.role as Role;

    const dynamoPolicy = new Policy(this, `${PROJECT_NAME}DyanmoPolicy`);
    const dynamoPolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
    });

    dynamoPolicyStatement.addActions(
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
      "dynamodb:BatchWriteItem"
    );

    dynamoPolicyStatement.addResources(
      props.dynamodb.table.tableArn,
      `${props.dynamodb.table.tableArn}/index/*`
    );

    dynamoPolicy.addStatements(dynamoPolicyStatement);
    privateDsRole.attachInlinePolicy(dynamoPolicy);

    const secretPolicy = new Policy(this, `${PROJECT_NAME}SecretPolicy`);
    const secretPolicyStatement = new PolicyStatement({ effect: Effect.ALLOW });
    secretPolicyStatement.addActions("secretsmanager:GetSecretValue");
    secretPolicyStatement.addResources(
      `arn:aws:secretsmanager:us-east-1:${this.account}:secret:*`
    );
    secretPolicy.addStatements(secretPolicyStatement);
    privateDsRole.attachInlinePolicy(secretPolicy);

    const lambdaPolicyDocument = new PolicyDocument();
    const lambdaPolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
    });

    lambdaPolicyStatement.addActions("lambda:InvokeFunction");

    lambdaPolicyStatement.addResources(privateFn.functionArn);
    lambdaPolicyStatement.addResources(publicFn.functionArn);

    lambdaPolicyDocument.addStatements(lambdaPolicyStatement);

    const lambdaRole = new Role(this, `${PROJECT_NAME}LambdaRole`, {
      assumedBy: new ServicePrincipal("appsync.amazonaws.com"),
      inlinePolicies: {
        lambdaPolicyDocument,
      },
    });
    const privateLambdaDsName = `${PROJECT_NAME}PrivateLambdaDataSource`;
    const publicLambdaDsName = `${PROJECT_NAME}PublicLambdaDataSource`;

    this.privateLambdaDatasource = new CfnDataSource(
      this,
      privateLambdaDsName,
      {
        apiId: this.publicApi.attrApiId,
        name: privateLambdaDsName,
        type: "AWS_LAMBDA",
        lambdaConfig: { lambdaFunctionArn: publicFn.functionArn },
        serviceRoleArn: lambdaRole.roleArn,
      }
    );

    let schema = fs.readFileSync("./assets/appsync/schema.graphql", "utf8");

    new CfnGraphQLSchema(this, `${PROJECT_NAME}PrivateSchema`, {
      apiId: this.privateApi.attrApiId,
      definition: schema,
    });

    new CfnGraphQLSchema(this, `${PROJECT_NAME}PublicSchema`, {
      apiId: this.publicApi.attrApiId,
      definition: schema,
    });

    this.publicApi = new CfnGraphQLApi(this, `${PROJECT_NAME}PublicApi`, {
      authenticationType: "API_KEY",
      name: `${PROJECT_NAME}PublicApi`,
    });

    this.apiKey = new CfnApiKey(this, `${PROJECT_NAME}ApiKey`, {
      apiId: this.publicApi.attrApiId,
      expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
    });

    publicFn.role?.attachInlinePolicy(dynamoPolicy);
    privateFn.role?.attachInlinePolicy(cognitoPolicy);
    privateFn.role?.attachInlinePolicy(dynamoPolicy);

    this.publicLambdaDatasource = new CfnDataSource(this, publicLambdaDsName, {
      apiId: this.publicApi.attrApiId,
      name: publicLambdaDsName,
      type: "AWS_LAMBDA",
      lambdaConfig: { lambdaFunctionArn: publicFn.functionArn },
      serviceRoleArn: lambdaRole.roleArn,
    });

    new CfnGraphQLSchema(this, `${PROJECT_NAME}PublicSchema`, {
      apiId: this.publicApi.attrApiId,
      definition: schema,
    });
  }
}
