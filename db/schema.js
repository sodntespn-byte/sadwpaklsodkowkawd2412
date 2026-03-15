/**
 * Liberty — Schema Drizzle (PostgreSQL / Neon)
 * Tabelas: users, servers, chats, chat_members, messages
 */

import { pgTable, uuid, varchar, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', { length: 32 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('idx_users_email').on(table.email), index('idx_users_username').on(table.username)]
);

export const servers = pgTable('servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const chats = pgTable(
  'chats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }),
    type: varchar('type', { length: 20 }).notNull().default('channel'),
    serverId: uuid('server_id').references(() => servers.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('idx_chats_server').on(table.serverId), index('idx_chats_type').on(table.type)]
);

export const chatMembers = pgTable(
  'chat_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('idx_chat_members_chat').on(table.chatId),
    index('idx_chat_members_user').on(table.userId),
    uniqueIndex('chat_members_chat_id_user_id_unique').on(table.chatId, table.userId),
  ]
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('idx_messages_chat').on(table.chatId),
    index('idx_messages_created').on(table.chatId, table.createdAt),
  ]
);
