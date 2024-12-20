import { Stack } from "aws-cdk-lib";
import { CfnIdentityPoolRoleAttachment } from "aws-cdk-lib/aws-cognito";
import {
  Effect,
  FederatedPrincipal,
  PolicyDocument,
  PolicyStatement,
  Role,
} from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import config from "../config";

import { CognitoIamProps } from "./interfaces";

const { PROJECT_NAME } = config;
export class CognitoIam extends Stack {
  constructor(scope: Construct, id: string, props: CognitoIamProps) {
    super(scope, id, props.stackProps);

    const unauthPolicyDocument = new PolicyDocument();

    const unauthPolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
    });

    unauthPolicyStatement.addActions("cognito-sync:*");

    unauthPolicyStatement.addResources("*");
    unauthPolicyDocument.addStatements(unauthPolicyStatement);

    const cognitoAuthPolicyDocument = new PolicyDocument();

    const cognitoAuthPolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
    });

    cognitoAuthPolicyStatement.addActions(
      "cognito-sync:*",
      "cognito-identity:*"
    );

    cognitoAuthPolicyStatement.addResources("*");
    cognitoAuthPolicyDocument.addStatements(cognitoAuthPolicyStatement);

    const appsyncAuthPolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
    });

    appsyncAuthPolicyStatement.addActions("appsync:GraphQL");
    appsyncAuthPolicyStatement.addResources(
      props.appsync.privateApi.arn,
      "arn:aws:appsync:*:*:apis/*/types/*/fields/*"
    );
    cognitoAuthPolicyDocument.addStatements(appsyncAuthPolicyStatement);

    const unauthRole = new Role(this, `${PROJECT_NAME}UnauthRole`, {
      assumedBy: new FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud":
              props.cognito.identitypool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      roleName: `a${PROJECT_NAME}UnauthRole`,
      inlinePolicies: {
        unauthPolicyDocument: unauthPolicyDocument,
      },
    });

    const authRole = new Role(this, `${PROJECT_NAME}AuthRole`, {
      assumedBy: new FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud":
              props.cognito.identitypool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      roleName: `a${PROJECT_NAME}AuthRole`,
      inlinePolicies: {
        cognitoAuthPolicyDocument: cognitoAuthPolicyDocument,
      },
    });

    new CfnIdentityPoolRoleAttachment(this, `${PROJECT_NAME}RoleAttachment`, {
      identityPoolId: props.cognito.identitypool.ref,
      roles: {
        unauthenticated: unauthRole.roleArn,
        authenticated: authRole.roleArn,
      },
    });
  }
}
