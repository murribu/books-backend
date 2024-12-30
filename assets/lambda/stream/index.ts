import {
  AttributeValue,
  DynamoDB,
  QueryCommandInput,
  UpdateItemCommandInput,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBStreamEvent } from "aws-lambda";
export const ddb = new DynamoDB({ apiVersion: "2006-03-01" });

const TableName = process.env.TABLE_NAME || "";

const omniQueryParams: QueryCommandInput = {
  TableName,
  KeyConditionExpression: "PK = :pk and SK = :sk",
  ExpressionAttributeValues: {
    ":pk": { S: "omni" },
    ":sk": { S: "i" },
  },
};

export const handler = async (event: DynamoDBStreamEvent) => {
  console.log("event", JSON.stringify(event, null, 2));

  const newBookRecords = event.Records.filter(
    (record) =>
      record.dynamodb?.NewImage?.PK.S?.startsWith("book#") &&
      !record.dynamodb?.OldImage
  );
  const newTagRecords = event.Records.filter(
    (record) =>
      record.dynamodb?.NewImage?.PK.S?.startsWith("tag#") &&
      !record.dynamodb?.OldImage
  );
  const removedBookRecords = event.Records.filter(
    (record) =>
      record.dynamodb?.OldImage?.PK.S?.startsWith("book#") &&
      !record.dynamodb?.NewImage
  );
  const removedTagRecords = event.Records.filter(
    (record) =>
      record.dynamodb?.OldImage?.PK.S?.startsWith("tag#") &&
      !record.dynamodb?.NewImage
  );
  const newBanRecords = event.Records.filter(
    (record) =>
      record.dynamodb?.NewImage?.PK.S === "ban" && !record.dynamodb?.OldImage
  );
  const removedBanRecords = event.Records.filter(
    (record) =>
      record.dynamodb?.OldImage?.PK.S === "ban" && !record.dynamodb?.NewImage
  );
  let omni;
  if (newBookRecords.length > 0) {
    const omniResult = await ddb.query(omniQueryParams);
    if (omniResult.Items && omniResult.Items.length > 0) {
      omni = omniResult.Items[0] as Record<string, AttributeValue>;
    }
    const omniBooks = omni?.books?.L || [];
    const newBooksThatAreNotInOmni = newBookRecords.filter(
      (record) =>
        !omniBooks.find(
          (book) =>
            book.M?.id?.S === record.dynamodb?.NewImage?.PK.S?.split("#")[1]
        )
    );
    if (newBooksThatAreNotInOmni.length > 0) {
      const L: AttributeValue[] = newBooksThatAreNotInOmni.map((record) => ({
        M: {
          id: { S: record.dynamodb?.NewImage?.PK.S?.split("#")[1] || "" },
          title: { S: record.dynamodb?.NewImage?.title.S || "" },
          author: { S: record.dynamodb?.NewImage?.author.S || "" },
          count: { N: "0" },
        },
      }));
      const updateItemParams: UpdateItemCommandInput = {
        TableName,
        Key: {
          PK: { S: "omni" },
          SK: { S: "i" },
        },
        UpdateExpression:
          "SET books = list_append(if_not_exists(#books, :empty_list), :books)",
        ExpressionAttributeNames: {
          "#books": "books",
        },
        ExpressionAttributeValues: {
          ":books": {
            L,
          },
          ":empty_list": { L: [] },
        },
      };
      await ddb.updateItem(updateItemParams);
    }
  }
  if (newTagRecords.length > 0) {
    if (!omni) {
      const omniResult = await ddb.query(omniQueryParams);
      if (omniResult.Items && omniResult.Items.length > 0) {
        omni = omniResult.Items[0] as Record<string, AttributeValue>;
      }
    }
    const omniTags = omni?.tags?.L || [];
    const newTagsThatAreNotInOmni = newTagRecords.filter(
      (record) =>
        !omniTags.find(
          (tag) => tag.S === record.dynamodb?.NewImage?.PK.S?.split("#")[1]
        )
    );
    if (newTagsThatAreNotInOmni.length > 0) {
      const L: AttributeValue[] = newTagsThatAreNotInOmni.map((record) => ({
        S: record.dynamodb?.NewImage?.PK.S?.split("#")[1] || "",
      }));
      const updateItemParams: UpdateItemCommandInput = {
        TableName,
        Key: {
          PK: { S: "omni" },
          SK: { S: "i" },
        },
        UpdateExpression: "SET #tags = list_append(#tags, :tags)",
        ExpressionAttributeNames: {
          "#tags": "tags",
        },
        ExpressionAttributeValues: {
          ":tags": {
            L,
          },
        },
      };
      await ddb.updateItem(updateItemParams);
    }
  }
  if (removedBookRecords.length > 0) {
    if (!omni) {
      const omniResult = await ddb.query(omniQueryParams);
      if (omniResult.Items && omniResult.Items.length > 0) {
        omni = omniResult.Items[0] as Record<string, AttributeValue>;
      }
    }
    const omniBooks = omni?.books?.L || [];
    for (const index of removedBookRecords.keys()) {
      const omniIndex = omniBooks.findIndex(
        (book) =>
          book.M?.id?.S ===
          removedBookRecords[index].dynamodb?.OldImage?.PK.S?.split("#")[1]
      );
      if (omniIndex > -1) {
        omniBooks.splice(omniIndex, 1);
      }
    }
    const updateItemParams: UpdateItemCommandInput = {
      TableName,
      Key: {
        PK: { S: "omni" },
        SK: { S: "i" },
      },
      UpdateExpression: "SET #books = :books",
      ExpressionAttributeNames: {
        "#books": "books",
      },
      ExpressionAttributeValues: {
        ":books": {
          L: omniBooks,
        },
      },
    };
    await ddb.updateItem(updateItemParams);
  }
  if (removedTagRecords.length > 0) {
    if (!omni) {
      const omniResult = await ddb.query(omniQueryParams);
      if (omniResult.Items && omniResult.Items.length > 0) {
        omni = omniResult.Items[0] as Record<string, AttributeValue>;
      }
    }
    const omniTags = omni?.tags?.L || [];
    for (const index of removedTagRecords.keys()) {
      const omniIndex = omniTags.findIndex(
        (tag) =>
          tag.S ===
          removedTagRecords[index].dynamodb?.OldImage?.PK.S?.split("#")[1]
      );
      if (omniIndex > -1) {
        omniTags.splice(omniIndex, 1);
      }
    }
    const updateItemParams: UpdateItemCommandInput = {
      TableName,
      Key: {
        PK: { S: "omni" },
        SK: { S: "i" },
      },
      UpdateExpression: "SET #tags = :tags",
      ExpressionAttributeNames: {
        "#tags": "tags",
      },
      ExpressionAttributeValues: {
        ":tags": {
          L: omniTags,
        },
      },
    };
    await ddb.updateItem(updateItemParams);
  }
  if (newBanRecords.length > 0) {
    await processBanRecords(newBanRecords, omni, "new");
  }
  if (removedBanRecords.length > 0) {
    await processBanRecords(removedBanRecords, omni, "removed");
  }

  return "Success";
};

const processBanRecords = async (
  records: any[],
  omni: any,
  type: "new" | "removed"
) => {
  // for each record, update its lea's score in the omni record
  if (!omni) {
    const omniResult = await ddb.query(omniQueryParams);
    if (omniResult.Items && omniResult.Items.length > 0) {
      omni = omniResult.Items[0] as Record<string, AttributeValue>;
    }
  }
  const leas = omni?.leas?.L || [];
  const banTypes = omni?.banTypes?.L || [];
  for (const record of records) {
    let leaId: string;
    if (type === "new") {
      leaId = record.dynamodb?.NewImage?.GSI1PK.S.split("#")[1];
    } else {
      leaId = record.dynamodb?.OldImage?.GSI1PK.S.split("#")[1];
    }
    const leaIndex = leas.findIndex((lea: any) => lea.M?.id?.S === leaId);
    let banType: any;
    if (type === "new") {
      banType = banTypes.find(
        (banType: any) =>
          banType.M?.id?.S === record.dynamodb?.NewImage?.banTypeId.S
      );
    } else {
      banType = banTypes.find(
        (banType: any) =>
          banType.M?.id?.S === record.dynamodb?.OldImage?.banTypeId.S
      );
    }
    if (leaIndex > -1 && banType) {
      const lea = leas[leaIndex].M;
      const score = lea?.score?.N ? parseInt(lea.score.N) : 0;
      let newScore;
      if (type === "new") {
        newScore = (score + parseInt(banType.M?.score.N || "0")).toString();
      } else {
        newScore = (score - parseInt(banType.M?.score.N || "0")).toString();
      }
      const updateItemParams: UpdateItemCommandInput = {
        TableName,
        Key: {
          PK: { S: "omni" },
          SK: { S: "i" },
        },
        UpdateExpression: `SET #leas[${leaIndex}].score = :score`,
        ExpressionAttributeNames: {
          "#leas": "leas",
        },
        ExpressionAttributeValues: {
          ":score": {
            N: newScore,
          },
        },
      };
      const response = await ddb.updateItem(updateItemParams);
      console.log("update lea score response", response);
    }
  }
};
