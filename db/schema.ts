import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['debito', 'ahorro', 'efectivo'] }).notNull(),
  initialBalance: integer('initial_balance').notNull().default(0),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull(),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['gasto', 'ingreso'] }).notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  archivedAt: text('archived_at'),
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind', { enum: ['gasto', 'ingreso', 'transferencia'] }).notNull(),
  amount: integer('amount').notNull(),
  date: text('date').notNull(),
  accountId: integer('account_id').notNull().references(() => accounts.id),
  toAccountId: integer('to_account_id').references(() => accounts.id),
  categoryId: integer('category_id').references(() => categories.id),
  note: text('note'),
  createdAt: text('created_at').notNull(),
});

export const savingsGoals = sqliteTable('savings_goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  targetAmount: integer('target_amount').notNull(),
  accountId: integer('account_id').references(() => accounts.id),
  manualAmount: integer('manual_amount').notNull().default(0),
  targetDate: text('target_date'),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull(),
});

export const appState = sqliteTable('app_state', {
  id: integer('id').primaryKey(),
  currentStreak: integer('current_streak').notNull().default(0),
  bestStreak: integer('best_streak').notNull().default(0),
  lastLoggedDate: text('last_logged_date'),
});

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Tx = typeof transactions.$inferSelect;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
