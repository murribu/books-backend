import { Stack } from "aws-cdk-lib";
import {
  AppsyncFunction,
  BaseDataSource,
  CfnFunctionConfiguration,
  CfnResolver,
  GraphqlApi,
  MappingTemplate,
  Resolver,
} from "aws-cdk-lib/aws-appsync";
import { Construct } from "constructs";
import config from "../config";
import { AppsyncResolversProps, CreateResolverParams } from "./interfaces";
import fs = require("fs");

const { PROJECT_NAME } = config;

export class AppsyncResolvers extends Stack {
  constructor(scope: Construct, id: string, props: AppsyncResolversProps) {
    super(scope, id, props.stackProps);

    this.createResolver({
      typeName: "Query",
      fieldName: "getOmni",
      kind: "UNIT",
      responseType: "Single",
      dataSource: props.appsync.privateDynamoDatasource,
      api: props.appsync.privateApi,
    });
    this.createResolver({
      typeName: "Query",
      fieldName: "getBook",
      kind: "UNIT",
      responseType: "Single",
      dataSource: props.appsync.privateDynamoDatasource,
      api: props.appsync.privateApi,
    });
    this.createResolver({
      typeName: "Mutation",
      fieldName: "createBan",
      kind: "PIPELINE",
      responseType: "Single",
      dataSource: props.appsync.privateDynamoDatasource,
      api: props.appsync.privateApi,
      functions: ["getBook", "putBan"],
    });
    this.createResolver({
      typeName: "Mutation",
      fieldName: "createBook",
      kind: "UNIT",
      responseType: "Single",
      dataSource: props.appsync.privateDynamoDatasource,
      api: props.appsync.privateApi,
    });
  }
  createResolver = (params: CreateResolverParams): Resolver => {
    const {
      typeName,
      fieldName,
      kind,
      responseType,
      dataSource,
      api,
      functions,
    } = params;

    const requestMappingTemplate = fs.readFileSync(
      `./assets/appsync/resolvers/${typeName}.${fieldName}.vtl`,
      "utf-8"
    );
    const responseMappingTemplate = fs.readFileSync(
      `./assets/appsync/resolvers/response.${responseType}.vtl`,
      "utf-8"
    );
    if (kind === "PIPELINE") {
      const pipelineConfig = functions?.map((functionName) => {
        const request = fs.readFileSync(
          `./assets/appsync/resolvers/Function.${functionName}.vtl`,
          "utf-8"
        );
        const response = fs.readFileSync(
          `./assets/appsync/resolvers/response.Single.vtl`,
          "utf-8"
        );
        return new AppsyncFunction(this, `${PROJECT_NAME}${functionName}`, {
          api: api,
          dataSource: dataSource as BaseDataSource,
          name: functionName,
          requestMappingTemplate: MappingTemplate.fromString(request),
          responseMappingTemplate: MappingTemplate.fromString(response),
        });
      });
      return new Resolver(this, `${PROJECT_NAME}${fieldName}${typeName}`, {
        api,
        fieldName,
        typeName,
        requestMappingTemplate: MappingTemplate.fromString(
          requestMappingTemplate
        ),
        responseMappingTemplate: MappingTemplate.fromString(
          responseMappingTemplate
        ),
        pipelineConfig,
      });
    }
    // UNIT, not PIPELINE
    return new Resolver(this, `${PROJECT_NAME}${fieldName}${typeName}`, {
      api,
      fieldName,
      typeName,
      dataSource,
      requestMappingTemplate: MappingTemplate.fromString(
        requestMappingTemplate
      ),
      responseMappingTemplate: MappingTemplate.fromString(
        responseMappingTemplate
      ),
    });
  };
}
