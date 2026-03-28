import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, inArray, gte, lte } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

interface CreateProfileBody {
  name: string;
  phone: string;
  country: 'kenya' | 'tanzania' | 'uganda';
  language: 'english' | 'swahili' | 'luganda';
  userType: 'driver' | 'rider';
}

interface UpdateProfileBody {
  first_name?: string;
  last_name?: string;
  resident_district?: string;
  mobile_number?: string;
  profile_picture_url?: string;
}

export function register(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // GET /api/profiles/me - Get current user's profile
  fastify.get('/api/profiles/me', {
    schema: {
      description: 'Get current user profile',
      tags: ['profiles'],
      response: {
        200: {
          description: 'User profile',
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            user_type: { type: 'string', enum: ['driver', 'rider'] },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            resident_district: { type: 'string' },
            mobile_number: { type: ['string', 'null'] },
            country: { type: 'string', enum: ['kenya', 'tanzania', 'uganda'] },
            language: { type: 'string', enum: ['english', 'swahili', 'luganda'] },
            profile_picture_url: { type: ['string', 'null'] },
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

    app.logger.info({ userId: session.user.id }, 'Fetching user profile');

    const profile = await app.db.query.profiles.findFirst({
      where: eq(schema.profiles.user_id, session.user.id),
    });

    if (!profile) {
      app.logger.info({ userId: session.user.id }, 'Profile not found');
      return reply.status(404).send({ error: 'Profile not found' });
    }

    app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile retrieved successfully');
    return reply.send(profile);
  });

  // POST /api/profiles/me - Upsert profile for current user
  fastify.post('/api/profiles/me', {
    schema: {
      description: 'Upsert user profile',
      tags: ['profiles'],
      body: {
        type: 'object',
        required: ['name', 'phone', 'country', 'language', 'userType'],
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          country: { type: 'string', enum: ['kenya', 'tanzania', 'uganda'] },
          language: { type: 'string', enum: ['english', 'swahili', 'luganda'] },
          userType: { type: 'string', enum: ['driver', 'rider'] },
        },
      },
      response: {
        200: {
          description: 'Profile upserted',
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            user_type: { type: 'string' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            resident_district: { type: 'string' },
            mobile_number: { type: ['string', 'null'] },
            country: { type: 'string' },
            language: { type: 'string' },
            profile_picture_url: { type: ['string', 'null'] },
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
    request: FastifyRequest<{ Body: CreateProfileBody }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { name, phone, country, language, userType } = request.body;

    app.logger.info(
      { userId: session.user.id, userType },
      'Upserting profile',
    );

    try {
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      const existingProfile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, session.user.id),
      });

      let profile;
      if (existingProfile) {
        const [updated] = await app.db.update(schema.profiles)
          .set({
            user_type: userType,
            first_name: firstName,
            last_name: lastName,
            mobile_number: phone,
            country,
            language,
            resident_district: '',
          })
          .where(eq(schema.profiles.user_id, session.user.id))
          .returning();
        profile = updated;
      } else {
        const profileId = createId();
        const [created] = await app.db.insert(schema.profiles).values({
          id: profileId,
          user_id: session.user.id,
          user_type: userType,
          first_name: firstName,
          last_name: lastName,
          resident_district: '',
          country,
          language,
          mobile_number: phone,
          profile_picture_url: null,
        }).returning();
        profile = created;
      }

      app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile upserted successfully');
      return reply.send(profile);
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, body: request.body }, 'Failed to upsert profile');
      throw error;
    }
  });

  // PUT /api/profiles/me - Update current user's profile
  fastify.put('/api/profiles/me', {
    schema: {
      description: 'Update user profile',
      tags: ['profiles'],
      body: {
        type: 'object',
        properties: {
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          resident_district: { type: 'string' },
          mobile_number: { type: 'string' },
          profile_picture_url: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Profile updated',
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            user_type: { type: 'string' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            resident_district: { type: 'string' },
            mobile_number: { type: ['string', 'null'] },
            country: { type: 'string' },
            language: { type: 'string' },
            profile_picture_url: { type: ['string', 'null'] },
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
    request: FastifyRequest<{ Body: UpdateProfileBody }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Updating profile');

    try {
      const profile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, session.user.id),
      });

      if (!profile) {
        app.logger.info({ userId: session.user.id }, 'Profile not found for update');
        return reply.status(404).send({ error: 'Profile not found' });
      }

      const updates: any = {};
      if (request.body.first_name) updates.first_name = request.body.first_name;
      if (request.body.last_name) updates.last_name = request.body.last_name;
      if (request.body.resident_district) updates.resident_district = request.body.resident_district;
      if (request.body.mobile_number !== undefined) updates.mobile_number = request.body.mobile_number || null;
      if (request.body.profile_picture_url !== undefined) updates.profile_picture_url = request.body.profile_picture_url || null;

      const [updated] = await app.db.update(schema.profiles)
        .set(updates)
        .where(eq(schema.profiles.id, profile.id))
        .returning();

      app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile updated successfully');
      return reply.send(updated);
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, body: request.body }, 'Failed to update profile');
      throw error;
    }
  });

  // GET /api/profile - Get authenticated user profile with combined data
  fastify.get('/api/profile', {
    schema: {
      description: 'Get authenticated user profile',
      tags: ['profile'],
      response: {
        200: {
          description: 'User profile with combined data',
          type: 'object',
          properties: {
            id: { type: 'string' },
            full_name: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            email: { type: 'string' },
            role: { type: ['string', 'null'] },
            vehicle_make: { type: ['string', 'null'] },
            vehicle_model: { type: ['string', 'null'] },
            license_plate: { type: ['string', 'null'] },
            national_id: { type: ['string', 'null'] },
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

    const userId = session.user.id;
    app.logger.info({ userId }, 'Getting user profile');

    try {
      const profile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, userId),
      });

      const fullName =
        profile?.full_name ||
        (profile ? `${profile.first_name} ${profile.last_name}`.trim() : null);
      const phone = profile?.phone || profile?.mobile_number || null;
      const role = profile?.role || profile?.user_type || null;

      const responseData: any = {
        id: userId,
        full_name: fullName,
        phone,
        email: session.user.email,
        role,
        created_at: session.user.createdAt?.toISOString(),
      };

      if (profile) {
        responseData.vehicle_make = profile.vehicle_make || null;
        responseData.vehicle_model = profile.vehicle_model || null;
        responseData.license_plate = profile.license_plate || null;
        responseData.national_id = profile.national_id || null;
      } else {
        responseData.vehicle_make = null;
        responseData.vehicle_model = null;
        responseData.license_plate = null;
        responseData.national_id = null;
      }

      app.logger.info({ userId }, 'User profile retrieved successfully');
      return reply.send(responseData);
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to get user profile');
      throw error;
    }
  });

  // GET /api/ride-stats - Get ride statistics for authenticated user
  fastify.get(
    '/api/ride-stats',
    {
      schema: {
        description: 'Get ride statistics for authenticated user',
        tags: ['stats'],
        querystring: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Start date (ISO 8601)' },
            to: { type: 'string', description: 'End date (ISO 8601)' },
            role: { type: 'string', enum: ['rider', 'driver'], description: 'Filter by role' },
          },
        },
        response: {
          200: {
            description: 'Ride statistics',
            type: 'object',
            properties: {
              total_rides: { type: 'integer' },
              total_earnings: { type: 'number' },
              total_distance_km: { type: 'number' },
              registration_date: { type: 'string', format: 'date-time' },
              rides: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    pickup_location: { type: 'string' },
                    destination: { type: 'string' },
                    distance_km: { type: ['number', 'null'] },
                    price_offer: { type: 'number' },
                    bargain_price: { type: ['number', 'null'] },
                    final_price: { type: 'number' },
                    currency: { type: 'string' },
                    status: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' },
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
    },
    async (
      request: FastifyRequest<{
        Querystring: { from?: string; to?: string; role?: string };
      }>,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { from, to, role: queryRole } = request.query as any;
      app.logger.info(
        { userId, from, to, role: queryRole },
        'Getting ride statistics'
      );

      try {
        // Determine effective role
        let effectiveRole = queryRole;
        if (!effectiveRole) {
          const profile = await app.db.query.profiles.findFirst({
            where: eq(schema.profiles.user_id, userId),
          });
          effectiveRole =
            profile?.role || profile?.user_type || 'rider';
        }

        // Build date filters
        const dateFilters: any = {};
        if (from) {
          dateFilters.fromDate = new Date(from);
        }
        if (to) {
          dateFilters.toDate = new Date(to);
        }

        // Query rides based on role
        let rides;
        if (effectiveRole === 'driver') {
          const conditions = [
            eq(schema.ride_requests.driver_id, userId),
            inArray(schema.ride_requests.status, ['accepted', 'completed']),
          ];
          if (dateFilters.fromDate) {
            conditions.push(gte(schema.ride_requests.created_at, dateFilters.fromDate));
          }
          if (dateFilters.toDate) {
            conditions.push(lte(schema.ride_requests.created_at, dateFilters.toDate));
          }
          rides = await app.db.query.ride_requests.findMany({
            where: and(...conditions),
          });
        } else {
          const conditions = [
            eq(schema.ride_requests.rider_id, userId),
            inArray(schema.ride_requests.status, [
              'accepted',
              'completed',
              'cancelled',
            ]),
          ];
          if (dateFilters.fromDate) {
            conditions.push(gte(schema.ride_requests.created_at, dateFilters.fromDate));
          }
          if (dateFilters.toDate) {
            conditions.push(lte(schema.ride_requests.created_at, dateFilters.toDate));
          }
          rides = await app.db.query.ride_requests.findMany({
            where: and(...conditions),
          });
        }

        // Calculate statistics
        let totalEarnings = 0;
        let totalDistance = 0;
        const formattedRides = rides.map((ride) => {
          const finalPrice =
            ride.bargain_price !== null
              ? ride.bargain_price
              : ride.price_offer;
          totalEarnings += finalPrice;
          totalDistance += ride.distance_km || 0;

          return {
            id: ride.id,
            pickup_location: ride.pickup_location,
            destination: ride.destination,
            distance_km: ride.distance_km,
            price_offer: ride.price_offer,
            bargain_price: ride.bargain_price,
            final_price: finalPrice,
            currency: ride.currency,
            status: ride.status,
            created_at: ride.created_at?.toISOString(),
          };
        });

        app.logger.info(
          {
            userId,
            role: effectiveRole,
            totalRides: rides.length,
            totalEarnings,
          },
          'Ride statistics retrieved successfully'
        );

        return reply.send({
          total_rides: rides.length,
          total_earnings: totalEarnings,
          total_distance_km: totalDistance,
          registration_date: session.user.createdAt?.toISOString(),
          rides: formattedRides,
        });
      } catch (error) {
        app.logger.error(
          { err: error, userId, from, to, role: queryRole },
          'Failed to get ride statistics'
        );
        throw error;
      }
    }
  );
}
