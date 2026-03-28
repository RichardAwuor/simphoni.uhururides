import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lt } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import * as schema from '../db/schema/schema.js';
import { user } from '../db/schema/auth-schema.js';
import type { App } from '../index.js';

interface CreateDriverDetailsBody {
  vehicle_type?: string;
  car_make?: string;
  car_registration?: string;
  national_id?: string;
  // Legacy fields for backwards compatibility
  vehicleMake?: 'Toyota' | 'Nissan' | 'Ford' | 'Mercedes' | 'Volkswagen' | 'Others';
  licensePlate?: string;
  licenseNumber?: string;
}

interface UpdateAvailabilityBody {
  is_available: boolean;
}

export function register(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // POST /api/driver/details - Upsert driver details
  fastify.post('/api/driver/details', {
    schema: {
      description: 'Upsert driver details',
      tags: ['driver'],
      body: {
        type: 'object',
        properties: {
          vehicle_type: { type: 'string' },
          car_make: { type: 'string' },
          car_registration: { type: 'string' },
          national_id: { type: 'string' },
          // Legacy fields
          vehicleMake: { type: 'string', enum: ['Toyota', 'Nissan', 'Ford', 'Mercedes', 'Volkswagen', 'Others'] },
          licensePlate: { type: 'string' },
          licenseNumber: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Driver details upserted',
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            car_make: { type: 'string' },
            car_registration: { type: 'string' },
            car_color: { type: 'string' },
            is_available: { type: 'boolean' },
            license_number: { type: ['string', 'null'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: CreateDriverDetailsBody }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    // Handle both new and legacy field names
    const carMake = request.body.car_make || request.body.vehicleMake || 'Others';
    const carRegistration = request.body.car_registration || request.body.licensePlate || '';
    const licenseNum = request.body.licenseNumber || '';
    const vehicleType = request.body.vehicle_type || '';
    const nationalId = request.body.national_id || '';

    app.logger.info({ userId: session.user.id, carMake }, 'Upserting driver details');

    try {
      // Map car_make to enum value if it's not already valid
      let carMakeValue: 'Toyota' | 'Nissan' | 'Ford' | 'Mercedes' | 'Volkswagen' | 'Others' = 'Others';
      const validMakes = ['Toyota', 'Nissan', 'Ford', 'Mercedes', 'Volkswagen', 'Others'];
      if (validMakes.includes(carMake)) {
        carMakeValue = carMake as 'Toyota' | 'Nissan' | 'Ford' | 'Mercedes' | 'Volkswagen' | 'Others';
      }

      const existingDetails = await app.db.query.driver_details.findFirst({
        where: eq(schema.driver_details.user_id, session.user.id),
      });

      const driverDetailsData = {
        car_make: carMakeValue,
        car_registration: carRegistration ? carRegistration.toUpperCase() : '',
        license_number: licenseNum,
        car_color: '',
        is_available: false,
      };

      let details;
      if (existingDetails) {
        const [updated] = await app.db.update(schema.driver_details)
          .set(driverDetailsData)
          .where(eq(schema.driver_details.user_id, session.user.id))
          .returning();
        details = updated;
      } else {
        const driverId = createId();
        const [created] = await app.db.insert(schema.driver_details).values({
          id: driverId,
          user_id: session.user.id,
          ...driverDetailsData,
        }).returning();
        details = created;
      }

      // Also update profiles table with vehicle information
      const profileUpdates: any = {
        vehicle_make: carMake,
        license_plate: carRegistration,
      };
      if (vehicleType) {
        profileUpdates.vehicle_model = vehicleType;
      }
      if (nationalId) {
        profileUpdates.national_id = nationalId;
      }

      await app.db.update(schema.profiles)
        .set(profileUpdates)
        .where(eq(schema.profiles.user_id, session.user.id));

      app.logger.info({ userId: session.user.id, driverId: details.id }, 'Driver details upserted successfully');
      return details;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, body: request.body }, 'Failed to upsert driver details');
      throw error;
    }
  });

  // GET /api/driver/details - Get driver details for current user
  fastify.get('/api/driver/details', {
    schema: {
      description: 'Get driver details',
      tags: ['driver'],
      response: {
        200: {
          description: 'Driver details',
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            car_make: { type: 'string' },
            car_registration: { type: 'string' },
            car_color: { type: 'string' },
            is_available: { type: 'boolean' },
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching driver details');

    const details = await app.db.query.driver_details.findFirst({
      where: eq(schema.driver_details.user_id, session.user.id),
    });

    if (!details) {
      app.logger.info({ userId: session.user.id }, 'Driver details not found');
      return reply.status(404).send({ error: 'Driver details not found' });
    }

    app.logger.info({ userId: session.user.id, driverId: details.id }, 'Driver details retrieved successfully');
    return details;
  });

  // PUT /api/driver/availability - Update driver availability
  fastify.put('/api/driver/availability', {
    schema: {
      description: 'Update driver availability',
      tags: ['driver'],
      body: {
        type: 'object',
        required: ['is_available'],
        properties: {
          is_available: { type: 'boolean' },
        },
      },
      response: {
        200: {
          description: 'Availability updated',
          type: 'object',
          properties: {
            is_available: { type: 'boolean' },
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
    request: FastifyRequest<{ Body: UpdateAvailabilityBody }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { is_available } = request.body;

    app.logger.info({ userId: session.user.id, isAvailable: is_available }, 'Updating driver availability');

    try {
      const details = await app.db.query.driver_details.findFirst({
        where: eq(schema.driver_details.user_id, session.user.id),
      });

      if (!details) {
        app.logger.info({ userId: session.user.id }, 'Driver details not found for update');
        return reply.status(404).send({ error: 'Driver details not found' });
      }

      await app.db.update(schema.driver_details)
        .set({ is_available })
        .where(eq(schema.driver_details.id, details.id));

      app.logger.info({ userId: session.user.id }, 'Driver availability updated successfully');
      return { is_available };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, body: request.body }, 'Failed to update driver availability');
      throw error;
    }
  });

  // GET /api/driver/nearby-requests - Get all pending ride requests
  fastify.get('/api/driver/nearby-requests', {
    schema: {
      description: 'Get nearby pending ride requests',
      tags: ['driver'],
      response: {
        200: {
          description: 'List of pending requests',
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
                  rider_first_name: { type: 'string' },
                  rider_profile_picture_url: { type: ['string', 'null'] },
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

    app.logger.info({ userId: session.user.id }, 'Fetching nearby pending requests');

    try {
      const requests = await app.db.select({
        id: schema.ride_requests.id,
        rider_id: schema.ride_requests.rider_id,
        pickup_location: schema.ride_requests.pickup_location,
        pickup_lat: schema.ride_requests.pickup_lat,
        pickup_lng: schema.ride_requests.pickup_lng,
        destination: schema.ride_requests.destination,
        price_offer: schema.ride_requests.price_offer,
        currency: schema.ride_requests.currency,
        status: schema.ride_requests.status,
        assigned_driver_id: schema.ride_requests.assigned_driver_id,
        driver_attempt_count: schema.ride_requests.driver_attempt_count,
        created_at: schema.ride_requests.created_at,
        updated_at: schema.ride_requests.updated_at,
        rider_first_name: schema.profiles.first_name,
        rider_profile_picture_url: schema.profiles.profile_picture_url,
      })
        .from(schema.ride_requests)
        .innerJoin(schema.profiles, eq(schema.ride_requests.rider_id, schema.profiles.user_id))
        .where(eq(schema.ride_requests.status, 'pending'))
        .orderBy(schema.ride_requests.created_at);

      app.logger.info({ userId: session.user.id, count: requests.length }, 'Pending requests retrieved successfully');
      return { requests };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch nearby requests');
      throw error;
    }
  });

  // GET /api/driver/dashboard - Get driver dashboard stats
  fastify.get('/api/driver/dashboard', {
    schema: {
      description: 'Get driver dashboard statistics',
      tags: ['driver'],
      querystring: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Filter by date (YYYY-MM-DD)' },
        },
      },
      response: {
        200: {
          description: 'Dashboard statistics',
          type: 'object',
          properties: {
            total_rides: { type: 'integer' },
            total_earnings: { type: 'number' },
            total_km: { type: 'number' },
            registration_date: { type: 'string', format: 'date-time' },
            currency: { type: 'string' },
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

    app.logger.info({ userId: session.user.id, date: request.query.date }, 'Fetching driver dashboard');

    try {
      // Get user creation date
      const userRecords = await app.db.select().from(user).where(eq(user.id, session.user.id));
      const userRecord = userRecords[0];
      const registrationDate = userRecord?.createdAt || new Date();

      // Get all ride history for driver
      const allHistory = await app.db.select({
        price_final: schema.ride_history.price_final,
        distance_km: schema.ride_history.distance_km,
        currency: schema.ride_history.currency,
        completed_at: schema.ride_history.completed_at,
      }).from(schema.ride_history)
        .where(eq(schema.ride_history.driver_id, session.user.id));

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

      const totalRides = history.length;
      const totalEarnings = history.reduce((sum, h) => sum + h.price_final, 0);
      const totalKm = history.reduce((sum, h) => sum + (h.distance_km || 0), 0);

      const currencyMap: Record<string, number> = {};
      history.forEach((h) => {
        currencyMap[h.currency] = (currencyMap[h.currency] || 0) + 1;
      });

      const mostCommonCurrency = Object.keys(currencyMap).length > 0
        ? Object.entries(currencyMap).sort(([, a], [, b]) => b - a)[0][0]
        : 'KES';

      app.logger.info({ userId: session.user.id, totalRides }, 'Driver dashboard retrieved successfully');

      return {
        total_rides: totalRides,
        total_earnings: totalEarnings,
        total_km: totalKm,
        registration_date: registrationDate,
        currency: mostCommonCurrency,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, date: request.query.date }, 'Failed to fetch dashboard');
      throw error;
    }
  });
}
