import { DynamoDB, QueryCommandInput } from "@aws-sdk/client-dynamodb";
import { listBooks } from "./books";
import { listTags } from "./tags";

enum AppsyncFunction {
  ListBooks = "listBooks",
  ListTags = "listTags",
  ListLEAs = "listLEAs",
}

export interface AppsyncRequestBase {
  function: AppsyncFunction;
  sub: string;
}

export const ddb = new DynamoDB({ apiVersion: "2006-03-01" });

export const handler = async (event: AppsyncRequestBase) => {
  console.log("event", event);
  switch (event.function) {
    case AppsyncFunction.ListBooks:
      return listBooks();
    case AppsyncFunction.ListTags:
      return listTags();
    case AppsyncFunction.ListLEAs:
      return listLEAs();
    default:
      throw new Error("Function not found");
  }
};

const listLEAs = async () => {
  const queryParams: QueryCommandInput = {
    TableName: process.env.DYNAMO_TABLE!,
    KeyConditionExpression: "PK = :pk and SK = :sk",
    ExpressionAttributeValues: {
      ":pk": { S: "omni" },
      ":sk": { S: "i" },
    },
    AttributesToGet: ["PK", "SK", "leas"],
  };
  const result = await ddb.query(queryParams);
  if (result.Items && result.Items.length > 0) {
    return result.Items[0].leas?.L || [];
  } else {
    return [];
  }
};
