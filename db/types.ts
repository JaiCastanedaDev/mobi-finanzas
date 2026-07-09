import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema';

export type DB = BaseSQLiteDatabase<'sync', any, typeof schema>;
