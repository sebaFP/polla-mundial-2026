import {
  pgTable, text, integer, boolean,
  timestamp, uuid, serial, unique,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email'),
  role: text('role').notNull().default('participant'),
  qrToken: text('qr_token').unique(),
  passwordHash: text('password_hash'),
  avatarColor: text('avatar_color'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').unique(),
  stage: text('stage').notNull(),
  groupName: text('group_name'),
  matchday: integer('matchday'),
  matchDatetime: timestamp('match_datetime', { withTimezone: true }).notNull(),
  team1: text('team1').notNull(),
  team2: text('team2').notNull(),
  team1Resolved: boolean('team1_resolved').default(false),
  team2Resolved: boolean('team2_resolved').default(false),
  venue: text('venue'),
  status: text('status').default('SCHEDULED'),
  score1: integer('score1'),
  score2: integer('score2'),
  score1Ht: integer('score1_ht'),
  score2Ht: integer('score2_ht'),
  lockTime: timestamp('lock_time', { withTimezone: true }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const predictions = pgTable('predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  matchId: integer('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  predictedScore1: integer('predicted_score1').notNull(),
  predictedScore2: integer('predicted_score2').notNull(),
  points: integer('points'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [unique().on(t.userId, t.matchId)])

export const groupPredictions = pgTable('group_predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  groupName: text('group_name').notNull(),
  firstPlace: text('first_place').notNull(),
  secondPlace: text('second_place').notNull(),
  pointsFirst: integer('points_first'),
  pointsSecond: integer('points_second'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [unique().on(t.userId, t.groupName)])

export const specialPredictions = pgTable('special_predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  teamName: text('team_name'),
  playerName: text('player_name'),
  points: integer('points'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [unique().on(t.userId, t.type)])

export const groupStandings = pgTable('group_standings', {
  id: serial('id').primaryKey(),
  groupName: text('group_name').notNull(),
  teamName: text('team_name').notNull(),
  played: integer('played').default(0),
  won: integer('won').default(0),
  drawn: integer('drawn').default(0),
  lost: integer('lost').default(0),
  goalsFor: integer('goals_for').default(0),
  goalsAgainst: integer('goals_against').default(0),
  points: integer('points').default(0),
  position: integer('position'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [unique().on(t.groupName, t.teamName)])

export const tournamentConfig = pgTable('tournament_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export type User = typeof users.$inferSelect
export type Match = typeof matches.$inferSelect
export type Prediction = typeof predictions.$inferSelect
export type GroupPrediction = typeof groupPredictions.$inferSelect
export type SpecialPrediction = typeof specialPredictions.$inferSelect
export type GroupStanding = typeof groupStandings.$inferSelect
