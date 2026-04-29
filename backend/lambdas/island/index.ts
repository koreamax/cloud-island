import { getIslandDataByAccountId } from "../../../src/shared/cloud/island-service";
import {
  getLatestIslandSnapshot,
  listSavedIslands,
} from "../../../src/shared/cloud/snapshot-store";
import {
  listActivePlayers,
  savePlayerPresence,
} from "../../../src/shared/cloud/player-presence-store";
import type { MultiplayerPlayerState } from "../../../src/shared/cloud/cloud-island";

interface ApiGatewayEvent {
  queryStringParameters?: Record<string, string | undefined> | null;
  rawPath?: string;
  body?: string | null;
  requestContext?: {
    http?: {
      method?: string;
    };
  };
}

interface ApiGatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function response(statusCode: number, body: unknown): ApiGatewayResponse {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

export async function handler(
  event: ApiGatewayEvent
): Promise<ApiGatewayResponse> {
  const method = event.requestContext?.http?.method ?? "GET";

  if (event.rawPath?.endsWith("/players")) {
    if (method === "GET") {
      const players = await listActivePlayers();
      return response(200, { players });
    }

    if (method === "POST") {
      const payload = event.body
        ? (JSON.parse(event.body) as Partial<MultiplayerPlayerState>)
        : {};

      if (
        !payload.playerId ||
        !payload.label ||
        !Array.isArray(payload.position) ||
        !Array.isArray(payload.forward)
      ) {
        return response(400, { error: "playerId, label, position, and forward are required" });
      }

      const player = await savePlayerPresence({
        playerId: payload.playerId,
        label: payload.label,
        islandId: payload.islandId ?? null,
        active: Boolean(payload.active),
        balloonMode: Boolean(payload.balloonMode),
        position: [
          Number(payload.position[0] ?? 0),
          Number(payload.position[1] ?? 0),
          Number(payload.position[2] ?? 0),
        ],
        forward: [
          Number(payload.forward[0] ?? 0),
          Number(payload.forward[1] ?? 0),
          Number(payload.forward[2] ?? -1),
        ],
      });

      return response(200, { player });
    }

    return response(405, { error: "Method not allowed" });
  }

  if (event.rawPath?.endsWith("/islands")) {
    const islands = await listSavedIslands();
    return response(200, { islands });
  }

  const accountId = event.queryStringParameters?.accountId;

  if (!accountId) {
    return response(400, { error: "accountId parameter is required" });
  }

  if (!/^\d{12}$/.test(accountId)) {
    return response(400, { error: "accountId must be a 12-digit number" });
  }

  const latestSnapshot = await getLatestIslandSnapshot(accountId);
  return response(200, latestSnapshot ?? getIslandDataByAccountId(accountId));
}
