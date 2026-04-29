import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { MultiplayerPlayerState } from "./cloud-island";

const TABLE_NAME = process.env.PLAYER_STATE_TABLE_NAME;
const REGION = process.env.AWS_REGION || "ap-northeast-2";
const ACTIVE_WINDOW_MS = 20_000;

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION })
);

type PlayerPresenceItem = MultiplayerPlayerState;

function requireTableName(): string {
  if (!TABLE_NAME) {
    throw new Error("PLAYER_STATE_TABLE_NAME is not configured");
  }

  return TABLE_NAME;
}

export async function savePlayerPresence(
  player: Omit<MultiplayerPlayerState, "updatedAt">
): Promise<MultiplayerPlayerState> {
  const updatedAt = new Date().toISOString();
  const item: PlayerPresenceItem = {
    ...player,
    updatedAt,
  };

  await dynamo.send(
    new PutCommand({
      TableName: requireTableName(),
      Item: item,
    })
  );

  return item;
}

export async function listActivePlayers(): Promise<MultiplayerPlayerState[]> {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: requireTableName(),
    })
  );

  const cutoff = Date.now() - ACTIVE_WINDOW_MS;

  return ((result.Items as PlayerPresenceItem[] | undefined) ?? [])
    .filter((item) => {
      const updatedAt = Date.parse(item.updatedAt);
      return Number.isFinite(updatedAt) && updatedAt >= cutoff && item.active;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
