import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { AttributeType, StreamViewType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import config from "../config";
import {
  Code,
  Function,
  LayerVersion,
  Runtime,
  StartingPosition,
} from "aws-cdk-lib/aws-lambda";
import path = require("path");
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";

const { PROJECT_NAME } = config;

export class DynamoDb extends Stack {
  public readonly table: Table;
  public readonly deadLetterQueue: Queue;
  public readonly auditFunction: Function;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const awsLayerArn = StringParameter.valueForStringParameter(
      this,
      `${PROJECT_NAME}AwsLayerArn`
    );

    const awsLayer = LayerVersion.fromLayerVersionArn(
      this,
      "DynamodbAwsLayerFromArn",
      awsLayerArn
    );
    const tableName = `${PROJECT_NAME}`;

    this.table = new Table(this, tableName, {
      tableName,
      partitionKey: { name: "PK", type: AttributeType.STRING },
      sortKey: { name: "SK", type: AttributeType.STRING },
      stream: StreamViewType.NEW_IMAGE,
      readCapacity: 2,
      writeCapacity: 1,
    });

    this.deadLetterQueue = new Queue(this, "deadLetterQueue");

    this.table.addGlobalSecondaryIndex({
      indexName: `GSI1`,
      partitionKey: {
        name: `GSI1PK`,
        type: AttributeType.STRING,
      },
      sortKey: {
        name: `GSI1SK`,
        type: AttributeType.STRING,
      },
      readCapacity: 2,
      writeCapacity: 1,
    });

    const streamFunction = new Function(this, `${PROJECT_NAME}StreamFunction`, {
      runtime: Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: Code.fromAsset(path.join(__dirname, "../assets/lambda/stream"), {
        exclude: ["node_modules"],
      }),
      environment: {
        TABLE_NAME: this.table.tableName,
        DEAD_LETTER_QUEUE_URL: this.deadLetterQueue.queueUrl,
      },
      layers: [awsLayer],
    });

    const seedFunction = new Function(this, `${PROJECT_NAME}SeedFunction`, {
      runtime: Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: Code.fromAsset(path.join(__dirname, "../assets/lambda/seed"), {
        exclude: ["node_modules"],
      }),
      environment: {
        TABLE_NAME: this.table.tableName,
      },
      layers: [awsLayer],
    });

    const seedRole = seedFunction.role;

    const dynamoPolicy = new Policy(this, `${PROJECT_NAME}ApiFnPolicy`);

    const dynamoPolicyStatement = new PolicyStatement({ effect: Effect.ALLOW });
    dynamoPolicyStatement.addActions("secretsmanager:GetSecretValue");

    dynamoPolicyStatement.addActions("dynamodb:Query");
    dynamoPolicyStatement.addActions("dynamodb:PutItem");
    dynamoPolicyStatement.addActions("dynamodb:UpdateItem");

    dynamoPolicyStatement.addResources(
      this.table.tableArn,
      `${this.table.tableArn}/index/*`,
      `arn:aws:secretsmanager:us-east-1:${this.account}:secret:*`
    );
    dynamoPolicy.addStatements(dynamoPolicyStatement);
    seedRole?.attachInlinePolicy(dynamoPolicy);
    streamFunction.addEventSource(
      new DynamoEventSource(this.table, {
        startingPosition: StartingPosition.TRIM_HORIZON,
        batchSize: 50,
      })
    );
  }
}
