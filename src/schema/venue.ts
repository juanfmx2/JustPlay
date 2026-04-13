import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

import { addresses } from './address'
import { competitions } from './competition'

type GeoLocation = {
  latitude: number
  longitude: number
}

export const venues = pgTable('venues', {
  id: serial('id').primaryKey(),
  addressId: integer('address_id').references(() => addresses.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  description: text('description'),
  invoiceNum: text('invoice_num'),
  location: jsonb('location').$type<GeoLocation>(),
})

export const venueBookings = pgTable('venue_bookings', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id')
    .notNull()
    .references(() => competitions.id, { onDelete: 'cascade' }),
  venueId: integer('venue_id')
    .notNull()
    .references(() => venues.id, { onDelete: 'cascade' }),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
})

export const courts = pgTable('courts', {
  id: serial('id').primaryKey(),
  venueId: integer('venue_id')
    .notNull()
    .references(() => venues.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
})