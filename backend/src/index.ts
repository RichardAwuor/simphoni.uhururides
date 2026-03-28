import { createApplication } from "@specific-dev/framework";
import { sql, eq, or, isNull, and } from 'drizzle-orm';
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import * as profilesRoutes from './routes/profiles.js';
import * as driverRoutes from './routes/driver.js';
import * as ridesRoutes from './routes/rides.js';
import * as rideRequestsRoutes from './routes/ride-requests.js';

// Combine app schema and auth schema
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Enable authentication
app.withAuth();

// Data migration: backfill phone column from mobile_number
try {
  app.logger.info('Running phone column migration...');
  // Backfill phone from mobile_number where phone is null
  await app.db.update(appSchema.profiles)
    .set({ phone: sql`mobile_number` })
    .where(sql`phone IS NULL AND mobile_number IS NOT NULL`);

  // Backfill mobile_number from phone where mobile_number is null
  await app.db.update(appSchema.profiles)
    .set({ mobile_number: sql`phone` })
    .where(sql`mobile_number IS NULL AND phone IS NOT NULL`);

  app.logger.info('Phone column migration completed successfully');
} catch (error) {
  app.logger.warn({ err: error }, 'Phone column migration encountered an issue (may be normal if columns already synced)');
}

// Data migration: seed driver profiles with Nairobi coordinates
try {
  app.logger.info('Running driver location seeding...');

  // Get all driver profiles without coordinates
  const drivers = await app.db.query.profiles.findMany({
    where: and(
      eq(appSchema.profiles.user_type, 'driver'),
      or(
        isNull(appSchema.profiles.pickup_lat),
        isNull(appSchema.profiles.pickup_lng)
      )
    ),
  });

  const coordinates = [
    { lat: 1.2921, lng: 36.8219 },
    { lat: 1.3031, lng: 36.8100 },
    { lat: 1.2800, lng: 36.8350 },
    { lat: 1.2650, lng: 36.8000 },
  ];

  for (let i = 0; i < drivers.length; i++) {
    const coord = coordinates[i % coordinates.length];
    await app.db.update(appSchema.profiles)
      .set({
        pickup_lat: coord.lat,
        pickup_lng: coord.lng,
      })
      .where(eq(appSchema.profiles.user_id, drivers[i].user_id));
  }

  app.logger.info({ driverCount: drivers.length }, 'Driver location seeding completed');
} catch (error) {
  app.logger.warn({ err: error }, 'Driver location seeding encountered an issue (may be normal if already seeded)');
}

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
profilesRoutes.register(app, app.fastify);
driverRoutes.register(app, app.fastify);
ridesRoutes.register(app, app.fastify);
rideRequestsRoutes.register(app, app.fastify);

await app.run();
app.logger.info('Application running');
