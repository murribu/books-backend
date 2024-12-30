import {
  BatchWriteItemCommandInput,
  PutItemCommandInput,
  QueryCommandInput,
  UpdateItemCommandInput,
} from "@aws-sdk/client-dynamodb";
import { AppsyncRequestBase, ddb } from ".";

export interface CreateTagsArgs {
  tags: string[];
}

export interface TagBookArgs {
  bookId: string;
  tags: string[];
}

export const createTags = async (event: AppsyncRequestBase) => {
  const a = event.args as CreateTagsArgs;
  //get the omni item and add the tags
  const queryParams: QueryCommandInput = {
    TableName: process.env.DYNAMO_TABLE!,
    KeyConditionExpression: "PK = :pk AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": { S: `omni` },
      ":sk": { S: "i" },
    },
  };
  const result = await ddb.query(queryParams);

  if (!result.Items || result.Items?.length === 0) {
    const putItemCommandInput: PutItemCommandInput = {
      TableName: process.env.DYNAMO_TABLE!,
      Item: {
        PK: { S: `omni` },
        SK: { S: "i" },
        tags: { SS: a.tags },
      },
    };
    const putItemResult = await ddb.putItem(putItemCommandInput);
    console.log({ putItemResult: JSON.stringify(putItemResult) });
  } else {
    const tags = result.Items[0].tags?.SS || [];
    const updateItemCommandInput: UpdateItemCommandInput = {
      TableName: process.env.DYNAMO_TABLE!,
      Key: {
        PK: { S: `omni` },
        SK: { S: "i" },
      },
      UpdateExpression: "SET tags = list_append(tags, :tags)",
      ExpressionAttributeValues: {
        ":tags": { SS: a.tags },
      },
    };
    const updateItemResult = await ddb.updateItem(updateItemCommandInput);
    console.log({ updateItemResult: JSON.stringify(updateItemResult) });
  }
};

export const tagBook = async (event: AppsyncRequestBase) => {
  const a = event.args as TagBookArgs;

  const batchWriteItemCommandInput: BatchWriteItemCommandInput = {
    RequestItems: {
      [process.env.DYNAMO_TABLE!]: a.tags.map((tag) => ({
        PutRequest: {
          Item: {
            PK: { S: `book#${a.bookId}` },
            SK: { S: `tag#${tag}` },
            createdBy: { S: event.sub },
            createdAt: { S: new Date().toISOString() },
          },
        },
      })),
    },
  };
  const result = await ddb.batchWriteItem(batchWriteItemCommandInput);
  console.log({ result: JSON.stringify(result) });
};

export const untagBook = async (event: AppsyncRequestBase) => {
  const a = event.args as TagBookArgs;

  const batchWriteItemCommandInput: BatchWriteItemCommandInput = {
    RequestItems: {
      [process.env.DYNAMO_TABLE!]: a.tags.map((tag) => ({
        DeleteRequest: {
          Key: {
            PK: { S: `book#${a.bookId}` },
            SK: { S: `tag#${tag}` },
          },
        },
      })),
    },
  };
  const result = await ddb.batchWriteItem(batchWriteItemCommandInput);
  console.log({ result: JSON.stringify(result) });
};

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

export const deleteTags = async (event: AppsyncRequestBase) => {
  const a = event.args as CreateTagsArgs;

  const queryParams: QueryCommandInput = {
    TableName: process.env.DYNAMO_TABLE!,
    KeyConditionExpression: "PK = :pk AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": { S: `omni` },
      ":sk": { S: "i" },
    },
    AttributesToGet: ["PK", "SK", "tags"],
  };
  const result = await ddb.query(queryParams);
  if (!result.Items || result.Items?.length === 0) {
    return;
  }
  const tags = result.Items[0].tags?.SS || [];
  const newTags = tags.filter((tag) => !a.tags.includes(tag));
  const updateItemCommandInput: UpdateItemCommandInput = {
    TableName: process.env.DYNAMO_TABLE!,
    Key: {
      PK: { S: `omni` },
      SK: { S: "i" },
    },
    UpdateExpression: "SET tags = :tags",
    ExpressionAttributeValues: {
      ":tags": { SS: newTags },
    },
  };
  const updateItemResult = await ddb.updateItem(updateItemCommandInput);
  console.log({ updateItemResult: JSON.stringify(updateItemResult) });
};
