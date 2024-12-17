import { QueryCommandInput } from "@aws-sdk/client-dynamodb";
import { ddb } from ".";

export const listTags = async () => {
  const queryParams: QueryCommandInput = {
    TableName: process.env.DYNAMO_TABLE!,
    KeyConditionExpression: "PK = :pk and SK = :sk",
    ExpressionAttributeValues: {
      ":pk": { S: "omni" },
      ":sk": { S: "i" },
    },
    AttributesToGet: ["PK", "SK", "tags"],
  };
  const result = await ddb.query(queryParams);
  if (result.Items && result.Items.length > 0) {
    return result.Items[0].tags?.L || [];
  } else {
    return [];
  }
};
