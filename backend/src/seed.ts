import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { createId } from '@paralleldrive/cuid2';

const schema = { ...appSchema, ...authSchema };
const app = await createApplication(schema);
app.withAuth();

async function seed() {
  console.log('Starting seed...');

  try {
    // Create test driver user via auth API
    const driverResult = await app.auth.api.signUpEmail({
      body: {
        email: 'driver@example.com',
        password: 'driver123',
        name: 'John Driver',
      },
    });

    const driverId = driverResult.user.id;
    console.log('Created driver user:', driverId);

    // Create driver profile
    const driverProfileId = createId();
    await app.db.insert(appSchema.profiles).values({
      id: driverProfileId,
      user_id: driverId,
      user_type: 'driver',
      first_name: 'John',
      last_name: 'Driver',
      resident_district: 'Westlands',
      country: 'kenya',
      language: 'english',
      mobile_number: '+254712345678',
      profile_picture_url: null,
    });

    console.log('Created driver profile');

    // Create driver details
    const driverDetailsId = createId();
    await app.db.insert(appSchema.driver_details).values({
      id: driverDetailsId,
      user_id: driverId,
      car_make: 'Toyota',
      car_registration: 'KCA123A',
      car_color: 'White',
      is_available: true,
    });

    console.log('Created driver details');

    // Create test rider user via auth API
    const riderResult = await app.auth.api.signUpEmail({
      body: {
        email: 'rider@example.com',
        password: 'rider123',
        name: 'Jane Rider',
      },
    });

    const riderId = riderResult.user.id;
    console.log('Created rider user:', riderId);

    // Create rider profile
    const riderProfileId = createId();
    await app.db.insert(appSchema.profiles).values({
      id: riderProfileId,
      user_id: riderId,
      user_type: 'rider',
      first_name: 'Jane',
      last_name: 'Rider',
      resident_district: 'CBD',
      country: 'kenya',
      language: 'english',
      mobile_number: '+254787654321',
      profile_picture_url: null,
    });

    console.log('Created rider profile');

    // Create sample ride requests
    const now = new Date();

    // Pending ride
    const pendingRideId = createId();
    await app.db.insert(appSchema.ride_requests).values({
      id: pendingRideId,
      rider_id: riderId,
      pickup_location: 'Westlands, Nairobi',
      pickup_lat: -1.2921,
      pickup_lng: 36.8219,
      destination: 'CBD, Nairobi',
      price_offer: 350,
      currency: 'KES',
      status: 'pending',
      driver_attempt_count: 0,
      created_at: new Date(now.getTime() - 10 * 60000),
      updated_at: new Date(now.getTime() - 10 * 60000),
    });

    console.log('Created pending ride request');

    // Bargaining ride
    const bargainingRideId = createId();
    await app.db.insert(appSchema.ride_requests).values({
      id: bargainingRideId,
      rider_id: riderId,
      pickup_location: 'Karen, Nairobi',
      pickup_lat: -1.3549,
      pickup_lng: 36.6753,
      destination: 'JKIA Airport, Nairobi',
      price_offer: 1200,
      currency: 'KES',
      status: 'bargaining',
      driver_attempt_count: 0,
      created_at: new Date(now.getTime() - 5 * 60000),
      updated_at: new Date(now.getTime() - 5 * 60000),
    });

    console.log('Created bargaining ride request');

    // Create a bargain for the bargaining ride
    const bargainId = createId();
    await app.db.insert(appSchema.ride_bargains).values({
      id: bargainId,
      ride_request_id: bargainingRideId,
      driver_id: driverId,
      bargain_percentage: 25,
      bargain_price: 1500,
      status: 'pending',
    });

    console.log('Created bargain');

    // Accepted ride
    const acceptedRideId = createId();
    await app.db.insert(appSchema.ride_requests).values({
      id: acceptedRideId,
      rider_id: riderId,
      pickup_location: 'Kololo, Kampala',
      pickup_lat: 0.4033,
      pickup_lng: 32.5830,
      destination: 'Owino Market, Kampala',
      price_offer: 8000,
      currency: 'UGX',
      status: 'accepted',
      assigned_driver_id: driverId,
      driver_attempt_count: 0,
      created_at: new Date(now.getTime() - 2 * 60000),
      updated_at: new Date(now.getTime() - 2 * 60000),
    });

    console.log('Created accepted ride request');

    // Completed ride (for ride history)
    const completedRideId = createId();
    await app.db.insert(appSchema.ride_requests).values({
      id: completedRideId,
      rider_id: riderId,
      pickup_location: 'Masaki, Dar es Salaam',
      pickup_lat: -6.7924,
      pickup_lng: 39.2083,
      destination: 'Kariakoo, Dar es Salaam',
      price_offer: 5000,
      currency: 'TZS',
      status: 'completed',
      assigned_driver_id: driverId,
      driver_attempt_count: 0,
      created_at: new Date(now.getTime() - 60 * 60000),
      updated_at: new Date(now.getTime() - 30 * 60000),
    });

    console.log('Created completed ride request');

    // Create ride history record
    const historyId = createId();
    await app.db.insert(appSchema.ride_history).values({
      id: historyId,
      ride_request_id: completedRideId,
      driver_id: driverId,
      rider_id: riderId,
      price_final: 5000,
      currency: 'TZS',
      distance_km: 12.5,
      completed_at: new Date(now.getTime() - 30 * 60000),
    });

    console.log('Created ride history record');

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
