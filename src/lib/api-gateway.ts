import type {
  IslandData,
  MultiplayerPlayerState,
  SavedIslandSummary,
} from "@/shared/cloud/cloud-island";

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

export async function fetchSavedIslands(): Promise<SavedIslandSummary[]> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/islands`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(error?.error || "Failed to load saved islands");
  }

  const payload = (await response.json()) as { islands?: SavedIslandSummary[] };
  return payload.islands ?? [];
}

export async function fetchActivePlayers(): Promise<MultiplayerPlayerState[]> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/players`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(error?.error || "Failed to load active players");
  }

  const payload = (await response.json()) as {
    players?: MultiplayerPlayerState[];
  };
  return payload.players ?? [];
}

export async function updatePlayerPresence(
  player: Omit<MultiplayerPlayerState, "updatedAt">
): Promise<MultiplayerPlayerState> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(player),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(error?.error || "Failed to update player presence");
  }

  const payload = (await response.json()) as {
    player?: MultiplayerPlayerState;
  };
  if (!payload.player) {
    throw new Error("Player presence response is missing player");
  }

  return payload.player;
}
