import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

const dbFile = `${process.cwd()}/writegeist.db`;
export const db = drizzle(new Database(dbFile));

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
}); 