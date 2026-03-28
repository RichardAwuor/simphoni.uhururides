import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, inArray, gte, lte, or } from 'drizzle-orm';
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

  // GET /api/profile - Get authenticated user's profile
  fastify.get('/api/profile', {
    schema: {
      description: 'Get authenticated user profile',
      tags: ['profile'],
      response: {
        200: {
          description: 'User profile',
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            user_type: { type: ['string', 'null'] },
            first_name: { type: ['string', 'null'] },
            last_name: { type: ['string', 'null'] },
            full_name: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            mobile_number: { type: ['string', 'null'] },
            role: { type: ['string', 'null'] },
            resident_district: { type: ['string', 'null'] },
            country: { type: ['string', 'null'] },
            language: { type: ['string', 'null'] },
            profile_picture_url: { type: ['string', 'null'] },
            vehicle_make: { type: ['string', 'null'] },
            vehicle_model: { type: ['string', 'null'] },
            license_plate: { type: ['string', 'null'] },
            national_id: { type: ['string', 'null'] },
            created_at: { type: 'string', format: 'date-time' },
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Getting user profile');

    try {
      const profile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, userId),
      });

      if (!profile) {
        app.logger.info({ userId }, 'Profile not found');
        return reply.status(404).send({ message: 'Profile not found' });
      }

      app.logger.info({ userId, profileId: profile.id }, 'User profile retrieved successfully');
      return reply.status(200).send(profile);
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
        response: {
          200: {
            description: 'Ride statistics',
            type: 'object',
            properties: {
              total_rides_as_rider: { type: 'integer' },
              total_rides_as_driver: { type: 'integer' },
              total_earnings: { type: 'number' },
              total_spent: { type: 'number' },
              completed_rides_as_rider: { type: 'integer' },
              completed_rides_as_driver: { type: 'integer' },
            },
          },
          401: {
            type: 'object',
            properties: { message: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      app.logger.info({ userId }, 'Getting ride statistics');

      try {
        // Count total rides as rider
        const totalRidesAsRider = await app.db.query.ride_requests.findMany({
          where: eq(schema.ride_requests.rider_id, userId),
        });

        // Count total rides as driver (driver_id OR assigned_driver_id)
        const totalRidesAsDriver = await app.db.query.ride_requests.findMany({
          where: or(
            eq(schema.ride_requests.driver_id, userId),
            eq(schema.ride_requests.assigned_driver_id, userId)
          ),
        });

        // Get earnings from ride_history where driver_id = user_id
        const earnings = await app.db.query.ride_history.findMany({
          where: eq(schema.ride_history.driver_id, userId),
        });

        // Get spent from ride_history where rider_id = user_id
        const spent = await app.db.query.ride_history.findMany({
          where: eq(schema.ride_history.rider_id, userId),
        });

        // Count completed rides as rider
        const completedRidesAsRider = totalRidesAsRider.filter(
          (ride) => ride.status === 'completed'
        ).length;

        // Count completed rides as driver
        const completedRidesAsDriver = totalRidesAsDriver.filter(
          (ride) => ride.status === 'completed'
        ).length;

        // Calculate total earnings and spent
        const totalEarnings = earnings.reduce((sum, ride) => sum + (ride.price_final || 0), 0);
        const totalSpent = spent.reduce((sum, ride) => sum + (ride.price_final || 0), 0);

        app.logger.info(
          {
            userId,
            totalRidesAsRider: totalRidesAsRider.length,
            totalRidesAsDriver: totalRidesAsDriver.length,
            totalEarnings,
            totalSpent,
          },
          'Ride statistics retrieved successfully'
        );

        return reply.status(200).send({
          total_rides_as_rider: totalRidesAsRider.length,
          total_rides_as_driver: totalRidesAsDriver.length,
          total_earnings: totalEarnings,
          total_spent: totalSpent,
          completed_rides_as_rider: completedRidesAsRider,
          completed_rides_as_driver: completedRidesAsDriver,
        });
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to get ride statistics');
        throw error;
      }
    }
  );
}
