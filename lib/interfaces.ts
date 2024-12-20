import { StackProps } from "aws-cdk-lib";
import { RestApi } from "aws-cdk-lib/aws-apigateway";
import {
  CfnApiKey,
  CfnDataSource,
  CfnGraphQLApi,
  DynamoDbDataSource,
  GraphqlApi,
  LambdaDataSource,
} from "aws-cdk-lib/aws-appsync";
import {
  CfnIdentityPool,
  CfnUserPoolClient,
  UserPool,
} from "aws-cdk-lib/aws-cognito";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { Role } from "aws-cdk-lib/aws-iam";
import { Function } from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";

export interface ApiGatewayProps {
  dynamodb: PropsFromDynamoDb;
  stackProps: StackProps;
}

export interface AppsyncPreProps {
  dynamodb: PropsFromDynamoDb;
  stackProps: StackProps;
}

export interface AppsyncProps {
  appsyncPre: PropsFromAppsyncPre;
  dynamodb: PropsFromDynamoDb;
  cognito: PropsFromCognito;
  stackProps: StackProps;
}

export interface AppsyncResolversProps {
  appsync: PropsFromAppsync;
  stackProps: StackProps;
}

export interface CognitoIamProps {
  appsync: PropsFromAppsync;
  cognito: PropsFromCognito;
  stackProps: StackProps;
}

export interface CognitoProps {
  stackProps: StackProps;
  dynamodb: PropsFromDynamoDb;
}

export interface CreateResolverParams {
  typeName: "Query" | "Mutation" | "Subscription";
  kind: "UNIT" | "PIPELINE";
  fieldName: string;
  responseType: "Lambda" | "Multiple" | "Single";
  api: GraphqlApi;
  dataSource?: DynamoDbDataSource | LambdaDataSource;
  functions?: string[];
}

export interface OutputProps {
  cognito: PropsFromCognito;
  appsync: PropsFromAppsync;
  apiGateway: PropsFromApiGateway;
  dynamodb: PropsFromDynamoDb;
  stackProps: StackProps;
}

export interface PropsFromApiGateway {
  api: RestApi;
}

export interface PropsFromAppsync {
  privateApi: GraphqlApi;
  privateDynamoDatasource: DynamoDbDataSource;
  publicDynamoDatasource: DynamoDbDataSource;
  privateLambdaDatasource: LambdaDataSource;
  publicLambdaDatasource: LambdaDataSource;
  publicApi: GraphqlApi;
  apiKey: string | undefined;
}

export interface PropsFromAppsyncPre {
  publicApiRole: Role;
  privateApiRole: Role;
}

export interface PropsFromCognito {
  userpool: UserPool;
  identitypool: CfnIdentityPool;
  webclient: CfnUserPoolClient;
  appsyncclient: CfnUserPoolClient;
}

export interface PropsFromDynamoDb {
  table: Table;
  deadLetterQueue: Queue;
  auditFunction: Function;
}
