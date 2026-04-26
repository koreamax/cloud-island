import type { IslandData } from "@/shared/cloud/cloud-island";

type RuntimeConfig = {
  apiBaseUrl?: string;
};

let runtimeConfigPromise: Promise<RuntimeConfig> | null = null;

async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch("/runtime-config.json", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          return {};
        }
        return (await response.json()) as RuntimeConfig;
      })
      .catch(() => ({}));
  }

  return runtimeConfigPromise;
}

async function getApiBaseUrl(): Promise<string> {
  const envValue = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (envValue) {
    return envValue.replace(/\/+$/, "");
  }

  const runtimeConfig = await loadRuntimeConfig();
  if (runtimeConfig.apiBaseUrl?.trim()) {
    return runtimeConfig.apiBaseUrl.trim().replace(/\/+$/, "");
  }

  throw new Error(
    "API base URL is not configured. Set NEXT_PUBLIC_API_BASE_URL or deploy runtime-config.json."
  );
}

export async function syncIsland(roleArn: string): Promise<IslandData> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roleArn }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(error?.error || "Failed to sync AWS data");
  }

  return (await response.json()) as IslandData;
}
