import { DynamoDB, QueryCommandInput } from "@aws-sdk/client-dynamodb";
import {
  CreateBookArgs,
  DeleteBookArgs,
  createBook,
  deleteBook,
  listBooks,
  updateBook,
} from "./books";
import {
  CreateTagsArgs,
  createTags,
  deleteTags,
  listTags,
  tagBook,
  untagBook,
} from "./tags";

enum AppsyncFunction {
  CreateBook = "createBook",
  UpdateBook = "updateBook",
  DeleteBook = "deleteBook",
  ListBooks = "listBooks",
  TagBook = "tagBook",
  UntagBook = "untagBook",
  ListTags = "listTags",
  CreateTags = "createTags",
  DeleteTag = "deleteTag",
  ListLEAs = "listLEAs",
}

export interface AppsyncRequestBase {
  function: AppsyncFunction;
  sub: string;
  args: CreateBookArgs | DeleteBookArgs | CreateTagsArgs;
}

export const ddb = new DynamoDB({ apiVersion: "2006-03-01" });

export const handler = async (event: AppsyncRequestBase) => {
  console.log("event", event);
  switch (event.function) {
    case AppsyncFunction.CreateBook:
      return createBook(event);
    case AppsyncFunction.UpdateBook:
      return updateBook(event);
    case AppsyncFunction.DeleteBook:
      return deleteBook(event);
    case AppsyncFunction.ListBooks:
      return listBooks();
    case AppsyncFunction.TagBook:
      return tagBook(event);
    case AppsyncFunction.UntagBook:
      return untagBook(event);
    case AppsyncFunction.ListTags:
      return listTags();
    case AppsyncFunction.CreateTags:
      return createTags(event);
    case AppsyncFunction.DeleteTag:
      return deleteTags(event);
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
