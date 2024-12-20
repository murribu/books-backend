import { Stack } from "aws-cdk-lib";
import {
  CfnIdentityPool,
  CfnUserPool,
  CfnUserPoolClient,
  UserPool,
} from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import config from "../config";
import { CognitoProps } from "./interfaces";
0;

const { PROJECT_NAME } = config;

export class Cognito extends Stack {
  public readonly userpool: UserPool;
  public readonly identitypool: CfnIdentityPool;
  public readonly webclient: CfnUserPoolClient;
  public readonly appsyncclient: CfnUserPoolClient;
  constructor(scope: Construct, id: string, props: CognitoProps) {
    super(scope, id, props.stackProps);

    this.userpool = new UserPool(this, `${PROJECT_NAME}UserPool`, {
      autoVerify: { email: true },
      selfSignUpEnabled: false,
    });

    const cfnUserPool = this.userpool.node.defaultChild as CfnUserPool;

    cfnUserPool.usernameAttributes = ["email"];

    cfnUserPool.policies = {
      passwordPolicy: {
        minimumLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireSymbols: false,
        requireNumbers: false,
        temporaryPasswordValidityDays: 7,
      },
    };

    this.webclient = new CfnUserPoolClient(
      this,
      `${PROJECT_NAME}UserPoolClient`,
      {
        clientName: "web",
        userPoolId: this.userpool.userPoolId,
        generateSecret: false,
        explicitAuthFlows: ["USER_PASSWORD_AUTH", "ADMIN_NO_SRP_AUTH"],
      }
    );

    this.appsyncclient = new CfnUserPoolClient(
      this,
      `${PROJECT_NAME}AppsyncUserPoolClient`,
      {
        clientName: "appsync",
        userPoolId: this.userpool.userPoolId,
        generateSecret: false,
        explicitAuthFlows: ["ADMIN_NO_SRP_AUTH"],
      }
    );

    this.identitypool = new CfnIdentityPool(
      this,
      `${PROJECT_NAME}IdentityPool`,
      {
        cognitoIdentityProviders: [
          {
            providerName: cfnUserPool.attrProviderName,
            clientId: this.webclient.ref,
          },
        ],
        allowUnauthenticatedIdentities: false,
      }
    );
  }
}
