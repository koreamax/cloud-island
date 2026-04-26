import { syncIslandFromRole } from "../../../src/shared/cloud/cloudtrail-sync";

interface ApiGatewayEvent {
  body?: string | null;
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
  try {
    const payload = event.body
      ? (JSON.parse(event.body) as { roleArn?: string })
      : {};
    const roleArn = payload.roleArn;

    if (!roleArn) {
      return response(400, {
        error: "Valid Role ARN is required (arn:aws:iam::...)",
      });
    }

    const islandData = await syncIslandFromRole(roleArn, {
      region: process.env.AWS_REGION,
      externalId: process.env.CLOUD_ISLAND_EXTERNAL_ID,
    });

    return response(200, islandData);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error during sync";
    console.error("Sync error:", error);
    return response(500, { error: message });
  }
}
