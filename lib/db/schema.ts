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
  competitionId:   integer('competition_id').default(2000),
  competitionCode: text('competition_code').default('WC'),
  competitionName: text('competition_name').default('FIFA World Cup'),
  competitionEmblem: text('competition_emblem'),
  competitionArea: text('competition_area').default('World'),
})

export const pollaMembers = pgTable('polla_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  pollaId: uuid('polla_id').notNull().references(() => pollas.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('participant'), // 'admin' | 'participant'
  inscriptionStatus: text('inscription_status').notNull().default('pending'), // pending|confirmed|approved|rejected
  inscriptionNotes: text('inscription_notes'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  predictionUnlocked: boolean('prediction_unlocked').default(false).notNull(),
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
  competitionId: integer('competition_id').default(2000),
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
  score1Penalties: integer('score1_penalties'),
  score2Penalties: integer('score2_penalties'),
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
  thirdPlace: text('third_place'),
  pointsFirst: integer('points_first'),
  pointsSecond: integer('points_second'),
  pointsThird: integer('points_third'),
  isManualOverride: boolean('is_manual_override').default(false).notNull(),
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

// Admin-locked group standings — overrides computed 1st/2nd/3rd for scoring purposes
export const groupStandingLocks = pgTable('group_standing_locks', {
  id: serial('id').primaryKey(),
  groupName: text('group_name').notNull().unique(),
  firstPlace: text('first_place').notNull(),
  secondPlace: text('second_place').notNull(),
  thirdPlace: text('third_place'),
  lockedAt: timestamp('locked_at').defaultNow(),
  lockedBy: uuid('locked_by').references(() => users.id),
})

// Per-polla manual result overrides — takes precedence over API scores for that polla
export const pollaResultOverrides = pgTable('polla_result_overrides', {
  id: serial('id').primaryKey(),
  pollaId: uuid('polla_id').notNull().references(() => pollas.id, { onDelete: 'cascade' }),
  matchId: integer('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  score1: integer('score1').notNull(),
  score2: integer('score2').notNull(),
  score1Penalties: integer('score1_penalties'),
  score2Penalties: integer('score2_penalties'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [unique().on(t.pollaId, t.matchId)])

// Per-polla config (scoring rules, prize pool, etc.)
export const tournamentConfig = pgTable('tournament_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  pollaId: uuid('polla_id').references(() => pollas.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value').notNull(),
}, (t) => [unique().on(t.pollaId, t.key)])

export const pollaQuestions = pgTable('polla_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  pollaId: uuid('polla_id').notNull().references(() => pollas.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'team' | 'player' | 'range'
  pointsValue: integer('points_value').default(5),
  correctAnswer: text('correct_answer'),
  enabled: boolean('enabled').default(true).notNull(),
  order: integer('order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const pollaQuestionOptions = pgTable('polla_question_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').notNull().references(() => pollaQuestions.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  points: integer('points').default(3).notNull(),
  isCorrect: boolean('is_correct').default(false).notNull(),
  order: integer('order').default(0).notNull(),
})

export const pollaAnswers = pgTable('polla_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pollaId: uuid('polla_id').notNull().references(() => pollas.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => pollaQuestions.id, { onDelete: 'cascade' }),
  answer: text('answer'),
  optionId: uuid('option_id').references(() => pollaQuestionOptions.id, { onDelete: 'set null' }),
  points: integer('points'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [unique().on(t.userId, t.questionId, t.pollaId)])

export const passwordResetRequests = pgTable('password_reset_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'resolved'
  createdAt: timestamp('created_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  resolvedById: uuid('resolved_by_id').references(() => users.id),
})

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: uuid('token').notNull().unique().defaultRandom(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at').defaultNow(),
})

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
export type PollaResultOverride = typeof pollaResultOverrides.$inferSelect
export type PollaQuestion = typeof pollaQuestions.$inferSelect
export type PollaQuestionOption = typeof pollaQuestionOptions.$inferSelect
export type PollaAnswer = typeof pollaAnswers.$inferSelect
export type GroupStandingLock = typeof groupStandingLocks.$inferSelect

// Open self-registration links — no user pre-assigned; anyone with the link can register
export const pollaInviteLinks = pgTable('polla_invite_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  pollaId: uuid('polla_id').notNull().references(() => pollas.id, { onDelete: 'cascade' }),
  token: uuid('token').notNull().unique().defaultRandom(),
  label: text('label'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
})
export type PollaInviteLink = typeof pollaInviteLinks.$inferSelect
