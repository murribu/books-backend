import { Stack, StackProps } from "aws-cdk-lib";
import {
  Architecture,
  Code,
  LayerVersion,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as path from "path";
import config from "../config";

const { PROJECT_NAME } = config;

export class Layers extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const awsLayer = new LayerVersion(this, `${PROJECT_NAME}AwsLayer`, {
      code: Code.fromAsset(path.join(__dirname, "../assets/lambda/layers/aws")),
      compatibleArchitectures: [Architecture.ARM_64, Architecture.X86_64],
      compatibleRuntimes: [Runtime.NODEJS_22_X],
      description: "Stubminer Aws Layer",
    });

    // Record the versionArn into SSM
    new StringParameter(this, "AwsVersionArn", {
      parameterName: `${PROJECT_NAME}AwsLayerArn`,
      stringValue: awsLayer.layerVersionArn,
    });
  }
}
