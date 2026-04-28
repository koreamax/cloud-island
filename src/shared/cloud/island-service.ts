import type { IslandData } from "./cloud-island";
import { MOCK_ISLAND_DATA, generateRandomIslandData } from "./mock-data";

export function getIslandDataByAccountId(accountId: string): IslandData {
  return accountId === "123456789012"
    ? MOCK_ISLAND_DATA
    : generateRandomIslandData(accountId);
}
