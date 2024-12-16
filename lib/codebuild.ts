import { Stack, StackProps } from "aws-cdk-lib";
import {
  BuildSpec,
  LinuxBuildImage,
  PipelineProject,
} from "aws-cdk-lib/aws-codebuild";
import {
  Artifact,
  CfnPipeline,
  ExecutionMode,
  Pipeline,
  PipelineType,
} from "aws-cdk-lib/aws-codepipeline";
import {
  CodeBuildAction,
  CodeStarConnectionsSourceAction,
} from "aws-cdk-lib/aws-codepipeline-actions";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import config from "../config";

const { REPO, CONNECTION_ARN, REPO_OWNER, PROJECT_NAME, BRANCH } = config;

const actionName = "GitHub";

export class Codebuild extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const pipeline = new Pipeline(this, `${PROJECT_NAME}BackendPipeline`, {
      pipelineName: `${PROJECT_NAME}BackendPipeline`,
      pipelineType: PipelineType.V2,
      executionMode: ExecutionMode.QUEUED,
    });

    const artifact = new Artifact();

    const cfnPipeline = pipeline.node.defaultChild as CfnPipeline;

    cfnPipeline.addPropertyOverride("Triggers", [
      {
        GitConfiguration: {
          Push: [
            {
              Branches: {
                Includes: [BRANCH],
              },
            },
          ],
          SourceActionName: actionName,
        },
        ProviderType: "CodeStarSourceConnection",
      },
    ]);

    pipeline.addStage({
      stageName: "Source",
      actions: [
        new CodeStarConnectionsSourceAction({
          actionName,
          owner: REPO_OWNER,
          repo: REPO,
          output: artifact,
          connectionArn: CONNECTION_ARN,
          branch: BRANCH,
        }),
      ],
    });

    const project = new PipelineProject(this, `${PROJECT_NAME}BackendBuild`, {
      projectName: `${PROJECT_NAME}BackendBuild`,
      buildSpec: BuildSpec.fromSourceFilename("buildspec.yml"),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_7_0,
      },
    });

    project.role?.addToPrincipalPolicy(
      new PolicyStatement({
        actions: [
          "secretsmanager:GetSecretValue",
          "cloudfront:*",
          "s3:*",
          "lambda:*",
          "apigateway:*",
          "appsync:*",
          "cognito-idp:*",
          "acm:GetAccountConfiguration",
          "acm:DescribeCertificate",
          "acm:GetCertificate",
          "acm:ListCertificates",
          "acm:ListTagsForCertificate",
          "ssm:GetParameter",
          "cloudformation:*",
          "iam:PassRole",
        ],
        resources: ["*"],
      })
    );

    const action = new CodeBuildAction({
      actionName: "Build",
      project,
      input: artifact,
    });

    pipeline.addStage({
      stageName: "Build",
      actions: [action],
    });
  }
}
