import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import {
  CloudTrailClient,
  LookupEventsCommand,
} from "@aws-sdk/client-cloudtrail";
import { categorizeService } from "./aws-categories";
import type { CategoryActivity, IslandData } from "./cloud-island";

const DEFAULT_REGION = "ap-northeast-2";
const DEFAULT_EXTERNAL_ID = "celesta-local-test";

export interface SyncIslandOptions {
  region?: string;
  externalId?: string;
}

export async function syncIslandFromRole(
  roleArn: string,
  options: SyncIslandOptions = {}
): Promise<IslandData> {
  if (!roleArn.startsWith("arn:aws:iam::")) {
    throw new Error("Valid Role ARN is required (arn:aws:iam::...)");
  }

  const accountId = roleArn.split(":")[4];
  const region = options.region ?? DEFAULT_REGION;
  const externalId = options.externalId ?? DEFAULT_EXTERNAL_ID;

  const stsClient = new STSClient({ region });
  const assumeResult = await stsClient.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: "cloud-island-sync",
      ExternalId: externalId,
      DurationSeconds: 900,
    })
  );

  const credentials = assumeResult.Credentials;
  if (!credentials) {
    throw new Error("Failed to assume role because no credentials were returned");
  }

  const cloudTrailClient = new CloudTrailClient({
    region,
    credentials: {
      accessKeyId: credentials.AccessKeyId!,
      secretAccessKey: credentials.SecretAccessKey!,
      sessionToken: credentials.SessionToken!,
    },
  });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const allEvents: {
    eventSource: string;
    eventName: string;
    errorCode?: string;
    username?: string;
  }[] = [];

  let nextToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const result = await cloudTrailClient.send(
      new LookupEventsCommand({
        StartTime: weekAgo,
        EndTime: now,
        MaxResults: 50,
        NextToken: nextToken,
      })
    );

    for (const event of result.Events ?? []) {
      allEvents.push({
        eventSource: event.EventSource ?? "unknown",
        eventName: event.EventName ?? "unknown",
        errorCode: event.CloudTrailEvent
          ? (() => {
              try {
                const parsed = JSON.parse(event.CloudTrailEvent);
                return parsed.errorCode;
              } catch {
                return undefined;
              }
            })()
          : undefined,
        username: event.Username ?? "unknown",
      });
    }

    nextToken = result.NextToken;
    if (!nextToken) {
      break;
    }
  }

  const categoryMap = new Map<
    string,
    {
      apiCallCount: number;
      errorCount: number;
      services: Map<string, number>;
      principals: Map<string, number>;
    }
  >();

  for (const categoryId of [
    "compute",
    "storage",
    "database",
    "networking",
    "security",
    "management",
    "aiml",
  ]) {
    categoryMap.set(categoryId, {
      apiCallCount: 0,
      errorCount: 0,
      services: new Map(),
      principals: new Map(),
    });
  }

  for (const event of allEvents) {
    const categoryId = categorizeService(event.eventSource);
    const category = categoryMap.get(categoryId)!;

    category.apiCallCount += 1;
    if (event.errorCode) {
      category.errorCount += 1;
    }

    category.services.set(
      event.eventSource,
      (category.services.get(event.eventSource) ?? 0) + 1
    );
    category.principals.set(
      event.username ?? "unknown",
      (category.principals.get(event.username ?? "unknown") ?? 0) + 1
    );
  }

  let totalApiCalls = 0;
  let totalErrors = 0;
  const categories: CategoryActivity[] = [];

  for (const [categoryId, data] of categoryMap) {
    totalApiCalls += data.apiCallCount;
    totalErrors += data.errorCount;

    const topServices = Array.from(data.services.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([service, count]) => ({ service, count }));

    const principals = Array.from(data.principals.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([principal, count]) => ({ principal, count }));

    categories.push({
      categoryId,
      apiCallCount: data.apiCallCount,
      errorCount: data.errorCount,
      resourceCount: topServices.length,
      topServices,
      principals,
    });
  }

  return {
    accountId,
    dateRange: {
      start: weekAgo.toISOString(),
      end: now.toISOString(),
    },
    categories,
    totalApiCalls,
    totalErrors,
  };
}
