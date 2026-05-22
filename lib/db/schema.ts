import {
  pgTable, text, integer, boolean,
  timestamp, uuid, serial, unique,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // matches auth.users.id from Supabase Auth — never auto-generated
  name: text('name').notNull(),
  email: text('email'),
  avatarColor: text('avatar_color'),
  isSuperAdmin: boolean('is_super_admin').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const pollas = pgTable('pollas', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
})

export const pollaMembers = pgTable('polla_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  pollaId: uuid('polla_id').notNull().references(() => pollas.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('participant'), // 'admin' | 'participant'
  inscriptionStatus: text('inscription_status').notNull().default('pending'), // pending|confirmed|approved|rejected
  inscriptionNotes: text('inscription_notes'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (t) => [unique().on(t.pollaId, t.userId)])

// QR invitation tokens — scoped per polla
export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pollaId: uuid('polla_id').references(() => pollas.id, { onDelete: 'cascade' }),
  token: uuid('token').notNull().unique().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow(),
  usedAt: timestamp('used_at'),
  expiresAt: timestamp('expires_at'),
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
  pollaId: uuid('polla_id').references(() => pollas.id, { onDelete: 'cascade' }),
  matchId: integer('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  predictedScore1: integer('predicted_score1').notNull(),
  predictedScore2: integer('predicted_score2').notNull(),
  points: integer('points'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [unique().on(t.userId, t.matchId, t.pollaId)])

export const groupPredictions = pgTable('group_predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pollaId: uuid('polla_id').references(() => pollas.id, { onDelete: 'cascade' }),
  groupName: text('group_name').notNull(),
  firstPlace: text('first_place').notNull(),
  secondPlace: text('second_place').notNull(),
  pointsFirst: integer('points_first'),
  pointsSecond: integer('points_second'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [unique().on(t.userId, t.groupName, t.pollaId)])

export const specialPredictions = pgTable('special_predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pollaId: uuid('polla_id').references(() => pollas.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  teamName: text('team_name'),
  playerName: text('player_name'),
  points: integer('points'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [unique().on(t.userId, t.type, t.pollaId)])

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

// Per-polla config (scoring rules, prize pool, etc.)
export const tournamentConfig = pgTable('tournament_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  pollaId: uuid('polla_id').references(() => pollas.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value').notNull(),
}, (t) => [unique().on(t.pollaId, t.key)])

export type User = typeof users.$inferSelect
export type Polla = typeof pollas.$inferSelect
export type PollaMember = typeof pollaMembers.$inferSelect
export type Invitation = typeof invitations.$inferSelect
export type Match = typeof matches.$inferSelect
export type Prediction = typeof predictions.$inferSelect
export type GroupPrediction = typeof groupPredictions.$inferSelect
export type SpecialPrediction = typeof specialPredictions.$inferSelect
export type GroupStanding = typeof groupStandings.$inferSelect
export type TournamentConfig = typeof tournamentConfig.$inferSelect
