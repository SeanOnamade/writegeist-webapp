import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

const dbFile = `${process.cwd()}/writegeist.db`;
const database = new Database(dbFile);
export const db = drizzle(database);

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const chapters = sqliteTable('chapters', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  text: text('text').notNull(),
  characters: text('characters').notNull(), // JSON array string
  locations: text('locations').notNull(), // JSON array string
  pov: text('pov').notNull(), // JSON array string
  order: integer('order').default(0), // For drag-and-drop reordering
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const projectPages = sqliteTable('project_pages', {
  id: integer('id').primaryKey(),
  markdown: text('markdown').notNull(),
});

export const chapterAudio = sqliteTable('chapter_audio', {
  id: text('id').primaryKey(),
  chapterId: text('chapter_id').notNull(),
  audioUrl: text('audio_url'),
  duration: integer('duration'), // Duration in seconds
  status: text('status').default('pending'), // pending, processing, completed, error
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
});

// Create tables if they don't exist
database.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  
  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    characters TEXT NOT NULL,
    locations TEXT NOT NULL,
    pov TEXT NOT NULL,
    "order" INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS project_pages (
    id INTEGER PRIMARY KEY,
    markdown TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chapter_audio (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    audio_url TEXT,
    duration INTEGER,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
  );
`);

// Migration: Add order column to existing chapters if it doesn't exist
try {
  // Check if order column exists
  const columnInfo = database.prepare("PRAGMA table_info(chapters)").all();
  const hasOrderColumn = columnInfo.some((col: any) => col.name === 'order');
  
  if (!hasOrderColumn) {
    console.log('Adding order column to chapters table...');
    database.exec('ALTER TABLE chapters ADD COLUMN "order" INTEGER DEFAULT 0');
    
    // Set order values for existing chapters based on created_at
    database.exec(`
      UPDATE chapters 
      SET "order" = (
        SELECT ROW_NUMBER() OVER (ORDER BY created_at) - 1
        FROM chapters c2 
        WHERE c2.id = chapters.id
      )
    `);
    
    console.log('Order column added and populated successfully');
  }
} catch (error) {
  console.error('Error during migration:', error);
} 