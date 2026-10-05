import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';

export const articles = sqliteTable('articles', {
  pmcid: text('pmcid').primaryKey(),
  title: text('title').notNull(),
  journal: text('journal').notNull(),
  published: text('published').notNull(),
  year: integer('year').notNull(),
  searchText: text('search_text').notNull(),
  metadata: text('metadata').notNull(),
  paper: text('paper'),
  state: text('state').notNull().default('pending'),
  checkedAt: integer('checked_at'),
  indexedAt: integer('indexed_at').notNull(),
}, t => [index('idx_articles_published').on(t.published), index('idx_articles_state').on(t.state)]);

export const indexState = sqliteTable('index_state', {
  id: integer('id').primaryKey(), query: text('query').notNull(), cursor: text('cursor').notNull().default('*'),
  total: integer('total').notNull().default(0), scanned: integer('scanned').notNull().default(0),
  complete: integer('complete').notNull().default(0), updatedAt: integer('updated_at').notNull(),
  leaseUntil: integer('lease_until').notNull().default(0), leaseToken: text('lease_token'),
});

export const searches = sqliteTable('searches', {
  id: text('id').primaryKey(), reader: text('reader').notNull(), filters: text('filters').notNull(),
  pmcid: text('pmcid').references(() => articles.pmcid), outcome: text('outcome').notNull(),
  message: text('message'), createdAt: integer('created_at').notNull(),
}, t => [index('idx_searches_created').on(t.createdAt, t.id), index('idx_searches_reader').on(t.reader, t.createdAt)]);

export const visits = sqliteTable('visits', {
  reader: text('reader').notNull(), pmcid: text('pmcid').notNull(), createdAt: integer('created_at').notNull(),
}, t => [primaryKey({columns: [t.reader, t.pmcid]})]);
