import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, inArray, gte, lte, or, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';
import type { App } from '../index.js';

interface UpsertProfileBody {
  user_type?: 'driver' | 'rider';
  first_name?: string;
  last_name?: string;
  mobile_number?: string;
  country?: 'kenya' | 'tanzania' | 'uganda';
  language?: 'english' | 'swahili' | 'luganda';
  full_name?: string;
  phone?: string;
  role?: 'driver' | 'rider';
  profile_picture_url?: string;
}

// Helper function to normalize role to lowercase 'driver' or 'rider'
function normalizeRole(roleValue: string | null | undefined): 'driver' | 'rider' | null {
  if (!roleValue) return null;
  const normalized = roleValue.toLowerCase();
  // Match any variant containing 'driver' (e.g., 'DRIVER', 'driver_partner', 'Driver')
  if (normalized.includes('driver')) return 'driver';
  // Match any variant containing 'rider' (e.g., 'RIDER', 'Rider')
  if (normalized.includes('rider')) return 'rider';
  return null;
}

// Helper function to normalize language code to enum value
function normalizeLanguage(lang: string | undefined): 'english' | 'swahili' | 'luganda' {
  if (!lang) return 'english';
  const normalized = lang.toLowerCase();
  if (normalized === 'en' || normalized === 'english') return 'english';
  if (normalized === 'sw' || normalized === 'swahili') return 'swahili';
  if (normalized === 'lg' || normalized === 'luganda') return 'luganda';
  return 'english';
}

// Helper function to normalize user_type and role fields
// Uses user_type as primary source, falls back to role, defaults to empty string
function normalizeUserTypeField(user_type: string | null | undefined, role: string | null | undefined): string {
  // Primary source: user_type
  if (user_type) {
    const normalized = user_type.toLowerCase();
    if (normalized.includes('driver')) return 'driver';
    if (normalized.includes('rider')) return 'rider';
  }

  // Fallback: role
  if (role) {
    const normalized = role.toLowerCase();
    if (normalized.includes('driver')) return 'driver';
    if (normalized.includes('rider')) return 'rider';
  }

  // Default to empty string
  return '';
}

export function register(app: App, fastify: FastifyInstance) {
  const requireAuth = app.requireAuth();

  // GET /api/profiles/me - Get current user's profile, create if not exists
  fastify.get('/api/profiles/me', {
    schema: {
      description: 'Get current user profile or create with defaults',
      tags: ['profiles'],
      response: {
        200: {
          description: 'User profile',
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
            full_name: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            role: { type: ['string', 'null'] },
            vehicle_make: { type: ['string', 'null'] },
            vehicle_model: { type: ['string', 'null'] },
            license_plate: { type: ['string', 'null'] },
            national_id: { type: ['string', 'null'] },
            muted: { type: 'boolean' },
            pickup_lat: { type: ['number', 'null'] },
            pickup_lng: { type: ['number', 'null'] },
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

    app.logger.info({ userId: session.user.id }, 'Fetching user profile');

    try {
      // Fetch profile
      let profile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, session.user.id),
      });

      // If no profile exists, create one with defaults
      if (!profile) {
        app.logger.info({ userId: session.user.id }, 'Profile not found, creating with defaults');

        const userEmail = session.user.email || '';
        const emailPrefix = userEmail.split('@')[0] || '';

        // Get first valid enum values for country and language
        const countryEnums = await app.db.execute(
          sql`SELECT enumlabel FROM pg_enum WHERE enumtypid = 'country'::regtype ORDER BY enumsortorder LIMIT 1`
        );
        const languageEnums = await app.db.execute(
          sql`SELECT enumlabel FROM pg_enum WHERE enumtypid = 'language'::regtype ORDER BY enumsortorder LIMIT 1`
        );

        const defaultCountry = (countryEnums as any)?.[0]?.enumlabel || 'kenya';
        const defaultLanguage = (languageEnums as any)?.[0]?.enumlabel || 'english';

        const profileId = uuidv4();
        const [created] = await app.db.insert(schema.profiles).values({
          id: profileId,
          user_id: session.user.id,
          user_type: 'rider',
          full_name: emailPrefix,
          first_name: emailPrefix,
          last_name: '',
          role: 'passenger',
          resident_district: '',
          country: defaultCountry as any,
          language: defaultLanguage as any,
          created_at: new Date(),
        }).returning();
        profile = created;

        app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile created with defaults');
      }

      app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile retrieved successfully');
      return reply.send(profile);
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch profile');
      throw error;
    }
  });

  // POST /api/profiles - Upsert profile for authenticated user
  fastify.post('/api/profiles', {
    schema: {
      description: 'Upsert user profile',
      tags: ['profiles'],
      body: {
        type: 'object',
        properties: {
          full_name: { type: 'string' },
          phone: { type: 'string' },
          role: { type: 'string' },
          user_type: { type: 'string' },
          vehicle_make: { type: 'string' },
          vehicle_model: { type: 'string' },
          license_plate: { type: 'string' },
          national_id: { type: 'string' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          mobile_number: { type: 'string' },
          resident_district: { type: 'string' },
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
            full_name: { type: ['string', 'null'] },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            phone: { type: ['string', 'null'] },
            mobile_number: { type: ['string', 'null'] },
            role: { type: ['string', 'null'] },
            vehicle_make: { type: ['string', 'null'] },
            vehicle_model: { type: ['string', 'null'] },
            license_plate: { type: ['string', 'null'] },
            national_id: { type: ['string', 'null'] },
            resident_district: { type: 'string' },
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
    request: FastifyRequest<{ Body: Record<string, any> }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Upserting profile');

    try {
      let profile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, session.user.id),
      });

      // Build update object from request body
      const updates: Record<string, any> = {};
      const updateFields = ['full_name', 'phone', 'role', 'user_type', 'vehicle_make', 'vehicle_model', 'license_plate', 'national_id', 'first_name', 'last_name', 'mobile_number', 'resident_district'];

      for (const field of updateFields) {
        if (request.body[field] !== undefined) {
          updates[field] = request.body[field];
        }
      }

      if (!profile) {
        app.logger.info({ userId: session.user.id }, 'Profile not found, creating with defaults');

        const userEmail = session.user.email || '';
        const emailPrefix = userEmail.split('@')[0] || '';

        // Get first valid enum values for country and language
        const countryEnums = await app.db.execute(
          sql`SELECT enumlabel FROM pg_enum WHERE enumtypid = 'country'::regtype ORDER BY enumsortorder LIMIT 1`
        );
        const languageEnums = await app.db.execute(
          sql`SELECT enumlabel FROM pg_enum WHERE enumtypid = 'language'::regtype ORDER BY enumsortorder LIMIT 1`
        );

        const defaultCountry = (countryEnums as any)?.[0]?.enumlabel || 'kenya';
        const defaultLanguage = (languageEnums as any)?.[0]?.enumlabel || 'english';

        const profileId = uuidv4();
        const [created] = await app.db.insert(schema.profiles).values({
          id: profileId,
          user_id: session.user.id,
          user_type: updates.user_type || 'rider',
          full_name: updates.full_name || emailPrefix,
          first_name: updates.first_name || emailPrefix,
          last_name: updates.last_name || '',
          phone: updates.phone || null,
          mobile_number: updates.mobile_number || null,
          role: updates.role || 'passenger',
          vehicle_make: updates.vehicle_make || null,
          vehicle_model: updates.vehicle_model || null,
          license_plate: updates.license_plate || null,
          national_id: updates.national_id || null,
          resident_district: updates.resident_district || '',
          country: defaultCountry as any,
          language: defaultLanguage as any,
          created_at: new Date(),
        }).returning();
        profile = created;
        app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile created with defaults');
      } else if (Object.keys(updates).length > 0) {
        // Update existing profile with provided fields
        const [updated] = await app.db.update(schema.profiles)
          .set(updates)
          .where(eq(schema.profiles.user_id, session.user.id))
          .returning();
        profile = updated;
        app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile updated');
      }

      app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile upserted successfully');
      return reply.send(profile);
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, body: request.body }, 'Failed to upsert profile');
      throw error;
    }
  });

  // PATCH /api/profiles/me - Update current user's profile (create if not exists)
  fastify.patch('/api/profiles/me', {
    schema: {
      description: 'Update user profile or create with defaults if not exists',
      tags: ['profiles'],
      body: {
        type: 'object',
        properties: {
          full_name: { type: 'string' },
          phone: { type: 'string' },
          role: { type: 'string' },
          user_type: { type: 'string' },
          vehicle_make: { type: 'string' },
          vehicle_model: { type: 'string' },
          license_plate: { type: 'string' },
          national_id: { type: 'string' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          mobile_number: { type: 'string' },
          resident_district: { type: 'string' },
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
            full_name: { type: ['string', 'null'] },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            phone: { type: ['string', 'null'] },
            mobile_number: { type: ['string', 'null'] },
            role: { type: ['string', 'null'] },
            vehicle_make: { type: ['string', 'null'] },
            vehicle_model: { type: ['string', 'null'] },
            license_plate: { type: ['string', 'null'] },
            national_id: { type: ['string', 'null'] },
            resident_district: { type: 'string' },
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
    request: FastifyRequest<{ Body: Record<string, any> }>,
    reply: FastifyReply,
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Patching profile');

    try {
      let profile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, session.user.id),
      });

      // If no profile exists, create one with defaults first
      if (!profile) {
        app.logger.info({ userId: session.user.id }, 'Profile not found, creating with defaults');

        const userEmail = session.user.email || '';
        const emailPrefix = userEmail.split('@')[0] || '';

        // Get first valid enum values for country and language
        const countryEnums = await app.db.execute(
          sql`SELECT enumlabel FROM pg_enum WHERE enumtypid = 'country'::regtype ORDER BY enumsortorder LIMIT 1`
        );
        const languageEnums = await app.db.execute(
          sql`SELECT enumlabel FROM pg_enum WHERE enumtypid = 'language'::regtype ORDER BY enumsortorder LIMIT 1`
        );

        const defaultCountry = (countryEnums as any)?.[0]?.enumlabel || 'kenya';
        const defaultLanguage = (languageEnums as any)?.[0]?.enumlabel || 'english';

        const profileId = uuidv4();
        const [created] = await app.db.insert(schema.profiles).values({
          id: profileId,
          user_id: session.user.id,
          user_type: 'rider',
          full_name: emailPrefix,
          first_name: emailPrefix,
          last_name: '',
          role: 'passenger',
          resident_district: '',
          country: defaultCountry as any,
          language: defaultLanguage as any,
          created_at: new Date(),
        }).returning();
        profile = created;
        app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile created with defaults');
      }

      // Build update object from request body - only include fields present in body
      const updates: Record<string, any> = {};
      const updateFields = ['full_name', 'phone', 'role', 'user_type', 'vehicle_make', 'vehicle_model', 'license_plate', 'national_id', 'first_name', 'last_name', 'mobile_number', 'resident_district'];

      for (const field of updateFields) {
        if (request.body[field] !== undefined) {
          updates[field] = request.body[field];
        }
      }

      // Apply patches if there are any updates
      let updated = profile;
      if (Object.keys(updates).length > 0) {
        const [patchedProfile] = await app.db.update(schema.profiles)
          .set(updates)
          .where(eq(schema.profiles.user_id, session.user.id))
          .returning();
        updated = patchedProfile;
        app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile patched');
      }

      app.logger.info({ userId: session.user.id, profileId: updated.id }, 'Profile update completed successfully');
      return reply.send(updated);
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, body: request.body }, 'Failed to patch profile');
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
          user_type: normalizedRole,
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
            role: { type: 'string', description: 'Normalized role: either "driver" or "rider"' },
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
      const profile = await app.db.query.profiles.findFirst({
        where: eq(schema.profiles.user_id, userId),
      });

      // If profile doesn't exist, return 404
      if (!profile) {
        app.logger.info({ userId }, 'Profile not found');
        return reply.status(404).send({ message: 'Profile not found' });
      }

      // Compute normalized role: prefer user_type (authoritative), fallback to role, default to 'rider'
      let normalizedRole = normalizeRole(profile.user_type);
      if (!normalizedRole) {
        normalizedRole = normalizeRole(profile.role);
      }
      // Ensure role is always 'driver' or 'rider', never null
      if (!normalizedRole) {
        normalizedRole = 'rider';
      }

      app.logger.info({ userId, profileId: profile.id, role: normalizedRole }, 'User profile retrieved successfully');
      return reply.status(200).send({
        ...profile,
        user_type: profile.user_type,
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
