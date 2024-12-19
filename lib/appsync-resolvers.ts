import { Stack } from "aws-cdk-lib";
import { CfnFunctionConfiguration, CfnResolver } from "aws-cdk-lib/aws-appsync";
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
      datasource: props.appsync.privateDynamoDatasource,
      api: props.appsync.privateApi,
    });
    this.createResolver({
      typeName: "Query",
      fieldName: "getBook",
      kind: "UNIT",
      responseType: "Single",
      datasource: props.appsync.privateDynamoDatasource,
      api: props.appsync.privateApi,
    });
    this.createResolver({
      typeName: "Mutation",
      fieldName: "createBan",
      kind: "PIPELINE",
      responseType: "Single",
      datasource: props.appsync.privateDynamoDatasource,
      api: props.appsync.privateApi,
      functions: ["getBook", "putBan"],
    });
  }
  createResolver = (params: CreateResolverParams): CfnResolver => {
    const {
      typeName,
      fieldName,
      kind,
      responseType,
      datasource,
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
      const pipelineFunctions = functions?.map((functionName) => {
        const request = fs.readFileSync(
          `./assets/appsync/resolvers/Function.${functionName}.vtl`,
          "utf-8"
        );
        const response = fs.readFileSync(
          `./assets/appsync/resolvers/response.Single.vtl`,
          "utf-8"
        );
        const fn = new CfnFunctionConfiguration(
          this,
          `${PROJECT_NAME}${functionName}`,
          {
            apiId: api.attrApiId,
            dataSourceName: datasource!.attrName,
            name: functionName,
            requestMappingTemplate: request,
            responseMappingTemplate: response,
          }
        );
        console.log(fn.logicalId, fn.name, fn.ref, fn.attrFunctionArn);
        return fn.attrFunctionArn;
      });

      return new CfnResolver(this, `${PROJECT_NAME}${fieldName}${typeName}`, {
        apiId: api.attrApiId,
        fieldName,
        typeName,
        kind,
        dataSourceName: datasource?.attrName,
        requestMappingTemplate,
        responseMappingTemplate,
        pipelineConfig: {
          functions: pipelineFunctions,
        },
      });
    }
    return new CfnResolver(this, `${PROJECT_NAME}${fieldName}${typeName}`, {
      apiId: api.attrApiId,
      fieldName,
      typeName,
      kind,
      dataSourceName: datasource?.attrName,
      requestMappingTemplate,
      responseMappingTemplate,
    });
  };
}
