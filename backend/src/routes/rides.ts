import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, or, desc, gte, isNull } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';
import type { App } from '../index.js';

interface CreateRideBody {
  pickup_location: string;
  dropoff_location: string;
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_lat?: number;
  dropoff_lng?: number;
  vehicle_type?: string;
  fare?: number;
}

export function register(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // Initialize sample rides on startup
  fastify.addHook('onReady', async () => {
    app.logger.info({}, 'Checking for sample rides...');
    try {
      const existingRides = await app.db.query.rides.findMany({
        where: eq(schema.rides.rider_id, 'seed-rider-001'),
      });

      if (existingRides.length === 0) {
        app.logger.info({}, 'Seeding sample rides...');
        const sampleRides = [
          {
            id: createId(),
            rider_id: 'seed-rider-001',
            pickup_location: 'Nairobi CBD',
            dropoff_location: 'Westlands',
            pickup_lat: -1.2921,
            pickup_lng: 36.8219,
            dropoff_lat: -1.2676,
            dropoff_lng: 36.8108,
            vehicle_type: 'sedan',
            fare: 350,
            status: 'pending',
          },
          {
            id: createId(),
            rider_id: 'seed-rider-001',
            pickup_location: 'Kampala Road',
            dropoff_location: 'Entebbe Airport',
            pickup_lat: 0.3163,
            pickup_lng: 32.5822,
            dropoff_lat: 0.0424,
            dropoff_lng: 32.4435,
            vehicle_type: 'suv',
            fare: 80000,
            status: 'pending',
          },
          {
            id: createId(),
            rider_id: 'seed-rider-001',
            pickup_location: 'Dar es Salaam Ferry',
            dropoff_location: 'Julius Nyerere Airport',
            pickup_lat: -6.8160,
            pickup_lng: 39.2803,
            dropoff_lat: -6.8780,
            dropoff_lng: 39.2026,
            vehicle_type: 'sedan',
            fare: 25000,
            status: 'pending',
          },
        ];

        await app.db.insert(schema.rides).values(sampleRides);
        app.logger.info({ count: sampleRides.length }, 'Sample rides seeded successfully');
      }
    } catch (error) {
      app.logger.warn({ err: error }, 'Failed to seed sample rides (may already exist)');
    }
  });

  // POST /api/rides - Create a new ride
  fastify.post('/api/rides', {
    schema: {
      description: 'Create a new ride',
      tags: ['rides'],
      body: {
        type: 'object',
        required: ['pickup_location', 'dropoff_location'],
        properties: {
          pickup_location: { type: 'string' },
          dropoff_location: { type: 'string' },
          pickup_lat: { type: 'number' },
          pickup_lng: { type: 'number' },
          dropoff_lat: { type: 'number' },
          dropoff_lng: { type: 'number' },
          vehicle_type: { type: 'string' },
          fare: { type: 'number' },
        },
      },
      response: {
        201: {
          description: 'Ride created',
          type: 'object',
          properties: {
            id: { type: 'string' },
            rider_id: { type: 'string' },
            driver_id: { type: ['string', 'null'] },
            pickup_location: { type: 'string' },
            dropoff_location: { type: 'string' },
            status: { type: 'string' },
            fare: { type: ['number', 'null'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: CreateRideBody }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { pickup_location, dropoff_location, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, vehicle_type, fare } = request.body;

    app.logger.info({ userId: session.user.id }, 'Creating ride');

    try {
      const rideId = createId();
      const [ride] = await app.db.insert(schema.rides).values({
        id: rideId,
        rider_id: session.user.id,
        pickup_location,
        dropoff_location,
        pickup_lat: pickup_lat || null,
        pickup_lng: pickup_lng || null,
        dropoff_lat: dropoff_lat || null,
        dropoff_lng: dropoff_lng || null,
        vehicle_type: vehicle_type || null,
        fare: fare || null,
        status: 'pending',
      }).returning();

      app.logger.info({ userId: session.user.id, rideId: ride.id }, 'Ride created successfully');
      return reply.status(201).send(ride);
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, body: request.body }, 'Failed to create ride');
      throw error;
    }
  });

  // GET /api/rides/my - Get authenticated user's rides as rider
  fastify.get('/api/rides/my', {
    schema: {
      description: 'Get authenticated user rides as rider',
      tags: ['rides'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              rider_id: { type: 'string' },
              driver_id: { type: ['string', 'null'] },
              pickup_location: { type: 'string' },
              dropoff_location: { type: 'string' },
              status: { type: 'string' },
              fare: { type: ['number', 'null'] },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        401: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching user rides');

    try {
      const rides = await app.db.select()
        .from(schema.rides)
        .where(eq(schema.rides.rider_id, session.user.id))
        .orderBy(desc(schema.rides.created_at));

      app.logger.info({ userId: session.user.id, count: rides.length }, 'Rides retrieved successfully');
      return rides;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch rides');
      throw error;
    }
  });

  // GET /api/rides/available - Get all pending rides (for drivers)
  fastify.get('/api/rides/available', {
    schema: {
      description: 'Get all available pending rides',
      tags: ['rides'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              rider_id: { type: 'string' },
              pickup_location: { type: 'string' },
              dropoff_location: { type: 'string' },
              pickup_lat: { type: ['number', 'null'] },
              pickup_lng: { type: ['number', 'null'] },
              dropoff_lat: { type: ['number', 'null'] },
              dropoff_lng: { type: ['number', 'null'] },
              status: { type: 'string' },
              vehicle_type: { type: ['string', 'null'] },
              fare: { type: ['number', 'null'] },
              rider_name: { type: ['string', 'null'] },
              rider_phone: { type: ['string', 'null'] },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({}, 'Fetching available rides');

    try {
      const availableRides = await app.db.select({
        id: schema.rides.id,
        rider_id: schema.rides.rider_id,
        pickup_location: schema.rides.pickup_location,
        dropoff_location: schema.rides.dropoff_location,
        pickup_lat: schema.rides.pickup_lat,
        pickup_lng: schema.rides.pickup_lng,
        dropoff_lat: schema.rides.dropoff_lat,
        dropoff_lng: schema.rides.dropoff_lng,
        status: schema.rides.status,
        vehicle_type: schema.rides.vehicle_type,
        fare: schema.rides.fare,
        rider_name: schema.profiles.full_name,
        rider_phone: schema.profiles.phone,
        created_at: schema.rides.created_at,
      })
        .from(schema.rides)
        .leftJoin(schema.profiles, eq(schema.rides.rider_id, schema.profiles.user_id))
        .where(eq(schema.rides.status, 'pending'))
        .orderBy(desc(schema.rides.created_at));

      app.logger.info({ count: availableRides.length }, 'Available rides retrieved successfully');
      return availableRides;
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to fetch available rides');
      throw error;
    }
  });

  // GET /api/rides/:id - Get a specific ride
  fastify.get('/api/rides/:id', {
    schema: {
      description: 'Get a specific ride by ID',
      tags: ['rides'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^([a-z0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$', description: 'Ride ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            rider_id: { type: 'string' },
            driver_id: { type: ['string', 'null'] },
            pickup_location: { type: 'string' },
            dropoff_location: { type: 'string' },
            pickup_lat: { type: ['number', 'null'] },
            pickup_lng: { type: ['number', 'null'] },
            dropoff_lat: { type: ['number', 'null'] },
            dropoff_lng: { type: ['number', 'null'] },
            status: { type: 'string' },
            vehicle_type: { type: ['string', 'null'] },
            fare: { type: ['number', 'null'] },
            rider_name: { type: ['string', 'null'] },
            rider_phone: { type: ['string', 'null'] },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;

    app.logger.info({ userId: session.user.id, rideId: id }, 'Fetching ride');

    try {
      const [ride] = await app.db.select({
        id: schema.rides.id,
        rider_id: schema.rides.rider_id,
        driver_id: schema.rides.driver_id,
        pickup_location: schema.rides.pickup_location,
        dropoff_location: schema.rides.dropoff_location,
        pickup_lat: schema.rides.pickup_lat,
        pickup_lng: schema.rides.pickup_lng,
        dropoff_lat: schema.rides.dropoff_lat,
        dropoff_lng: schema.rides.dropoff_lng,
        status: schema.rides.status,
        vehicle_type: schema.rides.vehicle_type,
        fare: schema.rides.fare,
        rider_name: schema.profiles.full_name,
        rider_phone: schema.profiles.phone,
        created_at: schema.rides.created_at,
        updated_at: schema.rides.updated_at,
      })
        .from(schema.rides)
        .leftJoin(schema.profiles, eq(schema.rides.rider_id, schema.profiles.user_id))
        .where(eq(schema.rides.id, id));

      if (!ride) {
        app.logger.info({ userId: session.user.id, rideId: id }, 'Ride not found');
        return reply.status(404).send({ message: 'Ride not found' });
      }

      app.logger.info({ userId: session.user.id, rideId: id }, 'Ride retrieved successfully');
      return ride;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, rideId: id }, 'Failed to fetch ride');
      throw error;
    }
  });

  // POST /api/rides/:id/accept - Driver accepts a ride
  fastify.post('/api/rides/:id/accept', {
    schema: {
      description: 'Accept a ride as driver',
      tags: ['rides'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^([a-z0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$', description: 'Ride ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            rider_id: { type: 'string' },
            driver_id: { type: 'string' },
            status: { type: 'string' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        400: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
        401: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;

    app.logger.info({ userId: session.user.id, rideId: id }, 'Accepting ride');

    try {
      const ride = await app.db.query.rides.findFirst({
        where: eq(schema.rides.id, id),
      });

      if (!ride) {
        app.logger.info({ userId: session.user.id, rideId: id }, 'Ride not found');
        return reply.status(404).send({ message: 'Ride not found' });
      }

      if (ride.status !== 'pending') {
        app.logger.warn({ userId: session.user.id, rideId: id, status: ride.status }, 'Ride is not pending');
        return reply.status(400).send({ message: 'Ride is not pending' });
      }

      const [updated] = await app.db.update(schema.rides)
        .set({
          driver_id: session.user.id,
          status: 'accepted',
          updated_at: new Date(),
        })
        .where(and(
          eq(schema.rides.id, id),
          eq(schema.rides.status, 'pending')
        ))
        .returning();

      if (!updated) {
        app.logger.warn({ userId: session.user.id, rideId: id }, 'Failed to update ride (race condition)');
        return reply.status(400).send({ message: 'Ride status changed, try again' });
      }

      app.logger.info({ userId: session.user.id, rideId: id }, 'Ride accepted successfully');
      return updated;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, rideId: id }, 'Failed to accept ride');
      throw error;
    }
  });

  // POST /api/rides/:id/complete - Complete a ride
  fastify.post('/api/rides/:id/complete', {
    schema: {
      description: 'Complete a ride',
      tags: ['rides'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^([a-z0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$', description: 'Ride ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;

    app.logger.info({ userId: session.user.id, rideId: id }, 'Completing ride');

    try {
      const ride = await app.db.query.rides.findFirst({
        where: eq(schema.rides.id, id),
      });

      if (!ride) {
        app.logger.info({ userId: session.user.id, rideId: id }, 'Ride not found');
        return reply.status(404).send({ message: 'Ride not found' });
      }

      if (ride.rider_id !== session.user.id && ride.driver_id !== session.user.id) {
        app.logger.warn({ userId: session.user.id, rideId: id }, 'User is not rider or driver');
        return reply.status(401).send({ message: 'Unauthorized' });
      }

      const [updated] = await app.db.update(schema.rides)
        .set({
          status: 'completed',
          updated_at: new Date(),
        })
        .where(eq(schema.rides.id, id))
        .returning();

      app.logger.info({ userId: session.user.id, rideId: id }, 'Ride completed successfully');
      return updated;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, rideId: id }, 'Failed to complete ride');
      throw error;
    }
  });

  // POST /api/rides/:id/cancel - Cancel a ride
  fastify.post('/api/rides/:id/cancel', {
    schema: {
      description: 'Cancel a ride',
      tags: ['rides'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^([a-z0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$', description: 'Ride ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        400: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
        401: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;

    app.logger.info({ userId: session.user.id, rideId: id }, 'Cancelling ride');

    try {
      const ride = await app.db.query.rides.findFirst({
        where: eq(schema.rides.id, id),
      });

      if (!ride) {
        app.logger.info({ userId: session.user.id, rideId: id }, 'Ride not found');
        return reply.status(404).send({ message: 'Ride not found' });
      }

      if (ride.rider_id !== session.user.id && ride.driver_id !== session.user.id) {
        app.logger.warn({ userId: session.user.id, rideId: id }, 'User is not rider or driver');
        return reply.status(401).send({ message: 'Unauthorized' });
      }

      if (ride.status !== 'pending' && ride.status !== 'accepted') {
        app.logger.warn({ userId: session.user.id, rideId: id, status: ride.status }, 'Cannot cancel ride in current status');
        return reply.status(400).send({ message: 'Can only cancel pending or accepted rides' });
      }

      const [updated] = await app.db.update(schema.rides)
        .set({
          status: 'cancelled',
          updated_at: new Date(),
        })
        .where(eq(schema.rides.id, id))
        .returning();

      app.logger.info({ userId: session.user.id, rideId: id }, 'Ride cancelled successfully');
      return updated;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, rideId: id }, 'Failed to cancel ride');
      throw error;
    }
  });
}
