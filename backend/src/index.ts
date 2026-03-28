import { createApplication } from "@specific-dev/framework";
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

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
profilesRoutes.register(app, app.fastify);
driverRoutes.register(app, app.fastify);
ridesRoutes.register(app, app.fastify);
rideRequestsRoutes.register(app, app.fastify);

await app.run();
app.logger.info('Application running');
