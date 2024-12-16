import { Stack } from "aws-cdk-lib";
import { CfnResolver } from "aws-cdk-lib/aws-appsync";
import { Construct } from "constructs";
import config from "../config";
import { AppsyncResolversProps, CreateResolverParams } from "./interfaces";
import fs = require("fs");

const { PROJECT_NAME } = config;

export class AppsyncResolvers extends Stack {
  constructor(scope: Construct, id: string, props: AppsyncResolversProps) {
    super(scope, id, props.stackProps);

    // this.createResolver({
    //   typeName: "Query",
    //   fieldName: "createCustomerPortalSession",
    //   kind: "UNIT",
    //   responseType: "Single",
    //   datasource: props.appsync.lambdadatasource,
    // });
  }
  createResolver = (params: CreateResolverParams): CfnResolver => {
    const { typeName, fieldName, kind, responseType, datasource, api } = params;

    if (kind === "PIPELINE") {
      throw "Not yet implemented";
    }
    const requestMappingTemplate = fs.readFileSync(
      `./assets/appsync/resolvers/${typeName}.${fieldName}.vtl`,
      "utf-8"
    );
    const responseMappingTemplate = fs.readFileSync(
      `./assets/appsync/resolvers/response.${responseType}.vtl`,
      "utf-8"
    );
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
