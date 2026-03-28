import { pgTable, text, timestamp, boolean, integer, real, pgEnum } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

// Enums
export const userTypeEnum = pgEnum('user_type', ['driver', 'rider']);
export const countryEnum = pgEnum('country', ['kenya', 'tanzania', 'uganda']);
export const languageEnum = pgEnum('language', ['english', 'swahili', 'luganda']);
export const carMakeEnum = pgEnum('car_make', ['Toyota', 'Nissan', 'Ford', 'Mercedes', 'Volkswagen', 'Others']);
export const currencyEnum = pgEnum('currency', ['KES', 'TZS', 'UGX', 'USD']);
export const rideStatusEnum = pgEnum('ride_status', ['pending', 'bargaining', 'accepted', 'rejected', 'cancelled', 'completed']);
export const bargainStatusEnum = pgEnum('bargain_status', ['pending', 'accepted', 'rejected']);

// Profiles table
export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  user_type: userTypeEnum('user_type').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  resident_district: text('resident_district').notNull(),
  mobile_number: text('mobile_number'),
  country: countryEnum('country').notNull(),
  language: languageEnum('language').notNull(),
  profile_picture_url: text('profile_picture_url'),
  full_name: text('full_name'),
  phone: text('phone'),
  role: text('role'),
  vehicle_make: text('vehicle_make'),
  vehicle_model: text('vehicle_model'),
  license_plate: text('license_plate'),
  national_id: text('national_id'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Driver details table
export const driver_details = pgTable('driver_details', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  car_make: carMakeEnum('car_make').notNull(),
  car_registration: text('car_registration').notNull(),
  car_color: text('car_color').notNull(),
  is_available: boolean('is_available').notNull().default(true),
  license_number: text('license_number'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Ride requests table
export const ride_requests = pgTable('ride_requests', {
  id: text('id').primaryKey(),
  rider_id: text('rider_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  rider_name: text('rider_name'),
  driver_id: text('driver_id').references(() => user.id, { onDelete: 'set null' }),
  pickup_location: text('pickup_location').notNull(),
  pickup_address: text('pickup_address'),
  pickup_lat: real('pickup_lat'),
  pickup_lng: real('pickup_lng'),
  destination: text('destination').notNull(),
  destination_address: text('destination_address'),
  destination_lat: real('destination_lat'),
  destination_lng: real('destination_lng'),
  distance_km: real('distance_km'),
  price_offer: real('price_offer').notNull(),
  currency: currencyEnum('currency').notNull(),
  bargain_price: real('bargain_price'),
  bargain_percent: integer('bargain_percent'),
  bargain_multiplier: real('bargain_multiplier'),
  status: rideStatusEnum('status').notNull().default('pending'),
  assigned_driver_id: text('assigned_driver_id').references(() => user.id, { onDelete: 'set null' }),
  current_driver_id: text('current_driver_id').references(() => user.id, { onDelete: 'set null' }),
  routing_count: integer('routing_count').notNull().default(0),
  routed_driver_ids: text('routed_driver_ids').notNull().default(''),
  rider_phone: text('rider_phone'),
  driver_attempt_count: integer('driver_attempt_count').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Driver ride actions table
export const driver_ride_actions = pgTable('driver_ride_actions', {
  id: text('id').primaryKey(),
  ride_request_id: text('ride_request_id').notNull().references(() => ride_requests.id, { onDelete: 'cascade' }),
  driver_id: text('driver_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  bargain_multiplier: real('bargain_multiplier'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Driver status table
export const driver_status = pgTable('driver_status', {
  id: text('id').primaryKey(),
  driver_id: text('driver_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  is_muted: boolean('is_muted').notNull().default(false),
  is_available: boolean('is_available').notNull().default(true),
  current_lat: real('current_lat'),
  current_lng: real('current_lng'),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Ride bargains table
export const ride_bargains = pgTable('ride_bargains', {
  id: text('id').primaryKey(),
  ride_request_id: text('ride_request_id').notNull().references(() => ride_requests.id, { onDelete: 'cascade' }),
  driver_id: text('driver_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  bargain_percentage: integer('bargain_percentage').notNull(),
  bargain_price: real('bargain_price').notNull(),
  status: bargainStatusEnum('status').notNull().default('pending'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Ride history table
export const ride_history = pgTable('ride_history', {
  id: text('id').primaryKey(),
  ride_request_id: text('ride_request_id').notNull().references(() => ride_requests.id, { onDelete: 'cascade' }),
  driver_id: text('driver_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  rider_id: text('rider_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  price_final: real('price_final').notNull(),
  currency: currencyEnum('currency').notNull(),
  distance_km: real('distance_km'),
  completed_at: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
});

// Rides table
export const rides = pgTable('rides', {
  id: text('id').primaryKey(),
  rider_id: text('rider_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  driver_id: text('driver_id').references(() => user.id, { onDelete: 'set null' }),
  pickup_location: text('pickup_location').notNull(),
  dropoff_location: text('dropoff_location').notNull(),
  pickup_lat: real('pickup_lat'),
  pickup_lng: real('pickup_lng'),
  dropoff_lat: real('dropoff_lat'),
  dropoff_lng: real('dropoff_lng'),
  status: text('status').notNull().default('pending'),
  vehicle_type: text('vehicle_type'),
  fare: real('fare'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
