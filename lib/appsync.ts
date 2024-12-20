import { Duration, Stack } from "aws-cdk-lib";
import {
  AuthorizationType,
  Definition,
  DynamoDbDataSource,
  GraphqlApi,
  LambdaDataSource,
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
  public readonly privateApi: GraphqlApi;
  public readonly privateDynamoDatasource: DynamoDbDataSource;
  public readonly publicDynamoDatasource: DynamoDbDataSource;
  public readonly privateLambdaDatasource: LambdaDataSource;
  public readonly publicLambdaDatasource: LambdaDataSource;
  public readonly publicApi: GraphqlApi;
  public readonly apiKey: string | undefined;

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
    this.privateApi = new GraphqlApi(this, `${PROJECT_NAME}Api`, {
      name: `${PROJECT_NAME}Api`,
      definition: Definition.fromFile(
        path.join(__dirname, "../assets/appsync/privateSchema.graphql")
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: props.cognito.userpool,
          },
        },
      },
    });
    this.privateDynamoDatasource = this.privateApi.addDynamoDbDataSource(
      `${PROJECT_NAME}PrivateDynamoDataSource`,
      props.dynamodb.table
    );

    this.privateDynamoDatasource.ds.serviceRoleArn =
      props.appsyncPre.privateApiRole.roleArn;

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

    this.privateLambdaDatasource = this.privateApi.addLambdaDataSource(
      privateLambdaDsName,
      privateFn
    );

    this.privateLambdaDatasource.ds.serviceRoleArn = lambdaRole.roleArn;

    this.publicApi = new GraphqlApi(this, `${PROJECT_NAME}PublicApi`, {
      name: `${PROJECT_NAME}PublicApi`,
      definition: Definition.fromFile(
        path.join(__dirname, "../assets/appsync/publicSchema.graphql")
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.API_KEY,
        },
      },
    });

    this.apiKey = this.publicApi.apiKey;

    publicFn.role?.attachInlinePolicy(dynamoPolicy);
    privateFn.role?.attachInlinePolicy(cognitoPolicy);
    privateFn.role?.attachInlinePolicy(dynamoPolicy);

    this.publicLambdaDatasource = this.publicApi.addLambdaDataSource(
      publicLambdaDsName,
      publicFn
    );

    this.publicLambdaDatasource.ds.serviceRoleArn = lambdaRole.roleArn;
  }
}
