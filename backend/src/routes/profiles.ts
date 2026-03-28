import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, inArray, gte, lte, or } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';
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
  phone?: string;
  profile_picture_url?: string;
}

// Helper function to normalize role to lowercase 'driver' or 'rider'
function normalizeRole(roleValue: string | null | undefined): 'driver' | 'rider' | null {
  if (!roleValue) return null;
  const normalized = roleValue.toLowerCase();
  if (normalized === 'driver') return 'driver';
  if (normalized === 'rider') return 'rider';
  return null;
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
            role: { type: ['string', 'null'] },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            resident_district: { type: 'string' },
            phone: { type: ['string', 'null'] },
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

    // Compute normalized role: check role column first, fall back to user_type
    const normalizedRole = profile.role
      ? normalizeRole(profile.role)
      : normalizeRole(profile.user_type);

    app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile retrieved successfully');
    // Return response with normalized role and phone field using COALESCE logic
    return reply.send({
      ...profile,
      role: normalizedRole,
      phone: profile.phone || profile.mobile_number,
    });
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
            role: { type: ['string', 'null'] },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            resident_district: { type: 'string' },
            phone: { type: ['string', 'null'] },
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
            phone: phone,
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
          phone: phone,
          profile_picture_url: null,
        }).returning();
        profile = created;
      }

      // Compute normalized role for response
      const normalizedRole = profile.role
        ? normalizeRole(profile.role)
        : normalizeRole(profile.user_type);

      app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile upserted successfully');
      return reply.send({
        ...profile,
        role: normalizedRole,
        phone: profile.phone || profile.mobile_number,
      });
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
          phone: { type: 'string' },
          profile_picture_url: { type: 'string' },
          role: { type: 'string', enum: ['driver', 'rider'] },
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
            role: { type: ['string', 'null'] },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            resident_district: { type: 'string' },
            phone: { type: ['string', 'null'] },
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
    request: FastifyRequest<{ Body: UpdateProfileBody & { role?: string } }>,
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

      // Handle phone updates - write to both columns
      if (request.body.phone !== undefined) {
        updates.phone = request.body.phone || null;
        updates.mobile_number = request.body.phone || null;
      }
      if (request.body.mobile_number !== undefined) {
        updates.mobile_number = request.body.mobile_number || null;
        updates.phone = request.body.mobile_number || null;
      }

      // Handle role updates - write to both role and user_type columns
      if ((request.body as any).role !== undefined) {
        const normalized = normalizeRole((request.body as any).role);
        if (normalized) {
          updates.role = normalized;
          updates.user_type = normalized;
        }
      }

      if (request.body.profile_picture_url !== undefined) updates.profile_picture_url = request.body.profile_picture_url || null;

      const [updated] = await app.db.update(schema.profiles)
        .set(updates)
        .where(eq(schema.profiles.id, profile.id))
        .returning();

      // Compute normalized role for response
      const normalizedRole = updated.role
        ? normalizeRole(updated.role)
        : normalizeRole(updated.user_type);

      app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile updated successfully');
      return reply.send({
        ...updated,
        role: normalizedRole,
        phone: updated.phone || updated.mobile_number,
      });
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, body: request.body }, 'Failed to update profile');
      throw error;
    }
  });

  // PUT /api/profile - Update authenticated user's profile
  fastify.put('/api/profile', {
    schema: {
      description: 'Update authenticated user profile',
      tags: ['profile'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          role: { type: 'string', enum: ['rider', 'driver'] },
          full_name: { type: 'string' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          resident_district: { type: 'string' },
          mobile_number: { type: 'string' },
          vehicle_make: { type: 'string' },
          vehicle_model: { type: 'string' },
          license_plate: { type: 'string' },
          national_id: { type: 'string' },
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
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            full_name: { type: ['string', 'null'] },
            first_name: { type: ['string', 'null'] },
            last_name: { type: ['string', 'null'] },
            resident_district: { type: ['string', 'null'] },
            mobile_number: { type: ['string', 'null'] },
            vehicle_make: { type: ['string', 'null'] },
            vehicle_model: { type: ['string', 'null'] },
            license_plate: { type: ['string', 'null'] },
            profile_picture_url: { type: ['string', 'null'] },
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
  }, async (request: FastifyRequest<{ Body: Record<string, any> }>, reply: FastifyReply) => {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      app.logger.warn({}, 'Missing or invalid Authorization header for profile update');
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    app.logger.info({ tokenPresent: true }, 'Extracted Bearer token for profile update');

    try {
      // Query session by token and check expiration
      const sessionRecord = await app.db.query.session.findFirst({
        where: and(
          eq(authSchema.session.token, token),
          gte(authSchema.session.expiresAt, new Date())
        ),
      });

      if (!sessionRecord) {
        app.logger.warn({ tokenPresent: true }, 'Session not found or expired for profile update');
        return reply.status(401).send({ message: 'Unauthorized' });
      }

      const userId = sessionRecord.userId;
      app.logger.info({ userId }, 'Updating user profile');

      try {
        // Update user table if name is provided
        if (request.body.name) {
          await app.db.update(authSchema.user)
            .set({ name: request.body.name })
            .where(eq(authSchema.user.id, userId));
        }

        // Build dynamic profile updates
        const profileUpdates: Record<string, any> = {};

        // Handle phone updates - write to both columns
        if (request.body.phone !== undefined) {
          profileUpdates.phone = request.body.phone;
          profileUpdates.mobile_number = request.body.phone;
        }
        if (request.body.mobile_number !== undefined) {
          profileUpdates.mobile_number = request.body.mobile_number;
          profileUpdates.phone = request.body.mobile_number;
        }

        // Handle role updates - write to both role and user_type columns
        if (request.body.role !== undefined) {
          const normalized = normalizeRole(request.body.role);
          if (normalized) {
            profileUpdates.role = normalized;
            profileUpdates.user_type = normalized;
          }
        }
        if (request.body.full_name !== undefined) profileUpdates.full_name = request.body.full_name;
        if (request.body.first_name !== undefined) profileUpdates.first_name = request.body.first_name;
        if (request.body.last_name !== undefined) profileUpdates.last_name = request.body.last_name;
        if (request.body.resident_district !== undefined) profileUpdates.resident_district = request.body.resident_district;
        if (request.body.vehicle_make !== undefined) profileUpdates.vehicle_make = request.body.vehicle_make;
        if (request.body.vehicle_model !== undefined) profileUpdates.vehicle_model = request.body.vehicle_model;
        if (request.body.license_plate !== undefined) profileUpdates.license_plate = request.body.license_plate;
        if (request.body.national_id !== undefined) profileUpdates.national_id = request.body.national_id;
        if (request.body.profile_picture_url !== undefined) profileUpdates.profile_picture_url = request.body.profile_picture_url;

        // Update profile only if there are profile-specific updates
        let updated;
        if (Object.keys(profileUpdates).length > 0) {
          const result = await app.db.update(schema.profiles)
            .set(profileUpdates)
            .where(eq(schema.profiles.user_id, userId))
            .returning();
          [updated] = result;
        } else {
          // If no profile updates, just fetch the current profile
          updated = await app.db.query.profiles.findFirst({
            where: eq(schema.profiles.user_id, userId),
          });
        }

        // Fetch user data
        const user = await app.db.query.user.findFirst({
          where: eq(authSchema.user.id, userId),
        });

        // Compute normalized role for response
        const normalizedRole = updated.role
          ? normalizeRole(updated.role)
          : normalizeRole(updated.user_type);

        const response = {
          ...updated,
          role: normalizedRole,
          name: user?.name,
          email: user?.email,
          phone: updated?.phone || updated?.mobile_number,
        };

        app.logger.info({ userId }, 'Profile updated successfully');
        return reply.status(200).send(response);
      } catch (error) {
        app.logger.error({ err: error, userId }, 'Failed to update profile');
        throw error;
      }
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to update user profile');
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
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      app.logger.warn({}, 'Missing or invalid Authorization header');
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    app.logger.info({ tokenPresent: true }, 'Extracted Bearer token');

    try {
      // Query session by token and check expiration
      const sessionRecord = await app.db.query.session.findFirst({
        where: and(
          eq(authSchema.session.token, token),
          gte(authSchema.session.expiresAt, new Date())
        ),
      });

      if (!sessionRecord) {
        app.logger.warn({ tokenPresent: true }, 'Session not found or expired');
        return reply.status(401).send({ message: 'Unauthorized' });
      }

      const userId = sessionRecord.userId;
      app.logger.info({ userId }, 'Getting user profile');

      // Query profile by user_id
      let profile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, userId),
      });

      // If profile doesn't exist, auto-create one from user data
      if (!profile) {
        app.logger.info({ userId }, 'Profile not found, attempting to create');

        const user = await app.db.query.user.findFirst({
          where: eq(authSchema.user.id, userId),
        });

        if (!user) {
          app.logger.warn({ userId }, 'User not found');
          return reply.status(404).send({ message: 'User not found' });
        }

        // Split user name into first and last name
        const nameParts = (user.name || 'User').trim().split(/\s+/);
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || '';

        const profileId = createId();
        const [created] = await app.db.insert(schema.profiles).values({
          id: profileId,
          user_id: userId,
          user_type: 'rider', // default to rider
          first_name: firstName,
          last_name: lastName,
          full_name: user.name,
          resident_district: 'Kampala',
          country: 'uganda', // default to Uganda
          language: 'english', // default to English
          profile_picture_url: user.image,
          role: 'rider',
        }).returning();

        profile = created;
        app.logger.info({ userId, profileId }, 'Profile auto-created successfully');
      }

      // Compute normalized role: check role column first, fall back to user_type
      const normalizedRole = profile.role
        ? normalizeRole(profile.role)
        : normalizeRole(profile.user_type);

      app.logger.info({ userId, profileId: profile.id }, 'User profile retrieved successfully');
      return reply.status(200).send({
        ...profile,
        role: normalizedRole,
        phone: profile.phone || profile.mobile_number,
      });
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to get user profile');
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
              total_rides: { type: 'integer' },
              completed_rides: { type: 'integer' },
              cancelled_rides: { type: 'integer' },
              total_earnings: { type: 'number' },
              rating: { type: 'number' },
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
      // Extract Bearer token from Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        app.logger.warn({}, 'Missing or invalid Authorization header for ride stats');
        return reply.status(401).send({ message: 'Unauthorized' });
      }

      const token = authHeader.substring(7);
      app.logger.info({ tokenPresent: true }, 'Extracted Bearer token for ride stats');

      try {
        // Query session by token and check expiration
        const sessionRecord = await app.db.query.session.findFirst({
          where: and(
            eq(authSchema.session.token, token),
            gte(authSchema.session.expiresAt, new Date())
          ),
        });

        if (!sessionRecord) {
          app.logger.warn({ tokenPresent: true }, 'Session not found or expired for ride stats');
          return reply.status(401).send({ message: 'Unauthorized' });
        }

        const userId = sessionRecord.userId;
        app.logger.info({ userId }, 'Getting ride statistics');

        // Get all rides where user is rider or driver
        const allRides = await app.db.query.rides.findMany({
          where: or(
            eq(schema.rides.rider_id, userId),
            eq(schema.rides.driver_id, userId)
          ),
        });

        // Calculate statistics
        const totalRides = allRides.length;
        const completedRides = allRides.filter(r => r.status === 'completed').length;
        const cancelledRides = allRides.filter(r => r.status === 'cancelled').length;

        // Calculate earnings (sum of fare where user is driver and ride is completed)
        const driverRides = allRides.filter(r => r.driver_id === userId && r.status === 'completed');
        const totalEarnings = driverRides.reduce((sum, ride) => sum + (ride.fare || 0), 0);

        // Get profile to determine user role
        const profile = await app.db.query.profiles.findFirst({
          where: eq(schema.profiles.user_id, userId),
        });

        app.logger.info(
          {
            userId,
            totalRides,
            completedRides,
            cancelledRides,
            totalEarnings,
          },
          'Ride statistics retrieved successfully'
        );

        return reply.status(200).send({
          total_rides: totalRides,
          completed_rides: completedRides,
          cancelled_rides: cancelledRides,
          total_earnings: totalEarnings,
          rating: 4.8,
        });
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to get ride statistics');
        throw error;
      }
    }
  );
}
