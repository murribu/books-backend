#!/usr/bin/env nodeimport "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { Appsync } from "../lib/appsync";
import { AppsyncPre } from "../lib/appsync-pre";
import { AppsyncResolvers } from "../lib/appsync-resolvers";
import { Codebuild } from "../lib/codebuild";
import { Cognito } from "../lib/cognito";
import { DynamoDb } from "../lib/dynamodb";
import { Layers } from "../lib/layers";

import config from "../config";

const { PROJECT_NAME } = config;

const env = { region: "us-east-1" };
const app = new cdk.App();

const layers = new Layers(app, `${PROJECT_NAME}Layers`, { env });
const dynamodb = new DynamoDb(app, `${PROJECT_NAME}DynamoDb`, {
  env,
});
dynamodb.addDependency(layers);
const appsyncPre = new AppsyncPre(app, `${PROJECT_NAME}AppsyncPre`, {
  dynamodb,
  stackProps: { env },
});
const cognito = new Cognito(app, `${PROJECT_NAME}Cognito`, {
  dynamodb,
  stackProps: { env },
});
cognito.addDependency(layers);
const appsync = new Appsync(app, `${PROJECT_NAME}Appsync`, {
  stackProps: { env },
  cognito,
  dynamodb,
  appsyncPre,
});
appsync.addDependency(layers);
new AppsyncResolvers(app, `${PROJECT_NAME}AppsyncResolvers`, {
  stackProps: { env },
  appsync,
});
new Codebuild(app, `${PROJECT_NAME}BackendCodebuild`, {
  env,
});
