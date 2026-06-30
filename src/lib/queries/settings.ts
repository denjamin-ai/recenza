// KV-доступ к app_settings (singleton-флаги вида donations_enabled, §11.9). Значения — строки;
// булевы флаги кодируем как "true"/"false". Запись — upsert по первичному ключу (key).

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

export const DONATIONS_ENABLED_KEY = "donations_enabled";

/** Булев флаг по ключу. Отсутствует/не "true" → false. */
export async function getAppFlag(key: string): Promise<boolean> {
  const row = (await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key)).limit(1))[0];
  return row?.value === "true";
}

/** Upsert булева флага (исполнитель — db или tx). */
export async function setAppFlag(
  executor: Pick<typeof db, "insert">,
  key: string,
  value: boolean,
): Promise<void> {
  await executor
    .insert(appSettings)
    .values({ key, value: value ? "true" : "false" })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: value ? "true" : "false" } });
}
