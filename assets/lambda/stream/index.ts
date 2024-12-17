import { DynamoDB, QueryCommandInput } from "@aws-sdk/client-dynamodb";
import { DynamoDBStreamEvent } from "aws-lambda";
export const ddb = new DynamoDB({ apiVersion: "2006-03-01" });

export const handler = async (event: DynamoDBStreamEvent) => {
  console.log("event", event);

  // find all event records whose PK starts with "Book#"
  const bookRecords = event.Records.filter((record) =>
    record.dynamodb?.NewImage?.PK.S?.startsWith("book#")
  );
  let omni;
  const queryParams: QueryCommandInput = {
    TableName: process.env.DYNAMO_TABLE!,
    KeyConditionExpression: "PK = :pk and SK = :sk",
    ExpressionAttributeValues: {
      ":pk": { S: "omni" },
      ":sk": { S: "i" },
    },
    AttributesToGet: ["PK", "SK", "books", "tags"],
  };
  if (bookRecords.length > 0) {
    const result = await ddb.query(queryParams);
    if (result.Items && result.Items.length > 0) {
      omni = result.Items[0];
    }
    // update omni with books
    const books = bookRecords.map((record) => ({
      M: {
        id: record.dynamodb?.NewImage?.SK,
        title: record.dynamodb?.NewImage?.title,
  }
  return event;
};
