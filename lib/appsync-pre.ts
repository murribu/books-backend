import { Stack } from "aws-cdk-lib";
import {
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import config from "../config";
import { AppsyncPreProps } from "./interfaces";

const { PROJECT_NAME } = config;

export class AppsyncPre extends Stack {
  public readonly publicApiRole: Role;
  public readonly privateApiRole: Role;
  constructor(scope: Construct, id: string, props: AppsyncPreProps) {
    super(scope, id, props.stackProps);

    const privateApiPolicyDocument = new PolicyDocument();
    const privateApiPolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
    });
    privateApiPolicyStatement.addActions(
      "dynamodb:DeleteItem",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:UpdateItem",
      "dynamodb:BatchWriteItem"
    );
    privateApiPolicyStatement.addResources(
      props.dynamodb.table.tableArn,
      props.dynamodb.table.tableArn + "/*"
    );
    privateApiPolicyDocument.addStatements(privateApiPolicyStatement);

    this.privateApiRole = new Role(
      this,
      `${PROJECT_NAME}PrivateRoleAppsyncDS`,
      {
        assumedBy: new ServicePrincipal("appsync.amazonaws.com"),
        inlinePolicies: { dynamoDSPolicyDocument: privateApiPolicyDocument },
      }
    );

    const publicApiPolicyDocument = new PolicyDocument();
    const publicApiPolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
    });
    publicApiPolicyStatement.addActions("dynamodb:GetItem", "dynamodb:Query");

    publicApiPolicyStatement.addResources(
      props.dynamodb.table.tableArn,
      props.dynamodb.table.tableArn + "/*"
    );
    publicApiPolicyDocument.addStatements(publicApiPolicyStatement);

    this.publicApiRole = new Role(this, `${PROJECT_NAME}PublicRoleAppsyncDS`, {
      assumedBy: new ServicePrincipal("appsync.amazonaws.com"),
      inlinePolicies: { dynamoDSPolicyDocument: publicApiPolicyDocument },
    });
  }
}
