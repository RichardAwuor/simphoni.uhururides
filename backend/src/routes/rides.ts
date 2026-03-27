import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

interface CreateRideBody {
  pickup_location: string;
  pickup_lat?: number;
  pickup_lng?: number;
  destination: string;
  price_offer: number;
  currency: 'KES' | 'TZS' | 'UGX';
}

interface BargainBody {
  bargain_percentage: 10 | 25 | 50;
}

interface BargainResponseBody {
  accept: boolean;
}

interface CompleteRideBody {
  distance_km?: number;
}

export function register(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // POST /api/rides - Create a new ride request
  fastify.post('/api/rides', {
    schema: {
      description: 'Create a new ride request',
      tags: ['rides'],
      body: {
        type: 'object',
        required: ['pickup_location', 'destination', 'price_offer', 'currency'],
        properties: {
          pickup_location: { type: 'string' },
          pickup_lat: { type: 'number' },
          pickup_lng: { type: 'number' },
          destination: { type: 'string' },
          price_offer: { type: 'number' },
          currency: { type: 'string', enum: ['KES', 'TZS', 'UGX'] },
        },
      },
      response: {
        201: {
          description: 'Ride request created',
          type: 'object',
          properties: {
            id: { type: 'string' },
            rider_id: { type: 'string' },
            pickup_location: { type: 'string' },
            pickup_lat: { type: ['number', 'null'] },
            pickup_lng: { type: ['number', 'null'] },
            destination: { type: 'string' },
            price_offer: { type: 'number' },
            currency: { type: 'string' },
            status: { type: 'string' },
            assigned_driver_id: { type: ['string', 'null'] },
            driver_attempt_count: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: CreateRideBody }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { pickup_location, pickup_lat, pickup_lng, destination, price_offer, currency } = request.body;

    app.logger.info({ userId: session.user.id }, 'Creating ride request');

    try {
      const rideId = createId();
      const [ride] = await app.db.insert(schema.ride_requests).values({
        id: rideId,
        rider_id: session.user.id,
        pickup_location,
        pickup_lat: pickup_lat || null,
        pickup_lng: pickup_lng || null,
        destination,
        price_offer,
        currency,
        status: 'pending',
        driver_attempt_count: 0,
      }).returning();

      app.logger.info({ userId: session.user.id, rideId: ride.id }, 'Ride request created successfully');
      return reply.status(201).send(ride);
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, body: request.body }, 'Failed to create ride');
      throw error;
    }
  });

  // GET /api/rides/my-requests - Get all ride requests for current rider
  fastify.get('/api/rides/my-requests', {
    schema: {
      description: 'Get all ride requests for current user',
      tags: ['rides'],
      response: {
        200: {
          description: 'List of ride requests',
          type: 'object',
          properties: {
            requests: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  rider_id: { type: 'string' },
                  pickup_location: { type: 'string' },
                  pickup_lat: { type: ['number', 'null'] },
                  pickup_lng: { type: ['number', 'null'] },
                  destination: { type: 'string' },
                  price_offer: { type: 'number' },
                  currency: { type: 'string' },
                  status: { type: 'string' },
                  assigned_driver_id: { type: ['string', 'null'] },
                  driver_attempt_count: { type: 'integer' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching user ride requests');

    try {
      const requests = await app.db.select()
        .from(schema.ride_requests)
        .where(eq(schema.ride_requests.rider_id, session.user.id))
        .orderBy(desc(schema.ride_requests.created_at));

      app.logger.info({ userId: session.user.id, count: requests.length }, 'Ride requests retrieved successfully');
      return { requests };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch ride requests');
      throw error;
    }
  });

  // GET /api/rides/history - Get ride history for current user
  fastify.get('/api/rides/history', {
    schema: {
      description: 'Get ride history for current user',
      tags: ['rides'],
      querystring: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Filter by date (YYYY-MM-DD)' },
        },
      },
      response: {
        200: {
          description: 'Ride history',
          type: 'object',
          properties: {
            history: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  ride_request_id: { type: 'string' },
                  driver_id: { type: 'string' },
                  rider_id: { type: 'string' },
                  price_final: { type: 'number' },
                  currency: { type: 'string' },
                  distance_km: { type: ['number', 'null'] },
                  completed_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Querystring: { date?: string } }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, date: request.query.date }, 'Fetching ride history');

    try {
      // Get user's profile to determine user type
      const profile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, session.user.id),
      });

      if (!profile) {
        app.logger.info({ userId: session.user.id }, 'Profile not found for history');
        return reply.status(404).send({ error: 'Profile not found' });
      }

      // Query based on user type
      let allHistory;
      if (profile.user_type === 'driver') {
        allHistory = await app.db.select()
          .from(schema.ride_history)
          .where(eq(schema.ride_history.driver_id, session.user.id));
      } else {
        allHistory = await app.db.select()
          .from(schema.ride_history)
          .where(eq(schema.ride_history.rider_id, session.user.id));
      }

      // Filter by date if provided
      let history = allHistory;
      if (request.query.date) {
        const startDate = new Date(request.query.date);
        const endDate = new Date(request.query.date);
        endDate.setDate(endDate.getDate() + 1);

        history = allHistory.filter((h) => {
          const completedDate = new Date(h.completed_at);
          return completedDate >= startDate && completedDate < endDate;
        });
      }

      app.logger.info({ userId: session.user.id, count: history.length }, 'Ride history retrieved successfully');
      return { history };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, date: request.query.date }, 'Failed to fetch ride history');
      throw error;
    }
  });

  // GET /api/rides/:id - Get a specific ride request
  fastify.get('/api/rides/:id', {
    schema: {
      description: 'Get a ride request by ID',
      tags: ['rides'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Ride request ID' },
        },
      },
      response: {
        200: {
          description: 'Ride request',
          type: 'object',
          properties: {
            id: { type: 'string' },
            rider_id: { type: 'string' },
            pickup_location: { type: 'string' },
            pickup_lat: { type: ['number', 'null'] },
            pickup_lng: { type: ['number', 'null'] },
            destination: { type: 'string' },
            price_offer: { type: 'number' },
            currency: { type: 'string' },
            status: { type: 'string' },
            assigned_driver_id: { type: ['string', 'null'] },
            driver_attempt_count: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
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

    app.logger.info({ userId: session.user.id, rideId: id }, 'Fetching ride request');

    try {
      const ride = await app.db.query.ride_requests.findFirst({
        where: eq(schema.ride_requests.id, id),
      });

      if (!ride) {
        app.logger.info({ userId: session.user.id, rideId: id }, 'Ride request not found');
        return reply.status(404).send({ error: 'Ride request not found' });
      }

      app.logger.info({ userId: session.user.id, rideId: id }, 'Ride request retrieved successfully');
      return ride;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, rideId: id }, 'Failed to fetch ride request');
      throw error;
    }
  });

  // POST /api/rides/:id/accept - Accept a ride request (driver)
  fastify.post('/api/rides/:id/accept', {
    schema: {
      description: 'Accept a ride request as driver',
      tags: ['rides'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Ride request ID' },
        },
      },
      response: {
        200: {
          description: 'Ride accepted',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            rider_phone: { type: 'string' },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
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

    app.logger.info({ userId: session.user.id, rideId: id }, 'Accepting ride request');

    try {
      const ride = await app.db.query.ride_requests.findFirst({
        where: eq(schema.ride_requests.id, id),
      });

      if (!ride) {
        app.logger.info({ userId: session.user.id, rideId: id }, 'Ride request not found');
        return reply.status(404).send({ error: 'Ride request not found' });
      }

      // Update ride status and assign driver
      await app.db.update(schema.ride_requests)
        .set({
          status: 'accepted',
          assigned_driver_id: session.user.id,
          updated_at: new Date(),
        })
        .where(eq(schema.ride_requests.id, id));

      // Get rider's phone number
      const riderProfile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, ride.rider_id),
      });

      const riderPhone = riderProfile?.mobile_number || '';

      app.logger.info({ userId: session.user.id, rideId: id }, 'Ride accepted successfully');
      return { success: true, rider_phone: riderPhone };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, rideId: id }, 'Failed to accept ride');
      throw error;
    }
  });

  // POST /api/rides/:id/reject - Reject a ride request (driver)
  fastify.post('/api/rides/:id/reject', {
    schema: {
      description: 'Reject a ride request as driver',
      tags: ['rides'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Ride request ID' },
        },
      },
      response: {
        200: {
          description: 'Ride rejected',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
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

    app.logger.info({ userId: session.user.id, rideId: id }, 'Rejecting ride request');

    try {
      const ride = await app.db.query.ride_requests.findFirst({
        where: eq(schema.ride_requests.id, id),
      });

      if (!ride) {
        app.logger.info({ userId: session.user.id, rideId: id }, 'Ride request not found');
        return reply.status(404).send({ error: 'Ride request not found' });
      }

      // Increment attempt count
      const newAttemptCount = ride.driver_attempt_count + 1;
      const newStatus = newAttemptCount >= 3 ? 'cancelled' : 'pending';

      await app.db.update(schema.ride_requests)
        .set({
          driver_attempt_count: newAttemptCount,
          status: newStatus,
          updated_at: new Date(),
        })
        .where(eq(schema.ride_requests.id, id));

      app.logger.info({ userId: session.user.id, rideId: id, newAttemptCount }, 'Ride rejected successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, rideId: id }, 'Failed to reject ride');
      throw error;
    }
  });

  // POST /api/rides/:id/bargain - Create a bargain (driver)
  fastify.post('/api/rides/:id/bargain', {
    schema: {
      description: 'Create a bargain for a ride',
      tags: ['rides'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Ride request ID' },
        },
      },
      body: {
        type: 'object',
        required: ['bargain_percentage'],
        properties: {
          bargain_percentage: { type: 'integer', enum: [10, 25, 50] },
        },
      },
      response: {
        201: {
          description: 'Bargain created',
          type: 'object',
          properties: {
            id: { type: 'string' },
            ride_request_id: { type: 'string' },
            driver_id: { type: 'string' },
            bargain_percentage: { type: 'integer' },
            bargain_price: { type: 'number' },
            status: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: BargainBody }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const { bargain_percentage } = request.body;

    app.logger.info({ userId: session.user.id, rideId: id, percentage: bargain_percentage }, 'Creating bargain');

    try {
      const ride = await app.db.query.ride_requests.findFirst({
        where: eq(schema.ride_requests.id, id),
      });

      if (!ride) {
        app.logger.info({ userId: session.user.id, rideId: id }, 'Ride request not found');
        return reply.status(404).send({ error: 'Ride request not found' });
      }

      // Calculate bargain price
      const bargainPrice = ride.price_offer * (1 + bargain_percentage / 100);

      // Create bargain record
      const bargainId = createId();
      const [bargain] = await app.db.insert(schema.ride_bargains).values({
        id: bargainId,
        ride_request_id: id,
        driver_id: session.user.id,
        bargain_percentage,
        bargain_price: bargainPrice,
        status: 'pending',
      }).returning();

      // Update ride status to 'bargaining'
      await app.db.update(schema.ride_requests)
        .set({
          status: 'bargaining',
          updated_at: new Date(),
        })
        .where(eq(schema.ride_requests.id, id));

      app.logger.info({ userId: session.user.id, rideId: id, bargainId: bargain.id }, 'Bargain created successfully');
      return reply.status(201).send(bargain);
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, rideId: id, body: request.body }, 'Failed to create bargain');
      throw error;
    }
  });

  // POST /api/rides/:id/bargain/respond - Respond to a bargain (rider)
  fastify.post('/api/rides/:id/bargain/respond', {
    schema: {
      description: 'Respond to a bargain offer',
      tags: ['rides'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Ride request ID' },
        },
      },
      body: {
        type: 'object',
        required: ['accept'],
        properties: {
          accept: { type: 'boolean' },
        },
      },
      response: {
        200: {
          description: 'Bargain response recorded',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            status: { type: 'string' },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: BargainResponseBody }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const { accept } = request.body;

    app.logger.info({ userId: session.user.id, rideId: id, accept }, 'Responding to bargain');

    try {
      const ride = await app.db.query.ride_requests.findFirst({
        where: eq(schema.ride_requests.id, id),
      });

      if (!ride) {
        app.logger.info({ userId: session.user.id, rideId: id }, 'Ride request not found');
        return reply.status(404).send({ error: 'Ride request not found' });
      }

      // Find the most recent pending bargain
      const bargains = await app.db.select()
        .from(schema.ride_bargains)
        .where(
          and(
            eq(schema.ride_bargains.ride_request_id, id),
            eq(schema.ride_bargains.status, 'pending'),
          ),
        );

      if (bargains.length === 0) {
        app.logger.info({ userId: session.user.id, rideId: id }, 'No pending bargain found');
        return reply.status(404).send({ error: 'No pending bargain found' });
      }

      const bargain = bargains[bargains.length - 1]; // Most recent

      if (accept) {
        // Accept bargain
        await app.db.update(schema.ride_bargains)
          .set({ status: 'accepted' })
          .where(eq(schema.ride_bargains.id, bargain.id));

        await app.db.update(schema.ride_requests)
          .set({
            status: 'accepted',
            assigned_driver_id: bargain.driver_id,
            updated_at: new Date(),
          })
          .where(eq(schema.ride_requests.id, id));

        app.logger.info({ userId: session.user.id, rideId: id, bargainId: bargain.id }, 'Bargain accepted');
        return { success: true, status: 'accepted' };
      } else {
        // Reject bargain
        await app.db.update(schema.ride_bargains)
          .set({ status: 'rejected' })
          .where(eq(schema.ride_bargains.id, bargain.id));

        // Increment attempt count
        const newAttemptCount = ride.driver_attempt_count + 1;
        const newStatus = newAttemptCount >= 3 ? 'cancelled' : 'pending';

        await app.db.update(schema.ride_requests)
          .set({
            status: newStatus,
            driver_attempt_count: newAttemptCount,
            updated_at: new Date(),
          })
          .where(eq(schema.ride_requests.id, id));

        app.logger.info({ userId: session.user.id, rideId: id, bargainId: bargain.id }, 'Bargain rejected');
        return { success: true, status: newStatus };
      }
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, rideId: id, body: request.body }, 'Failed to respond to bargain');
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
          id: { type: 'string', description: 'Ride request ID' },
        },
      },
      body: {
        type: 'object',
        properties: {
          distance_km: { type: 'number' },
        },
      },
      response: {
        200: {
          description: 'Ride completed',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: CompleteRideBody }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const { distance_km } = request.body;

    app.logger.info({ userId: session.user.id, rideId: id }, 'Completing ride');

    try {
      const ride = await app.db.query.ride_requests.findFirst({
        where: eq(schema.ride_requests.id, id),
      });

      if (!ride) {
        app.logger.info({ userId: session.user.id, rideId: id }, 'Ride request not found');
        return reply.status(404).send({ error: 'Ride request not found' });
      }

      // Get the final price (check if bargain was accepted)
      let finalPrice = ride.price_offer;
      const bargains = await app.db.select()
        .from(schema.ride_bargains)
        .where(
          and(
            eq(schema.ride_bargains.ride_request_id, id),
            eq(schema.ride_bargains.status, 'accepted'),
          ),
        );

      if (bargains.length > 0) {
        finalPrice = bargains[bargains.length - 1].bargain_price;
      }

      // Update ride status to completed
      await app.db.update(schema.ride_requests)
        .set({
          status: 'completed',
          updated_at: new Date(),
        })
        .where(eq(schema.ride_requests.id, id));

      // Create ride history record
      const historyId = createId();
      // Use assigned driver if available, otherwise use current user (completing their own ride)
      const driverId = ride.assigned_driver_id || session.user.id;

      await app.db.insert(schema.ride_history).values({
        id: historyId,
        ride_request_id: id,
        driver_id: driverId,
        rider_id: ride.rider_id,
        price_final: finalPrice,
        currency: ride.currency,
        distance_km: distance_km || null,
      });

      app.logger.info({ userId: session.user.id, rideId: id, historyId }, 'Ride completed successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, rideId: id, body: request.body }, 'Failed to complete ride');
      throw error;
    }
  });
}
