import {
  DeleteItemCommandInput,
  PutItemCommandInput,
  QueryCommandInput,
  UpdateItemCommandInput,
} from "@aws-sdk/client-dynamodb";
import { AppsyncRequestBase, ddb } from ".";

export interface CreateBookArgs {
  id: string;
  title: string;
  author: string;
  tags: string[];
}

export interface DeleteBookArgs {
  id: string;
}

export const createBook = async (event: AppsyncRequestBase) => {
  const a = event.args as CreateBookArgs;
  const putItemParams: PutItemCommandInput = {
    TableName: process.env.DYNAMO_TABLE!,
    Item: {
      PK: { S: `book#${a.id}` },
      SK: { S: "i" },
      data: {
        M: {
          title: { S: a.title },
          author: { S: a.author },
        },
      },
      createdAt: { S: new Date().toISOString() },
      createdBy: { S: event.sub },
    },
  };
  const result = await ddb.putItem(putItemParams);
  return result;
};

export const updateBook = async (event: AppsyncRequestBase) => {
  const a = event.args as CreateBookArgs;
  const M: { [key: string]: { S: string } } = {};
  if (a.title) M.title = { S: a.title };
  if (a.author) M.author = { S: a.author };
  const updateItemParams: UpdateItemCommandInput = {
    TableName: process.env.DYNAMO_TABLE!,
    Key: {
      PK: { S: `book#${a.id}` },
      SK: { S: "i" },
    },
    UpdateExpression:
      "SET #data = :data, updatedAt = :updatedAt, updatedBy = :updatedBy",
    ExpressionAttributeNames: {
      "#data": "data",
    },
    ExpressionAttributeValues: {
      ":data": {
        M,
      },
      ":updatedAt": { S: new Date().toISOString() },
      ":updatedBy": { S: event.sub },
    },
  };
  const result = await ddb.updateItem(updateItemParams);
  return result;
};

export const deleteBook = async (event: AppsyncRequestBase) => {
  const a = event.args as DeleteBookArgs;
  const deleteItemParams: DeleteItemCommandInput = {
    TableName: process.env.DYNAMO_TABLE!,
    Key: {
      PK: { S: `book#${a.id}` },
      SK: { S: "i" },
    },
  };
  const result = await ddb.deleteItem(deleteItemParams);
  return result;
};

export const listBooks = async () => {
  const queryParams: QueryCommandInput = {
    TableName: process.env.DYNAMO_TABLE!,
    KeyConditionExpression: "PK = :pk and SK = :sk",
    ExpressionAttributeValues: {
      ":pk": { S: "omni" },
      ":sk": { S: "i" },
    },
    AttributesToGet: ["PK", "SK", "books"],
  };
  const result = await ddb.query(queryParams);
  if (result.Items && result.Items.length > 0) {
    return result.Items[0].books?.L || [];
  } else {
    return [];
  }
};
