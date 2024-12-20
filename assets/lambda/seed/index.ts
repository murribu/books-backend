import {
  DynamoDB,
  PutItemCommandInput,
  QueryCommandInput,
  UpdateItemCommandInput,
} from "@aws-sdk/client-dynamodb";
export const ddb = new DynamoDB({ apiVersion: "2006-03-01" });
const leas = require("./leas.json");

const TableName = process.env.TABLE_NAME!;
export const handler = async () => {
  const queryParams: QueryCommandInput = {
    TableName,
    KeyConditionExpression: "PK = :pk and SK = :sk",
    ExpressionAttributeValues: {
      ":pk": { S: "omni" },
      ":sk": { S: "i" },
    },
  };
  const result = await ddb.query(queryParams);
  if (result.Items && result.Items.length > 0) {
    if (result.Items[0].leas?.L && result.Items[0].leas?.L.length > 0) {
      return "No need to seed";
    } else {
      // update omni with leas
      const updateItemParams: UpdateItemCommandInput = {
        TableName,
        Key: {
          PK: { S: "omni" },
          SK: { S: "i" },
        },
        UpdateExpression: "SET #leas = :leas",
        ExpressionAttributeNames: {
          "#leas": "leas",
        },
        ExpressionAttributeValues: {
          ":leas": {
            L: leas,
          },
        },
      };
      const updateResult = await ddb.updateItem(updateItemParams);
      return updateResult;
    }
  } else {
    // put omni with leas
    const putItemParams: PutItemCommandInput = {
      TableName,
      Item: {
        PK: { S: "omni" },
        SK: { S: "i" },
        leas: { L: leas },
      },
    };
    const putResult = await ddb.putItem(putItemParams);
    return putResult;
  }
};
