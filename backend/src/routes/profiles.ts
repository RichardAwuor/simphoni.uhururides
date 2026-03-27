import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

interface CreateProfileBody {
  user_type: 'driver' | 'rider';
  first_name: string;
  last_name: string;
  resident_district: string;
  country: 'kenya' | 'tanzania' | 'uganda';
  language: 'english' | 'swahili' | 'luganda';
  mobile_number?: string;
  profile_picture_url?: string;
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
    return profile;
  });

  // POST /api/profiles/me - Create profile for current user
  fastify.post('/api/profiles/me', {
    schema: {
      description: 'Create user profile',
      tags: ['profiles'],
      body: {
        type: 'object',
        required: ['user_type', 'first_name', 'last_name', 'resident_district', 'country', 'language'],
        properties: {
          user_type: { type: 'string', enum: ['driver', 'rider'] },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          resident_district: { type: 'string' },
          country: { type: 'string', enum: ['kenya', 'tanzania', 'uganda'] },
          language: { type: 'string', enum: ['english', 'swahili', 'luganda'] },
          mobile_number: { type: 'string' },
          profile_picture_url: { type: 'string' },
        },
      },
      response: {
        201: {
          description: 'Profile created',
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

    const { user_type, first_name, last_name, resident_district, country, language, mobile_number, profile_picture_url } = request.body;

    app.logger.info(
      { userId: session.user.id, userType: user_type },
      'Creating profile',
    );

    try {
      const profileId = createId();
      const [profile] = await app.db.insert(schema.profiles).values({
        id: profileId,
        user_id: session.user.id,
        user_type,
        first_name,
        last_name,
        resident_district,
        country,
        language,
        mobile_number: mobile_number || null,
        profile_picture_url: profile_picture_url || null,
      }).returning();

      app.logger.info({ userId: session.user.id, profileId: profile.id }, 'Profile created successfully');
      return reply.status(201).send(profile);
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, body: request.body }, 'Failed to create profile');
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
      return updated;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id, body: request.body }, 'Failed to update profile');
      throw error;
    }
  });
}
