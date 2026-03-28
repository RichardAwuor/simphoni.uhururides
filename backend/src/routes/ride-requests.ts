import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, inArray, ne, or, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

// Helper: Haversine distance in kilometers
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Parse routed_driver_ids from DB string format to array
function parseRoutedIds(routedStr: string | null): string[] {
  if (!routedStr) return [];
  // Handle both '{}' and 'id1,id2' formats
  if (routedStr === '{}' || routedStr === '') return [];
  return routedStr.split(',').filter(id => id.trim());
}

// Helper: Find next available driver
async function findNextDriver(
  app: App,
  pickupLat: number,
  pickupLng: number,
  routedDriverIds: string[],
  currentDriverId: string | null | undefined
): Promise<any | null> {
  const statuses = await app.db.query.driver_status.findMany({
    where: and(
      eq(schema.driver_status.is_muted, false),
      eq(schema.driver_status.is_available, true)
    ),
  });

  let candidates = statuses.filter(
    (ds) =>
      !routedDriverIds.includes(ds.driver_id) &&
      ds.driver_id !== currentDriverId
  );

  // First, try candidates with known location
  const withLocation = candidates.filter(
    (c) => c.current_lat !== null && c.current_lng !== null
  );
  if (withLocation.length > 0) {
    let closest = withLocation[0];
    let minDist = haversine(
      pickupLat,
      pickupLng,
      closest.current_lat!,
      closest.current_lng!
    );
    for (const candidate of withLocation.slice(1)) {
      const dist = haversine(
        pickupLat,
        pickupLng,
        candidate.current_lat!,
        candidate.current_lng!
      );
      if (dist < minDist) {
        minDist = dist;
        closest = candidate;
      }
    }
    return closest;
  }

  // If no location data, return any candidate
  return candidates.length > 0 ? candidates[0] : null;
}

// Helper: Format ride request response
function formatRideRequest(row: any, riderName: string, includePhone: boolean) {
  return {
    id: row.id,
    rider_id: row.rider_id,
    driver_id: row.driver_id,
    pickup_location: row.pickup_location,
    pickup_lat: row.pickup_lat,
    pickup_lng: row.pickup_lng,
    destination: row.destination,
    destination_lat: row.destination_lat,
    destination_lng: row.destination_lng,
    distance_km: row.distance_km,
    price_offer: row.price_offer,
    currency: row.currency,
    bargain_price: row.bargain_price,
    bargain_percent: row.bargain_percent,
    status: row.status,
    routing_count: row.routing_count,
    rider_phone: includePhone ? row.rider_phone : null,
    rider_name: riderName,
    created_at: row.created_at?.toISOString(),
    updated_at: row.updated_at?.toISOString(),
  };
}

export function register(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // POST /api/ride-requests - Create new ride request
  fastify.post(
    '/api/ride-requests',
    {
      schema: {
        description: 'Create a new ride request',
        tags: ['ride-requests'],
        body: {
          type: 'object',
          required: [
            'pickup_location',
            'pickup_lat',
            'pickup_lng',
            'destination',
            'price_offer',
            'currency',
          ],
          properties: {
            pickup_location: { type: 'string' },
            pickup_lat: { type: 'number' },
            pickup_lng: { type: 'number' },
            destination: { type: 'string' },
            destination_lat: { type: 'number' },
            destination_lng: { type: 'number' },
            distance_km: { type: 'number' },
            price_offer: { type: 'number' },
            currency: { type: 'string', enum: ['KES', 'TZS', 'UGX', 'USD'] },
          },
        },
        response: {
          201: {
            description: 'Ride request created',
            type: 'object',
            properties: {
              id: { type: 'string' },
              rider_id: { type: 'string' },
              driver_id: { type: ['string', 'null'] },
              pickup_location: { type: 'string' },
              pickup_lat: { type: 'number' },
              pickup_lng: { type: 'number' },
              destination: { type: 'string' },
              destination_lat: { type: ['number', 'null'] },
              destination_lng: { type: ['number', 'null'] },
              distance_km: { type: ['number', 'null'] },
              price_offer: { type: 'number' },
              currency: { type: 'string' },
              bargain_price: { type: ['number', 'null'] },
              bargain_percent: { type: ['integer', 'null'] },
              status: { type: 'string' },
              routing_count: { type: 'integer' },
              rider_phone: { type: ['string', 'null'] },
              rider_name: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          403: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          pickup_location: string;
          pickup_lat: number;
          pickup_lng: number;
          destination: string;
          destination_lat?: number;
          destination_lng?: number;
          distance_km?: number;
          price_offer: number;
          currency: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Creating ride request');

      try {
        // Check if user is a driver
        const profile = await app.db.query.profiles.findFirst({
          where: eq(schema.profiles.user_id, userId),
        });

        if (profile && profile.user_type === 'driver') {
          app.logger.warn({ userId }, 'Drivers cannot create ride requests');
          return reply
            .status(403)
            .send({ error: 'Drivers cannot create ride requests' });
        }

        // Cancel previous pending/bargaining rides
        await app.db
          .update(schema.ride_requests)
          .set({ status: 'cancelled', updated_at: new Date() })
          .where(
            and(
              eq(schema.ride_requests.rider_id, userId),
              inArray(schema.ride_requests.status, ['pending', 'bargaining'])
            )
          );

        // Create new ride request
        const requestId = createId();
        const {
          pickup_location,
          pickup_lat,
          pickup_lng,
          destination,
          destination_lat,
          destination_lng,
          distance_km,
          price_offer,
          currency,
        } = request.body;

        const [newRequest] = await app.db
          .insert(schema.ride_requests)
          .values({
            id: requestId,
            rider_id: userId,
            driver_id: null,
            pickup_location,
            pickup_lat,
            pickup_lng,
            destination,
            destination_lat: destination_lat || null,
            destination_lng: destination_lng || null,
            distance_km: distance_km || null,
            price_offer,
            currency: currency as any,
            status: 'pending',
            routing_count: 0,
            routed_driver_ids: '',
            rider_phone: null,
            bargain_price: null,
            bargain_percent: null,
            driver_attempt_count: 0,
            assigned_driver_id: null,
          })
          .returning();

        // Find next driver
        const nextDriver = await findNextDriver(
          app,
          pickup_lat,
          pickup_lng,
          [],
          null
        );

        if (nextDriver) {
          await app.db
            .update(schema.ride_requests)
            .set({
              driver_id: nextDriver.driver_id,
              assigned_driver_id: nextDriver.driver_id,
              routing_count: 1,
              routed_driver_ids: nextDriver.driver_id,
            })
            .where(eq(schema.ride_requests.id, requestId));

          newRequest.driver_id = nextDriver.driver_id;
          newRequest.routing_count = 1;
          newRequest.routed_driver_ids = nextDriver.driver_id;
        }

        // Get rider name
        const riderName =
          profile?.first_name || session.user.name || 'Unknown';

        app.logger.info(
          { userId, requestId, driverId: nextDriver?.driver_id },
          'Ride request created successfully'
        );

        return reply.status(201).send(
          formatRideRequest(newRequest, riderName, false)
        );
      } catch (error) {
        app.logger.error(
          { err: error, userId, body: request.body },
          'Failed to create ride request'
        );
        throw error;
      }
    }
  );

  // GET /api/ride-requests - List pending ride requests for driver
  fastify.get(
    '/api/ride-requests',
    {
      schema: {
        description: 'Get available pending ride requests',
        tags: ['ride-requests'],
        response: {
          200: {
            description: 'List of available ride requests',
            type: 'object',
            properties: {
              requests: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    rider_name: { type: 'string' },
                    pickup_lat: { type: 'number' },
                    pickup_lng: { type: 'number' },
                    pickup_address: { type: 'string' },
                    destination_address: { type: 'string' },
                    distance_km: { type: 'number' },
                    price_offer: { type: 'number' },
                    currency: { type: 'string' },
                    status: { type: 'string' },
                    bargain_price: { type: 'number' },
                    bargain_multiplier: { type: 'number' },
                    created_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Getting available ride requests');

      try {
        const rideRequests = await app.db.query.ride_requests.findMany({
          where: and(
            eq(schema.ride_requests.status, 'pending'),
            or(
              isNull(schema.ride_requests.current_driver_id),
              eq(schema.ride_requests.current_driver_id, userId)
            )
          ),
          orderBy: (table) => [sql`${table.created_at} ASC`],
        });

        const requests = rideRequests.map((ride) => ({
          id: ride.id,
          rider_name: ride.rider_name,
          pickup_lat: ride.pickup_lat,
          pickup_lng: ride.pickup_lng,
          pickup_address: ride.pickup_address || ride.pickup_location,
          destination_address: ride.destination_address || ride.destination,
          distance_km: ride.distance_km,
          price_offer: ride.price_offer,
          currency: ride.currency,
          status: ride.status,
          bargain_price: ride.bargain_price,
          bargain_multiplier: ride.bargain_multiplier,
          created_at: ride.created_at?.toISOString(),
        }));

        app.logger.info({ userId, count: requests.length }, 'Retrieved available ride requests');
        return { requests };
      } catch (error) {
        app.logger.error(
          { err: error, userId },
          'Failed to get ride requests'
        );
        throw error;
      }
    }
  );

  // GET /api/ride-requests/:id - Get single ride request
  fastify.get(
    '/api/ride-requests/:id',
    {
      schema: {
        description: 'Get a single ride request',
        tags: ['ride-requests'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Ride request retrieved',
            type: 'object',
            properties: {
              id: { type: 'string' },
              rider_id: { type: 'string' },
              driver_id: { type: ['string', 'null'] },
              pickup_location: { type: 'string' },
              pickup_lat: { type: 'number' },
              pickup_lng: { type: 'number' },
              destination: { type: 'string' },
              destination_lat: { type: ['number', 'null'] },
              destination_lng: { type: ['number', 'null'] },
              distance_km: { type: ['number', 'null'] },
              price_offer: { type: 'number' },
              currency: { type: 'string' },
              bargain_price: { type: ['number', 'null'] },
              bargain_percent: { type: ['integer', 'null'] },
              status: { type: 'string' },
              routing_count: { type: 'integer' },
              rider_phone: { type: ['string', 'null'] },
              rider_name: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { id } = request.params;
      app.logger.info({ userId, rideId: id }, 'Getting ride request');

      try {
        const ride = await app.db.query.ride_requests.findFirst({
          where: eq(schema.ride_requests.id, id),
        });

        if (!ride) {
          app.logger.warn({ userId, rideId: id }, 'Ride request not found');
          return reply.status(404).send({ error: 'Ride request not found' });
        }

        // Check access
        if (userId !== ride.rider_id && userId !== ride.driver_id) {
          app.logger.warn(
            { userId, rideId: id, riderId: ride.rider_id, driverId: ride.driver_id },
            'Unauthorized access to ride request'
          );
          return reply.status(403).send({ error: 'Unauthorized' });
        }

        const profile = await app.db.query.profiles.findFirst({
          where: eq(schema.profiles.user_id, ride.rider_id),
        });
        const riderName = profile?.first_name || 'Unknown';

        const includePhone =
          ride.status === 'accepted' && userId === ride.driver_id;

        app.logger.info({ userId, rideId: id }, 'Retrieved ride request');
        return reply.status(200).send(formatRideRequest(ride, riderName, includePhone));
      } catch (error) {
        app.logger.error(
          { err: error, userId, rideId: id },
          'Failed to get ride request'
        );
        throw error;
      }
    }
  );

  // POST /api/ride-requests/:id/accept - Accept ride
  fastify.post(
    '/api/ride-requests/:id/accept',
    {
      schema: {
        description: 'Accept a ride request',
        tags: ['ride-requests'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Ride request ID' },
          },
        },
        response: {
          200: {
            description: 'Ride accepted successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              rider_phone: { type: 'string' },
            },
          },
          404: {
            description: 'Ride request not found',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { id } = request.params;
      app.logger.info({ userId, rideId: id }, 'Accepting ride request');

      try {
        const ride = await app.db.query.ride_requests.findFirst({
          where: eq(schema.ride_requests.id, id),
        });

        if (!ride) {
          app.logger.warn({ userId, rideId: id }, 'Ride request not found');
          return reply.status(404).send({ error: 'Ride request not found' });
        }

        // Update ride request
        await app.db
          .update(schema.ride_requests)
          .set({
            status: 'accepted' as any,
            current_driver_id: userId,
            driver_id: userId,
            updated_at: new Date(),
          })
          .where(eq(schema.ride_requests.id, id));

        // Insert action record
        const actionId = createId();
        await app.db.insert(schema.driver_ride_actions).values({
          id: actionId,
          ride_request_id: id,
          driver_id: userId,
          action: 'accepted',
        });

        app.logger.info({ userId, rideId: id }, 'Ride accepted successfully');
        return { success: true, rider_phone: ride.rider_phone || '' };
      } catch (error) {
        app.logger.error(
          { err: error, userId, rideId: id },
          'Failed to accept ride'
        );
        throw error;
      }
    }
  );

  // POST /api/ride-requests/:id/bargain - Bargain on price
  fastify.post(
    '/api/ride-requests/:id/bargain',
    {
      schema: {
        description: 'Send a price bargain offer with multiplier',
        tags: ['ride-requests'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Ride request ID' },
          },
        },
        body: {
          type: 'object',
          required: ['multiplier'],
          properties: {
            multiplier: { type: 'number', description: 'Price multiplier' },
          },
        },
        response: {
          200: {
            description: 'Bargain sent successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              bargain_price: { type: 'number' },
            },
          },
          404: {
            description: 'Ride request not found',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { multiplier: number };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { id } = request.params;
      const { multiplier } = request.body;
      app.logger.info({ userId, rideId: id, multiplier }, 'Sending bargain offer');

      try {
        const ride = await app.db.query.ride_requests.findFirst({
          where: eq(schema.ride_requests.id, id),
        });

        if (!ride) {
          app.logger.warn({ userId, rideId: id }, 'Ride request not found');
          return reply.status(404).send({ error: 'Ride request not found' });
        }

        // Compute bargain price
        const bargain_price = ride.price_offer * multiplier;

        // Update ride request
        await app.db
          .update(schema.ride_requests)
          .set({
            status: 'bargaining' as any,
            bargain_multiplier: multiplier,
            bargain_price,
            current_driver_id: userId,
            updated_at: new Date(),
          })
          .where(eq(schema.ride_requests.id, id));

        // Insert action record
        const actionId = createId();
        await app.db.insert(schema.driver_ride_actions).values({
          id: actionId,
          ride_request_id: id,
          driver_id: userId,
          action: 'bargained',
          bargain_multiplier: multiplier,
        });

        app.logger.info({ userId, rideId: id, bargainPrice: bargain_price }, 'Bargain sent successfully');
        return { success: true, bargain_price };
      } catch (error) {
        app.logger.error(
          { err: error, userId, rideId: id, multiplier },
          'Failed to send bargain'
        );
        throw error;
      }
    }
  );

  // POST /api/ride-requests/:id/respond-bargain - Accept/reject bargain
  fastify.post(
    '/api/ride-requests/:id/respond-bargain',
    {
      schema: {
        description: 'Respond to a bargain offer',
        tags: ['ride-requests'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
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
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { accept: boolean };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { id } = request.params;
      const { accept } = request.body;
      app.logger.info({ userId, rideId: id, accept }, 'Responding to bargain');

      try {
        const ride = await app.db.query.ride_requests.findFirst({
          where: eq(schema.ride_requests.id, id),
        });

        if (!ride) {
          app.logger.warn({ userId, rideId: id }, 'Ride request not found');
          return reply.status(404).send({ error: 'Ride request not found' });
        }

        if (userId !== ride.rider_id) {
          app.logger.warn(
            { userId, rideId: id, riderId: ride.rider_id },
            'Not the rider'
          );
          return reply.status(403).send({ error: 'Unauthorized' });
        }

        if (ride.status !== 'bargaining') {
          app.logger.warn(
            { userId, rideId: id, status: ride.status },
            'No active bargain'
          );
          return reply.status(400).send({ error: 'No active bargain' });
        }

        const riderProfile = await app.db.query.profiles.findFirst({
          where: eq(schema.profiles.user_id, ride.rider_id),
        });

        if (accept) {
          const [updated] = await app.db
            .update(schema.ride_requests)
            .set({
              status: 'accepted',
              rider_phone: riderProfile?.mobile_number || null,
              updated_at: new Date(),
            })
            .where(eq(schema.ride_requests.id, id))
            .returning();

          app.logger.info(
            { userId, rideId: id },
            'Bargain accepted'
          );
          return reply.status(200).send(formatRideRequest(
            updated,
            riderProfile?.first_name || 'Unknown',
            true
          ));
        } else {
          // Reject bargain - find next driver
          const routedIds = parseRoutedIds(ride.routed_driver_ids);
          routedIds.push(ride.driver_id!);
          const deduped = [...new Set(routedIds)];

          const nextDriver = await findNextDriver(
            app,
            ride.pickup_lat!,
            ride.pickup_lng!,
            deduped,
            ride.driver_id
          );

          if (nextDriver && ride.routing_count < 3) {
            deduped.push(nextDriver.driver_id);
            const [updated] = await app.db
              .update(schema.ride_requests)
              .set({
                driver_id: nextDriver.driver_id,
                assigned_driver_id: nextDriver.driver_id,
                routing_count: ride.routing_count + 1,
                routed_driver_ids: deduped.join(','),
                status: 'pending',
                bargain_price: null,
                bargain_percent: null,
                updated_at: new Date(),
              })
              .where(eq(schema.ride_requests.id, id))
              .returning();

            app.logger.info(
              { userId, rideId: id, nextDriverId: nextDriver.driver_id },
              'Bargain rejected, next driver assigned'
            );
            return reply.status(200).send(formatRideRequest(
              updated,
              riderProfile?.first_name || 'Unknown',
              false
            ));
          } else {
            const [updated] = await app.db
              .update(schema.ride_requests)
              .set({
                status: 'cancelled',
                updated_at: new Date(),
              })
              .where(eq(schema.ride_requests.id, id))
              .returning();

            app.logger.info(
              { userId, rideId: id },
              'Bargain rejected, ride cancelled (no drivers available)'
            );
            return reply.status(200).send(formatRideRequest(
              updated,
              riderProfile?.first_name || 'Unknown',
              false
            ));
          }
        }
      } catch (error) {
        app.logger.error(
          { err: error, userId, rideId: id, accept },
          'Failed to respond to bargain'
        );
        throw error;
      }
    }
  );

  // POST /api/ride-requests/:id/ignore - Ignore ride
  fastify.post(
    '/api/ride-requests/:id/ignore',
    {
      schema: {
        description: 'Ignore a ride request',
        tags: ['ride-requests'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { id } = request.params;
      app.logger.info({ userId, rideId: id }, 'Ignoring ride request');

      try {
        const ride = await app.db.query.ride_requests.findFirst({
          where: eq(schema.ride_requests.id, id),
        });

        if (!ride) {
          app.logger.warn({ userId, rideId: id }, 'Ride request not found');
          return reply.status(404).send({ error: 'Ride request not found' });
        }

        if (userId !== ride.driver_id) {
          app.logger.warn(
            { userId, rideId: id, driverId: ride.driver_id },
            'Not the assigned driver'
          );
          return reply.status(403).send({ error: 'Unauthorized' });
        }

        if (!['pending', 'bargaining'].includes(ride.status)) {
          app.logger.warn(
            { userId, rideId: id, status: ride.status },
            'Cannot ignore ride in current status'
          );
          return reply.status(400).send({ error: 'Cannot ignore this ride' });
        }

        // Add current driver to routed list and find next
        const routedIds = parseRoutedIds(ride.routed_driver_ids);
        routedIds.push(userId);
        const deduped = [...new Set(routedIds)];

        const nextDriver = await findNextDriver(
          app,
          ride.pickup_lat!,
          ride.pickup_lng!,
          deduped,
          userId
        );

        if (nextDriver && ride.routing_count < 3) {
          deduped.push(nextDriver.driver_id);
          const [updated] = await app.db
            .update(schema.ride_requests)
            .set({
              driver_id: nextDriver.driver_id,
              assigned_driver_id: nextDriver.driver_id,
              routing_count: ride.routing_count + 1,
              routed_driver_ids: deduped.join(','),
              status: 'pending',
              bargain_price: null,
              bargain_percent: null,
              updated_at: new Date(),
            })
            .where(eq(schema.ride_requests.id, id))
            .returning();

          app.logger.info(
            { userId, rideId: id, nextDriverId: nextDriver.driver_id },
            'Ride ignored, next driver assigned'
          );

          const riderProfile = await app.db.query.profiles.findFirst({
            where: eq(schema.profiles.user_id, ride.rider_id),
          });

          return reply.status(200).send(formatRideRequest(
            updated,
            riderProfile?.first_name || 'Unknown',
            false
          ));
        } else {
          const [updated] = await app.db
            .update(schema.ride_requests)
            .set({
              status: 'cancelled',
              updated_at: new Date(),
            })
            .where(eq(schema.ride_requests.id, id))
            .returning();

          app.logger.info(
            { userId, rideId: id },
            'Ride ignored, cancelled (no drivers available)'
          );

          const riderProfile = await app.db.query.profiles.findFirst({
            where: eq(schema.profiles.user_id, ride.rider_id),
          });

          return reply.status(200).send(formatRideRequest(
            updated,
            riderProfile?.first_name || 'Unknown',
            false
          ));
        }
      } catch (error) {
        app.logger.error(
          { err: error, userId, rideId: id },
          'Failed to ignore ride'
        );
        throw error;
      }
    }
  );

  // POST /api/ride-requests/:id/cancel - Cancel ride
  fastify.post(
    '/api/ride-requests/:id/cancel',
    {
      schema: {
        description: 'Cancel a ride request',
        tags: ['ride-requests'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { id } = request.params;
      app.logger.info({ userId, rideId: id }, 'Cancelling ride request');

      try {
        const ride = await app.db.query.ride_requests.findFirst({
          where: eq(schema.ride_requests.id, id),
        });

        if (!ride) {
          app.logger.warn({ userId, rideId: id }, 'Ride request not found');
          return reply.status(404).send({ error: 'Ride request not found' });
        }

        if (userId !== ride.rider_id) {
          app.logger.warn(
            { userId, rideId: id, riderId: ride.rider_id },
            'Not the rider'
          );
          return reply.status(403).send({ error: 'Unauthorized' });
        }

        const [updated] = await app.db
          .update(schema.ride_requests)
          .set({
            status: 'cancelled',
            updated_at: new Date(),
          })
          .where(eq(schema.ride_requests.id, id))
          .returning();

        app.logger.info({ userId, rideId: id }, 'Ride cancelled successfully');

        const riderProfile = await app.db.query.profiles.findFirst({
          where: eq(schema.profiles.user_id, ride.rider_id),
        });

        return reply.status(200).send(formatRideRequest(
          updated,
          riderProfile?.first_name || 'Unknown',
          false
        ));
      } catch (error) {
        app.logger.error(
          { err: error, userId, rideId: id },
          'Failed to cancel ride'
        );
        throw error;
      }
    }
  );

  // GET /api/driver-status - Get driver status
  fastify.get(
    '/api/driver-status',
    {
      schema: {
        description: 'Get driver status',
        tags: ['driver-status'],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              driver_id: { type: 'string' },
              is_muted: { type: 'boolean' },
              is_available: { type: 'boolean' },
              current_lat: { type: ['number', 'null'] },
              current_lng: { type: ['number', 'null'] },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Getting driver status');

      try {
        let status = await app.db.query.driver_status.findFirst({
          where: eq(schema.driver_status.driver_id, userId),
        });

        if (!status) {
          const statusId = createId();
          const [newStatus] = await app.db
            .insert(schema.driver_status)
            .values({
              id: statusId,
              driver_id: userId,
              is_muted: false,
              is_available: true,
              current_lat: null,
              current_lng: null,
            })
            .returning();
          status = newStatus;
        }

        app.logger.info({ userId }, 'Retrieved driver status');
        return reply.send({
          id: status.id,
          driver_id: status.driver_id,
          is_muted: status.is_muted,
          is_available: status.is_available,
          current_lat: status.current_lat,
          current_lng: status.current_lng,
          updated_at: status.updated_at?.toISOString(),
        });
      } catch (error) {
        app.logger.error(
          { err: error, userId },
          'Failed to get driver status'
        );
        throw error;
      }
    }
  );

  // PUT /api/driver-status - Update driver status
  fastify.put(
    '/api/driver-status',
    {
      schema: {
        description: 'Update driver status',
        tags: ['driver-status'],
        body: {
          type: 'object',
          properties: {
            is_muted: { type: 'boolean' },
            is_available: { type: 'boolean' },
            current_lat: { type: 'number' },
            current_lng: { type: 'number' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              driver_id: { type: 'string' },
              is_muted: { type: 'boolean' },
              is_available: { type: 'boolean' },
              current_lat: { type: ['number', 'null'] },
              current_lng: { type: ['number', 'null'] },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          401: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          is_muted?: boolean;
          is_available?: boolean;
          current_lat?: number;
          current_lng?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      app.logger.info({ userId, body: request.body }, 'Updating driver status');

      try {
        const { is_muted, is_available, current_lat, current_lng } = request.body;

        // Build update object
        const updateData: any = { updated_at: new Date() };
        if (is_muted !== undefined) updateData.is_muted = is_muted;
        if (is_available !== undefined) updateData.is_available = is_available;
        if (current_lat !== undefined) updateData.current_lat = current_lat;
        if (current_lng !== undefined) updateData.current_lng = current_lng;

        // Check if exists
        let status = await app.db.query.driver_status.findFirst({
          where: eq(schema.driver_status.driver_id, userId),
        });

        if (!status) {
          // Insert with defaults merged with provided fields
          const statusId = createId();
          const [newStatus] = await app.db
            .insert(schema.driver_status)
            .values({
              id: statusId,
              driver_id: userId,
              is_muted: is_muted ?? false,
              is_available: is_available ?? true,
              current_lat: current_lat ?? null,
              current_lng: current_lng ?? null,
            })
            .returning();
          status = newStatus;
        } else {
          // Update existing
          const [updated] = await app.db
            .update(schema.driver_status)
            .set(updateData)
            .where(eq(schema.driver_status.driver_id, userId))
            .returning();
          status = updated;
        }

        app.logger.info({ userId }, 'Driver status updated successfully');
        return reply.send({
          id: status.id,
          driver_id: status.driver_id,
          is_muted: status.is_muted,
          is_available: status.is_available,
          current_lat: status.current_lat,
          current_lng: status.current_lng,
          updated_at: status.updated_at?.toISOString(),
        });
      } catch (error) {
        app.logger.error(
          { err: error, userId, body: request.body },
          'Failed to update driver status'
        );
        throw error;
      }
    }
  );

  // POST /api/ride-requests/:id/reject - Reject a ride request
  fastify.post(
    '/api/ride-requests/:id/reject',
    {
      schema: {
        description: 'Reject or ignore a ride request',
        tags: ['ride-requests'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Ride request ID' },
          },
        },
        body: {
          type: 'object',
          required: ['action'],
          properties: {
            action: { type: 'string', enum: ['rejected', 'ignored'], description: 'Action type' },
          },
        },
        response: {
          200: {
            description: 'Ride request rejected successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          404: {
            description: 'Ride request not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { action: 'rejected' | 'ignored' };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const { action } = request.body;
      const authUserId = session.user.id;

      app.logger.info({ rideId: id, action }, 'Rejecting ride request');

      try {
        // Get current ride request
        const ride = await app.db.query.ride_requests.findFirst({
          where: eq(schema.ride_requests.id, id),
        });

        if (!ride) {
          app.logger.warn({ rideId: id }, 'Ride request not found');
          return reply.status(404).send({ error: 'Ride request not found' });
        }

        // Insert action record
        const actionId = createId();
        await app.db.insert(schema.driver_ride_actions).values({
          id: actionId,
          ride_request_id: id,
          driver_id: authUserId,
          action,
        });

        // Calculate new attempt count
        const newCount = (ride.driver_attempt_count || 0) + 1;

        // Update ride request
        if (newCount >= 3) {
          await app.db
            .update(schema.ride_requests)
            .set({
              status: 'cancelled' as any,
              driver_attempt_count: newCount,
              updated_at: new Date(),
            })
            .where(eq(schema.ride_requests.id, id));
          app.logger.info({ rideId: id, newCount }, 'Ride request cancelled due to attempt limit');
        } else {
          await app.db
            .update(schema.ride_requests)
            .set({
              status: 'pending' as any,
              current_driver_id: null,
              driver_attempt_count: newCount,
              updated_at: new Date(),
            })
            .where(eq(schema.ride_requests.id, id));
          app.logger.info({ rideId: id, newCount }, 'Ride request reset to pending');
        }

        return { success: true };
      } catch (error) {
        app.logger.error(
          { err: error, rideId: id, action },
          'Failed to reject ride request'
        );
        throw error;
      }
    }
  );

  // POST /api/ride-requests/:id/rider-response - Rider accepts or rejects bargained price
  fastify.post(
    '/api/ride-requests/:id/rider-response',
    {
      schema: {
        description: 'Rider accepts or rejects a bargained ride',
        tags: ['ride-requests'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Ride request ID' },
          },
        },
        body: {
          type: 'object',
          required: ['accepted'],
          properties: {
            accepted: { type: 'boolean', description: 'Whether rider accepts' },
          },
        },
        response: {
          200: {
            description: 'Rider response processed',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              status: { type: 'string' },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          404: {
            description: 'Ride request not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { accepted: boolean };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const { accepted } = request.body;

      app.logger.info({ rideId: id, accepted }, 'Processing rider response');

      try {
        // Get current ride request
        const ride = await app.db.query.ride_requests.findFirst({
          where: eq(schema.ride_requests.id, id),
        });

        if (!ride) {
          app.logger.warn({ rideId: id }, 'Ride request not found');
          return reply.status(404).send({ error: 'Ride request not found' });
        }

        if (accepted) {
          // Rider accepted bargained price
          await app.db
            .update(schema.ride_requests)
            .set({
              status: 'accepted' as any,
              updated_at: new Date(),
            })
            .where(eq(schema.ride_requests.id, id));
          app.logger.info({ rideId: id }, 'Ride request accepted by rider');
          return { success: true, status: 'accepted' };
        } else {
          // Rider rejected bargained price
          const newCount = (ride.driver_attempt_count || 0) + 1;
          let newStatus: string;

          if (newCount >= 3) {
            newStatus = 'cancelled';
          } else {
            newStatus = 'pending';
          }

          const updateData: any = {
            status: newStatus,
            driver_attempt_count: newCount,
            updated_at: new Date(),
          };

          if (newStatus === 'pending') {
            updateData.current_driver_id = null;
            updateData.bargain_multiplier = null;
            updateData.bargain_price = null;
          }

          await app.db
            .update(schema.ride_requests)
            .set(updateData)
            .where(eq(schema.ride_requests.id, id));
          app.logger.info({ rideId: id, newCount, newStatus }, 'Ride request status updated after rider rejection');
          return { success: true, status: newStatus };
        }
      } catch (error) {
        app.logger.error(
          { err: error, rideId: id, accepted },
          'Failed to process rider response'
        );
        throw error;
      }
    }
  );

  // POST /api/driver/mute - Mute or unmute ride notifications
  fastify.post(
    '/api/driver/mute',
    {
      schema: {
        description: 'Mute or unmute ride notifications',
        tags: ['driver'],
        body: {
          type: 'object',
          required: ['muted'],
          properties: {
            muted: { type: 'boolean', description: 'Whether to mute notifications' },
          },
        },
        response: {
          200: {
            description: 'Mute status updated',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              muted: { type: 'boolean' },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: { muted: boolean };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { muted } = request.body;
      const authUserId = session.user.id;

      app.logger.info({ userId: authUserId, muted }, 'Updating driver mute status');

      try {
        // Check if driver status exists
        let status = await app.db.query.driver_status.findFirst({
          where: eq(schema.driver_status.driver_id, authUserId),
        });

        if (!status) {
          // Insert new driver status
          const statusId = createId();
          await app.db.insert(schema.driver_status).values({
            id: statusId,
            driver_id: authUserId,
            is_muted: muted,
            is_available: true,
            updated_at: new Date(),
          });
        } else {
          // Update existing driver status
          await app.db
            .update(schema.driver_status)
            .set({
              is_muted: muted,
              updated_at: new Date(),
            })
            .where(eq(schema.driver_status.driver_id, authUserId));
        }

        app.logger.info({ userId: authUserId, muted }, 'Driver mute status updated successfully');
        return { success: true, muted };
      } catch (error) {
        app.logger.error(
          { err: error, userId: authUserId, muted },
          'Failed to update driver mute status'
        );
        throw error;
      }
    }
  );

  // GET /api/driver/mute - Get current mute status
  fastify.get(
    '/api/driver/mute',
    {
      schema: {
        description: 'Get current driver mute status',
        tags: ['driver'],
        response: {
          200: {
            description: 'Current mute status',
            type: 'object',
            properties: {
              muted: { type: 'boolean' },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const authUserId = session.user.id;

      app.logger.info({ userId: authUserId }, 'Fetching driver mute status');

      try {
        const status = await app.db.query.driver_status.findFirst({
          where: eq(schema.driver_status.driver_id, authUserId),
        });

        const muted = status?.is_muted ?? false;
        app.logger.info({ userId: authUserId, muted }, 'Driver mute status retrieved');
        return { muted };
      } catch (error) {
        app.logger.error(
          { err: error, userId: authUserId },
          'Failed to fetch driver mute status'
        );
        throw error;
      }
    }
  );
}
