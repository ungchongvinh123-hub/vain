import { sql } from 'drizzle-orm';
import {
  pgTable, serial, integer, text, timestamp, jsonb, primaryKey, smallint, boolean, bigint,
} from 'drizzle-orm/pg-core';

export const players = pgTable('players', {
  id: serial('id').primaryKey(),
  saveKey: text('save_key').notNull().unique(),
  name: text('name').notNull().default('Chủ Nhân'),
  gold: integer('gold').notNull().default(1500),
  gem: integer('gem').notNull().default(1000),
  pity: integer('pity').notNull().default(0),
  pullCount: integer('pull_count').notNull().default(0),
  sinceSr: integer('since_sr').notNull().default(0),
  stageProgress: integer('stage_progress').notNull().default(1),
  bestRound: integer('best_round').notNull().default(0),
  team: jsonb('team').notNull().default(sql`'[]'::jsonb`), // (number|null)[] of character instance ids
  purchases: jsonb('purchases').notNull().default(sql`'{}'::jsonb`), // shopId -> count
  settings: jsonb('settings').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Every gacha copy is an independent row — duplicates are NEVER merged. */
export const characters = pgTable('characters', {
  instanceId: serial('instance_id').primaryKey(),
  playerId: integer('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  charId: text('char_id').notNull(),
  level: smallint('level').notNull().default(1),
  exp: integer('exp').notNull().default(0),
  sp: integer('sp').notNull().default(0),
  skillLevels: jsonb('skill_levels').notNull().default(sql`'{}'::jsonb`),
  loadout: jsonb('loadout').notNull().default(sql`'[]'::jsonb`),
  weapon: integer('weapon'),
  armor: integer('armor'),
  accessory: integer('accessory'),
  locked: boolean('locked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gears = pgTable('gears', {
  instanceId: serial('instance_id').primaryKey(),
  playerId: integer('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  gearId: text('gear_id').notNull(),
  plus: smallint('plus').notNull().default(0),
  equippedBy: integer('equipped_by'),
  locked: boolean('locked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pulls = pgTable('pulls', {
  id: serial('id').primaryKey(),
  playerId: integer('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // 'single' | 'ten'
  result: jsonb('result').notNull(), // [{charId, rarity, instanceId, isNew}]
  cost: integer('cost').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stageRuns = pgTable('stage_runs', {
  id: serial('id').primaryKey(),
  playerId: integer('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  stageId: smallint('stage_id').notNull(),
  win: boolean('win').notNull(),
  rounds: smallint('rounds').notNull().default(0),
  totalDamage: integer('total_damage').notNull().default(0),
  kills: smallint('kills').notNull().default(0),
  firstClear: boolean('first_clear').notNull().default(false),
  gold: integer('gold').notNull().default(0),
  gem: integer('gem').notNull().default(0),
  exp: jsonb('exp').notNull().default(sql`'{}'::jsonb`),   // instanceId -> exp
  sp: jsonb('sp').notNull().default(sql`'{}'::jsonb`),     // instanceId -> sp
  drops: jsonb('drops').notNull().default(sql`'[]'::jsonb`), // [gearId]
  seed: bigint('seed', { mode: 'number' }).notNull().default(0),
  durationMs: integer('duration_ms').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gachaHistory = pgTable('gacha_history', {
  id: serial('id').primaryKey(),
  playerId: integer('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  charId: text('char_id').notNull(),
  rarity: text('rarity').notNull(),
  isNew: boolean('is_new').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** static content mirror: lets SQL queries / analytics work on the roster + gear */
export const charDefs = pgTable('char_defs', {
  charId: text('char_id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  element: text('element').notNull(),
  rarity: text('rarity').notNull(),
  payload: jsonb('payload').notNull(),
});

export const gearDefs = pgTable('gear_defs', {
  gearId: text('gear_id').primaryKey(),
  name: text('name').notNull(),
  slot: text('slot').notNull(),
  rarity: text('rarity').notNull(),
  payload: jsonb('payload').notNull(),
});

export type Player = typeof players.$inferSelect;
export type CharacterRow = typeof characters.$inferSelect;
export type GearRow = typeof gears.$inferSelect;
