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

export type Venue = typeof venues.$inferSelect
export type NewVenue = typeof venues.$inferInsert

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

export type VenueBooking = typeof venueBookings.$inferSelect
export type NewVenueBooking = typeof venueBookings.$inferInsert

export const courts = pgTable('courts', {
  id: serial('id').primaryKey(),
  venueId: integer('venue_id')
    .notNull()
    .references(() => venues.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
})

export type Court = typeof courts.$inferSelect
export type NewCourt = typeof courts.$inferInsert

export type CourtWithVenue = Court & {
  venue?: Pick<Venue, 'name'> | null
}

export function getCourtAndVenue(court: CourtWithVenue | null | undefined): string {
  if (!court) return 'TBD'
  if (court.venue?.name) return `${court.venue.name} - ${court.name}`
  return court.name
}