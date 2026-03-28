import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, inArray, ne, or, isNull, not } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

// Helper: Calculate simple distance squared (for ordering, no sqrt needed)
function distanceSquared(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  return dLat * dLat + dLng * dLng;
}

// Helper: Find nearest non-muted driver
async function findNearestDriver(
  app: App,
  pickupLat: number,
  pickupLng: number,
  excludeDriverIds: string[],
  riderUserId: string
): Promise<{ user_id: string; first_name: string } | null> {
  app.logger.debug(
    { pickupLat, pickupLng, excludeDriverIds, riderUserId },
    'Finding nearest driver'
  );

  // Query all drivers first
  const allProfiles = await app.db.query.profiles.findMany({
    where: eq(schema.profiles.user_type, 'driver'),
  });

  app.logger.debug(
    { totalProfiles: allProfiles.length, profileIds: allProfiles.map((p) => p.user_id), riderUserId },
    'Found all driver profiles'
  );

  // Filter for valid drivers: not the rider, not muted, not in exclude list
  const drivers = allProfiles.filter((d) => {
    const isRider = d.user_id === riderUserId;
    const isMuted = d.muted === true;
    const isExcluded = excludeDriverIds.includes(d.user_id);
    const isValid = !isRider && !isMuted && !isExcluded;

    if (!isValid) {
      app.logger.debug(
        { userId: d.user_id, isRider, isMuted, isExcluded },
        'Filtering out driver'
      );
    }

    return isValid;
  });

  app.logger.debug({ availableDrivers: drivers.length }, 'Available drivers after filtering');

  if (drivers.length === 0) {
    app.logger.debug('No available drivers found');
    return null;
  }

  // Filter drivers with valid location
  const driversWithLocation = drivers.filter(
    (d) => d.pickup_lat !== null && d.pickup_lng !== null
  );

  // If we have drivers with location, find closest
  if (driversWithLocation.length > 0) {
    let nearest = driversWithLocation[0];
    let minDistance = distanceSquared(
      pickupLat,
      pickupLng,
      nearest.pickup_lat!,
      nearest.pickup_lng!
    );

    for (const driver of driversWithLocation.slice(1)) {
      const distance = distanceSquared(
        pickupLat,
        pickupLng,
        driver.pickup_lat!,
        driver.pickup_lng!
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearest = driver;
      }
    }

    app.logger.debug(
      { driverId: nearest.user_id, distance: Math.sqrt(minDistance) },
      'Found nearest driver with location'
    );
    return nearest;
  }

  // If no drivers with location, return first available
  app.logger.debug(
    { driverId: drivers[0].user_id },
    'No drivers with location, returning first available'
  );
  return drivers[0];
}

// Helper: Format ride request response (maps price_offer to offered_price)
function formatRideRequest(row: any): any {
  return {
    id: row.id,
    rider_id: row.rider_id,
    driver_id: row.driver_id,
    vehicle_type: row.vehicle_type,
    pickup_location: row.pickup_location,
    pickup_lat: row.pickup_lat,
    pickup_lng: row.pickup_lng,
    destination: row.destination,
    destination_lat: row.destination_lat,
    destination_lng: row.destination_lng,
    distance_km: row.distance_km,
    offered_price: row.offered_price ?? row.price_offer,
    final_price: row.final_price,
    currency: row.currency,
    status: row.status,
    driver_attempt_count: row.driver_attempt_count,
    rider_first_name: row.rider_first_name,
    rider_phone: row.rider_phone,
    created_at: row.created_at,
  };
}

export function register(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // POST /api/ride-requests - Create a ride request
  fastify.post('/api/ride-requests', {
    schema: {
      description: 'Create a new ride request',
      tags: ['ride-requests'],
      body: {
        type: 'object',
        required: ['vehicle_type', 'pickup_location', 'pickup_lat', 'pickup_lng', 'destination', 'destination_lat', 'destination_lng', 'distance_km', 'offered_price', 'currency'],
        properties: {
          vehicle_type: { type: 'string' },
          pickup_location: { type: 'string' },
          pickup_lat: { type: 'number' },
          pickup_lng: { type: 'number' },
          destination: { type: 'string' },
          destination_lat: { type: 'number' },
          destination_lng: { type: 'number' },
          distance_km: { type: 'number' },
          offered_price: { type: 'number' },
          currency: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            rider_id: { type: 'string' },
            driver_id: { type: ['string', 'null'] },
            vehicle_type: { type: 'string' },
            pickup_location: { type: 'string' },
            pickup_lat: { type: 'number' },
            pickup_lng: { type: 'number' },
            destination: { type: 'string' },
            destination_lat: { type: 'number' },
            destination_lng: { type: 'number' },
            distance_km: { type: 'number' },
            offered_price: { type: 'number' },
            final_price: { type: ['number', 'null'] },
            currency: { type: 'string' },
            status: { type: 'string' },
            driver_attempt_count: { type: 'number' },
            rider_first_name: { type: ['string', 'null'] },
            rider_phone: { type: ['string', 'null'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { vehicle_type, pickup_location, pickup_lat, pickup_lng, destination, destination_lat, destination_lng, distance_km, offered_price, currency } = request.body as any;

    app.logger.info(
      { userId, pickup_location, destination, offered_price },
      'Creating ride request'
    );

    try {
      // Get rider's profile for phone and name
      const riderProfile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, userId),
      });

      const riderPhone = riderProfile?.phone || riderProfile?.mobile_number || null;
      const riderName = riderProfile?.first_name || null;

      // Find nearest non-muted driver
      const nearestDriver = await findNearestDriver(
        app,
        pickup_lat,
        pickup_lng,
        [],
        userId
      );

      if (nearestDriver) {
        app.logger.info(
          { nearestDriver: nearestDriver.user_id },
          'Found nearest driver'
        );
      } else {
        app.logger.warn(
          { userId, pickup_location, destination },
          'No available driver found for ride request'
        );
      }

      // Create ride request
      const requestId = createId();
      const rideRequest = await app.db.insert(schema.ride_requests).values({
        id: requestId,
        rider_id: userId,
        vehicle_type,
        pickup_location,
        pickup_lat,
        pickup_lng,
        destination,
        destination_lat,
        destination_lng,
        distance_km,
        price_offer: offered_price,
        offered_price,
        currency,
        status: 'pending',
        driver_attempt_count: 0,
        routing_count: 0,
        routed_driver_ids: '',
        driver_id: nearestDriver?.user_id || null,
        rider_phone: riderPhone,
        rider_name: riderName,
      }).returning();

      app.logger.info(
        { requestId, driverId: nearestDriver?.user_id },
        'Ride request created successfully'
      );

      return reply.status(201).send(formatRideRequest({
        ...rideRequest[0],
        rider_first_name: riderName,
      }));
    } catch (error) {
      app.logger.error(
        { err: error, userId, offered_price },
        'Failed to create ride request'
      );
      throw error;
    }
  });

  // GET /api/ride-requests/driver/current - Get driver's current pending ride
  fastify.get('/api/ride-requests/driver/current', {
    schema: {
      description: 'Get current pending ride request for driver',
      tags: ['ride-requests'],
      response: {
        200: {
          type: 'object',
          properties: {
            ride_request: {
              type: ['object', 'null'],
              properties: {
                id: { type: 'string' },
                rider_id: { type: 'string' },
                driver_id: { type: 'string' },
                vehicle_type: { type: 'string' },
                pickup_location: { type: 'string' },
                pickup_lat: { type: 'number' },
                pickup_lng: { type: 'number' },
                destination: { type: 'string' },
                destination_lat: { type: 'number' },
                destination_lng: { type: 'number' },
                distance_km: { type: 'number' },
                offered_price: { type: 'number' },
                final_price: { type: ['number', 'null'] },
                currency: { type: 'string' },
                status: { type: 'string' },
                driver_attempt_count: { type: 'number' },
                rider_first_name: { type: ['string', 'null'] },
                rider_phone: { type: 'null' },
                created_at: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;

    app.logger.info({ userId }, 'Fetching current ride for driver');

    try {
      // Get ride in pending or bargaining status
      const ride = await app.db.query.ride_requests.findFirst({
        where: and(
          eq(schema.ride_requests.driver_id, userId),
          or(
            eq(schema.ride_requests.status, 'pending'),
            eq(schema.ride_requests.status, 'bargaining')
          )
        ),
      });

      if (!ride) {
        app.logger.debug({ userId }, 'No current ride found for driver');
        return { ride_request: null };
      }

      // Get rider's first name
      const riderProfile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, ride.rider_id),
      });

      app.logger.debug({ rideId: ride.id }, 'Found current ride for driver');

      return {
        ride_request: formatRideRequest({
          ...ride,
          rider_first_name: riderProfile?.first_name,
          rider_phone: null, // Don't include phone for driver endpoint
        }),
      };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch driver current ride');
      throw error;
    }
  });

  // GET /api/ride-requests/rider/current - Get rider's current ride with pending bargain
  fastify.get('/api/ride-requests/rider/current', {
    schema: {
      description: 'Get current ride request for rider with pending bargain',
      tags: ['ride-requests'],
      response: {
        200: {
          type: 'object',
          properties: {
            ride_request: { type: ['object', 'null'] },
            pending_bargain: { type: ['object', 'null'] },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;

    app.logger.info({ userId }, 'Fetching current ride for rider');

    try {
      // Get ride NOT in completed or cancelled status, most recent first
      const ride = await app.db.query.ride_requests.findFirst({
        where: and(
          eq(schema.ride_requests.rider_id, userId),
          not(or(
            eq(schema.ride_requests.status, 'completed'),
            eq(schema.ride_requests.status, 'cancelled')
          ))
        ),
        orderBy: (rr, { desc }) => desc(rr.created_at),
      });

      let rideResponse = null;
      let pendingBargain = null;

      if (ride) {
        // Get rider's first name
        const riderProfile = await app.db.query.profiles.findFirst({
          where: eq(schema.profiles.user_id, ride.rider_id),
        });

        rideResponse = formatRideRequest({
          ...ride,
          rider_first_name: riderProfile?.first_name,
        });

        // Get pending bargain (where action='bargained' and rider_response is NULL)
        const bargain = await app.db.query.ride_request_attempts.findFirst({
          where: and(
            eq(schema.ride_request_attempts.ride_request_id, ride.id),
            eq(schema.ride_request_attempts.action, 'bargained'),
            isNull(schema.ride_request_attempts.rider_response)
          ),
          orderBy: (rra, { desc }) => desc(rra.created_at),
        });

        if (bargain) {
          pendingBargain = {
            id: bargain.id,
            bargain_percent: bargain.bargain_percent,
            bargain_price: bargain.bargain_price,
            created_at: bargain.created_at,
          };
        }

        app.logger.debug({ rideId: ride.id, hasBargain: !!bargain }, 'Found current ride for rider');
      } else {
        app.logger.debug({ userId }, 'No current ride found for rider');
      }

      return { ride_request: rideResponse, pending_bargain: pendingBargain };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch rider current ride');
      throw error;
    }
  });

  // POST /api/ride-requests/:id/accept - Driver accepts ride
  fastify.post('/api/ride-requests/:id/accept', {
    schema: {
      description: 'Driver accepts a ride request',
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
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            rider_phone: { type: ['string', 'null'] },
            rider_name: { type: ['string', 'null'] },
          },
        },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { id } = request.params;

    app.logger.info({ userId, rideId: id }, 'Driver accepting ride');

    try {
      // Get ride request
      const ride = await app.db.query.ride_requests.findFirst({
        where: eq(schema.ride_requests.id, id),
      });

      if (!ride) {
        app.logger.warn({ rideId: id }, 'Ride request not found');
        return reply.status(404).send({ error: 'Ride request not found' });
      }

      // Verify driver_id matches
      if (ride.driver_id !== userId) {
        app.logger.warn({ rideId: id, userId, assignedDriver: ride.driver_id }, 'Driver not assigned to this ride');
        return reply.status(403).send({ error: 'Not assigned to this ride' });
      }

      // Update ride: status='accepted', final_price=price_offer
      await app.db.update(schema.ride_requests)
        .set({
          status: 'accepted',
          final_price: ride.price_offer,
          updated_at: new Date(),
        })
        .where(eq(schema.ride_requests.id, id));

      // Insert attempt record
      await app.db.insert(schema.ride_request_attempts).values({
        id: createId(),
        ride_request_id: id,
        driver_id: userId,
        action: 'accepted',
      });

      // Get rider's profile
      const riderProfile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, ride.rider_id),
      });

      const riderPhone = riderProfile?.phone || riderProfile?.mobile_number || null;
      const riderName = riderProfile?.first_name || null;

      app.logger.info({ rideId: id }, 'Ride accepted successfully');

      return {
        success: true,
        rider_phone: riderPhone,
        rider_name: riderName,
      };
    } catch (error) {
      app.logger.error({ err: error, userId, rideId: id }, 'Failed to accept ride');
      throw error;
    }
  });

  // POST /api/ride-requests/:id/bargain - Driver proposes bargain
  fastify.post('/api/ride-requests/:id/bargain', {
    schema: {
      description: 'Driver proposes a bargain',
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
        required: ['bargain_percent'],
        properties: {
          bargain_percent: { type: 'integer', enum: [10, 25, 50] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            bargain_price: { type: 'number' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { bargain_percent: number } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { id } = request.params;
    const { bargain_percent } = request.body;

    app.logger.info({ userId, rideId: id, bargainPercent: bargain_percent }, 'Driver proposing bargain');

    try {
      // Validate bargain_percent
      if (![10, 25, 50].includes(bargain_percent)) {
        app.logger.warn({ bargainPercent: bargain_percent }, 'Invalid bargain percent');
        return reply.status(400).send({ error: 'bargain_percent must be 10, 25, or 50' });
      }

      // Get ride request
      const ride = await app.db.query.ride_requests.findFirst({
        where: eq(schema.ride_requests.id, id),
      });

      if (!ride) {
        app.logger.warn({ rideId: id }, 'Ride request not found');
        return reply.status(404).send({ error: 'Ride request not found' });
      }

      // Verify driver_id matches
      if (ride.driver_id !== userId) {
        app.logger.warn({ rideId: id, userId, assignedDriver: ride.driver_id }, 'Driver not assigned to this ride');
        return reply.status(403).send({ error: 'Not assigned to this ride' });
      }

      // Verify status is 'pending'
      if (ride.status !== 'pending') {
        app.logger.warn({ rideId: id, status: ride.status }, 'Ride not in pending status');
        return reply.status(400).send({ error: 'Ride is not in pending status' });
      }

      // Calculate bargain price: price_offer * (1 + bargain_percent / 100)
      const bargainPrice = ride.price_offer * (1 + bargain_percent / 100);

      // Update ride: status='bargaining', bargain_price, bargain_percent
      await app.db.update(schema.ride_requests)
        .set({
          status: 'bargaining',
          bargain_price: bargainPrice,
          bargain_percent,
          updated_at: new Date(),
        })
        .where(eq(schema.ride_requests.id, id));

      // Insert attempt record
      await app.db.insert(schema.ride_request_attempts).values({
        id: createId(),
        ride_request_id: id,
        driver_id: userId,
        action: 'bargained',
        bargain_percent,
        bargain_price: bargainPrice,
      });

      app.logger.info({ rideId: id, bargainPrice }, 'Bargain proposed successfully');

      return {
        success: true,
        bargain_price: bargainPrice,
      };
    } catch (error) {
      app.logger.error({ err: error, userId, rideId: id }, 'Failed to propose bargain');
      throw error;
    }
  });

  // POST /api/ride-requests/:id/reject - Driver rejects or ignores ride
  fastify.post('/api/ride-requests/:id/reject', {
    schema: {
      description: 'Driver rejects or ignores a ride request',
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
        required: ['action'],
        properties: {
          action: { type: 'string', enum: ['rejected', 'ignored'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            status: { type: 'string' },
          },
        },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { action: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { id } = request.params;
    const { action } = request.body;

    app.logger.info({ userId, rideId: id, action }, 'Driver rejecting/ignoring ride');

    try {
      // Get ride request
      const ride = await app.db.query.ride_requests.findFirst({
        where: eq(schema.ride_requests.id, id),
      });

      if (!ride) {
        app.logger.warn({ rideId: id }, 'Ride request not found');
        return reply.status(404).send({ error: 'Ride request not found' });
      }

      // Verify driver_id matches
      if (ride.driver_id !== userId) {
        app.logger.warn({ rideId: id, userId, assignedDriver: ride.driver_id }, 'Driver not assigned to this ride');
        return reply.status(403).send({ error: 'Not assigned to this ride' });
      }

      // Insert attempt record
      await app.db.insert(schema.ride_request_attempts).values({
        id: createId(),
        ride_request_id: id,
        driver_id: userId,
        action,
      });

      // Increment driver_attempt_count
      const newAttemptCount = ride.driver_attempt_count + 1;

      // Parse routed_driver_ids
      const routedIds = ride.routed_driver_ids
        ? ride.routed_driver_ids.split(',').filter(id => id.trim())
        : [];
      const updatedRoutedIds = [...new Set([...routedIds, userId])];

      if (newAttemptCount >= 3) {
        // Cancel ride
        await app.db.update(schema.ride_requests)
          .set({
            status: 'cancelled',
            driver_id: null,
            driver_attempt_count: newAttemptCount,
            routed_driver_ids: updatedRoutedIds.join(','),
            updated_at: new Date(),
          })
          .where(eq(schema.ride_requests.id, id));

        app.logger.info({ rideId: id }, 'Ride cancelled after 3 attempts');
        return { success: true, status: 'cancelled' };
      }

      // Find next nearest driver
      const nextDriver = await findNearestDriver(
        app,
        ride.pickup_lat!,
        ride.pickup_lng!,
        updatedRoutedIds,
        ride.rider_id
      );

      if (nextDriver) {
        await app.db.update(schema.ride_requests)
          .set({
            driver_id: nextDriver.user_id,
            driver_attempt_count: newAttemptCount,
            routed_driver_ids: updatedRoutedIds.join(','),
            status: 'pending',
            bargain_price: null,
            bargain_percent: null,
            updated_at: new Date(),
          })
          .where(eq(schema.ride_requests.id, id));

        app.logger.info(
          { rideId: id, newDriverId: nextDriver.user_id },
          'Ride reassigned to next driver'
        );
        return { success: true, status: 'pending' };
      }

      // No more drivers available
      await app.db.update(schema.ride_requests)
        .set({
          status: 'cancelled',
          driver_id: null,
          driver_attempt_count: newAttemptCount,
          routed_driver_ids: updatedRoutedIds.join(','),
          updated_at: new Date(),
        })
        .where(eq(schema.ride_requests.id, id));

      app.logger.info({ rideId: id }, 'Ride cancelled, no drivers available');
      return { success: true, status: 'cancelled' };
    } catch (error) {
      app.logger.error({ err: error, userId, rideId: id }, 'Failed to reject ride');
      throw error;
    }
  });

  // POST /api/ride-requests/:id/bargain-response - Rider responds to bargain
  fastify.post('/api/ride-requests/:id/bargain-response', {
    schema: {
      description: 'Rider responds to driver bargain',
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
        required: ['response'],
        properties: {
          response: { type: 'string', enum: ['accepted', 'rejected'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            status: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { response: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { id } = request.params;
    const { response } = request.body;

    app.logger.info({ userId, rideId: id, response }, 'Rider responding to bargain');

    try {
      // Get ride request
      const ride = await app.db.query.ride_requests.findFirst({
        where: eq(schema.ride_requests.id, id),
      });

      if (!ride) {
        app.logger.warn({ rideId: id }, 'Ride request not found');
        return reply.status(404).send({ error: 'Ride request not found' });
      }

      // Verify rider_id matches
      if (ride.rider_id !== userId) {
        app.logger.warn({ rideId: id, userId, riderUser: ride.rider_id }, 'User is not the rider');
        return reply.status(403).send({ error: 'Not the rider of this request' });
      }

      // Find pending bargain
      const bargain = await app.db.query.ride_request_attempts.findFirst({
        where: and(
          eq(schema.ride_request_attempts.ride_request_id, id),
          eq(schema.ride_request_attempts.action, 'bargained'),
          isNull(schema.ride_request_attempts.rider_response)
        ),
        orderBy: (rra, { desc }) => desc(rra.created_at),
      });

      if (!bargain) {
        app.logger.warn({ rideId: id }, 'No pending bargain found');
        return reply.status(400).send({ error: 'No pending bargain found' });
      }

      // Update bargain with rider response
      await app.db.update(schema.ride_request_attempts)
        .set({
          rider_response: response,
        })
        .where(eq(schema.ride_request_attempts.id, bargain.id));

      if (response === 'accepted') {
        // Accept the bargained price
        await app.db.update(schema.ride_requests)
          .set({
            status: 'accepted',
            final_price: bargain.bargain_price,
            updated_at: new Date(),
          })
          .where(eq(schema.ride_requests.id, id));

        app.logger.info({ rideId: id }, 'Bargain accepted by rider');
        return { success: true, status: 'accepted' };
      }

      // Response === 'rejected'
      // Increment driver_attempt_count
      const newAttemptCount = ride.driver_attempt_count + 1;
      const routedIds = ride.routed_driver_ids
        ? ride.routed_driver_ids.split(',').filter(id => id.trim())
        : [];
      const updatedRoutedIds = [...new Set([...routedIds, ride.driver_id!])];

      if (newAttemptCount >= 3) {
        // Cancel ride
        await app.db.update(schema.ride_requests)
          .set({
            status: 'cancelled',
            driver_id: null,
            driver_attempt_count: newAttemptCount,
            routed_driver_ids: updatedRoutedIds.join(','),
            updated_at: new Date(),
          })
          .where(eq(schema.ride_requests.id, id));

        app.logger.info({ rideId: id }, 'Ride cancelled after 3 rejected bargains');
        return { success: true, status: 'cancelled' };
      }

      // Find next nearest driver
      const nextDriver = await findNearestDriver(
        app,
        ride.pickup_lat!,
        ride.pickup_lng!,
        updatedRoutedIds,
        ride.rider_id
      );

      if (nextDriver) {
        await app.db.update(schema.ride_requests)
          .set({
            driver_id: nextDriver.user_id,
            driver_attempt_count: newAttemptCount,
            routed_driver_ids: updatedRoutedIds.join(','),
            status: 'pending',
            bargain_price: null,
            bargain_percent: null,
            updated_at: new Date(),
          })
          .where(eq(schema.ride_requests.id, id));

        app.logger.info(
          { rideId: id, newDriverId: nextDriver.user_id },
          'Ride reassigned to next driver after bargain rejection'
        );
        return { success: true, status: 'pending' };
      }

      // No more drivers available
      await app.db.update(schema.ride_requests)
        .set({
          status: 'cancelled',
          driver_id: null,
          driver_attempt_count: newAttemptCount,
          routed_driver_ids: updatedRoutedIds.join(','),
          updated_at: new Date(),
        })
        .where(eq(schema.ride_requests.id, id));

      app.logger.info({ rideId: id }, 'Ride cancelled, no drivers available for reassignment');
      return { success: true, status: 'cancelled' };
    } catch (error) {
      app.logger.error({ err: error, userId, rideId: id }, 'Failed to respond to bargain');
      throw error;
    }
  });

  // POST /api/driver/mute - Set driver mute status
  fastify.post('/api/driver/mute', {
    schema: {
      description: 'Set driver mute status',
      tags: ['driver'],
      body: {
        type: 'object',
        required: ['muted'],
        properties: {
          muted: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            muted: { type: 'boolean' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { muted: boolean } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { muted } = request.body;

    app.logger.info({ userId, muted }, 'Updating driver mute status');

    try {
      await app.db.update(schema.profiles)
        .set({
          muted,
        })
        .where(eq(schema.profiles.user_id, userId));

      app.logger.info({ userId, muted }, 'Driver mute status updated');

      return { muted };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to update mute status');
      throw error;
    }
  });

  // GET /api/driver/mute - Get driver mute status
  fastify.get('/api/driver/mute', {
    schema: {
      description: 'Get driver mute status',
      tags: ['driver'],
      response: {
        200: {
          type: 'object',
          properties: {
            muted: { type: 'boolean' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;

    app.logger.info({ userId }, 'Fetching driver mute status');

    try {
      const profile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, userId),
      });

      const muted = profile?.muted ?? false;

      app.logger.debug({ userId, muted }, 'Driver mute status retrieved');

      return { muted };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch mute status');
      throw error;
    }
  });
}
