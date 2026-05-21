import { revalidatePath, revalidateTag } from 'next/cache';
import { inArray } from 'drizzle-orm';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import { config } from '@/config/db/schema';
import { locales } from '@/config/locale';
import {
  ALLOWED_CONTENT_CONFIG_KEYS,
  type ContentConfigKey,
  type ContentConfigValues,
} from '@/shared/lib/content-config';

import { CACHE_TAG_CONFIGS } from './config';

function assertAllowedContentConfigKey(
  key: string
): asserts key is ContentConfigKey {
  if (!ALLOWED_CONTENT_CONFIG_KEYS.includes(key as ContentConfigKey)) {
    throw new Error(`unsupported content config key: ${key}`);
  }
}

function revalidateContentPaths() {
  revalidateTag(CACHE_TAG_CONFIGS, 'max');

  const basePaths = ['/', '/chatgpt-mirror', '/upgrade'];
  const localizedPaths = locales.flatMap((locale) => [
    `/${locale}`,
    `/${locale}/chatgpt-mirror`,
    `/${locale}/upgrade`,
  ]);

  for (const path of Array.from(new Set([...basePaths, ...localizedPaths]))) {
    revalidatePath(path);
  }
}

async function readContentConfigValues(): Promise<ContentConfigValues> {
  const values: ContentConfigValues = {};

  const rows = await db()
    .select()
    .from(config)
    .where(inArray(config.name, [...ALLOWED_CONTENT_CONFIG_KEYS]));

  for (const row of rows) {
    const name = String(row.name);
    assertAllowedContentConfigKey(name);
    values[name] = row.value || '';
  }

  return values;
}

export async function getContentConfigValues(): Promise<ContentConfigValues> {
  if (!envConfigs.database_url) {
    return {};
  }

  try {
    return await readContentConfigValues();
  } catch (error) {
    console.warn(
      '[content-config] failed to read content config:',
      error instanceof Error ? error.message : error
    );
    return {};
  }
}

export async function getContentConfigValuesStrict(): Promise<ContentConfigValues> {
  if (!envConfigs.database_url) {
    throw new Error('后台内容配置需要数据库连接');
  }

  return readContentConfigValues();
}

export async function saveContentConfigValues(values: ContentConfigValues) {
  const entries = Object.entries(values);

  for (const [key, value] of entries) {
    assertAllowedContentConfigKey(key);
    if (value.length > 60000) {
      throw new Error(`${key} is too large`);
    }
  }

  if (!entries.length) {
    return [];
  }

  const result = await db().transaction(async (tx: any) => {
    const results: any[] = [];

    for (const [name, value] of entries) {
      const [upsertResult] = await tx
        .insert(config)
        .values({ name, value })
        .onConflictDoUpdate({
          target: config.name,
          set: { value },
        })
        .returning();

      results.push(upsertResult);
    }

    return results;
  });

  revalidateContentPaths();

  return result;
}
