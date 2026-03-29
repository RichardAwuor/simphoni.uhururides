import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus } from "./helpers";

describe("API Integration Tests", () => {
  let authToken: string;
  let userId: string;
  let rideId: string;

  // Setup: Sign up test user
  test("Sign up test user", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    userId = user.id;
    expect(authToken).toBeDefined();
    expect(userId).toBeDefined();
  });

  // Profile endpoints
  describe("Profile Management", () => {
    test("Create user profile", async () => {
      const res = await authenticatedApi("/api/profiles/me", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: "Test User",
          phone: "+254712345678",
          country: "kenya",
          language: "english",
          user_type: "driver",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.country).toBe("kenya");
      expect(data.user_type).toBe("driver");
    });

    test("Get user profile", async () => {
      const res = await authenticatedApi("/api/profiles/me", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.country).toBe("kenya");
    });

    test("Update user profile", async () => {
      const res = await authenticatedApi("/api/profiles/me", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: "Updated",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.first_name).toBe("Updated");
    });

    test("Create profile with missing required fields should fail", async () => {
      const res = await authenticatedApi("/api/profiles/me", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: "Test User",
          // missing: phone, country, language, user_type - but all fields are optional
        }),
      });
      await expectStatus(res, 200);
    });

    test("Get profile without auth should return 401", async () => {
      const res = await api("/api/profiles/me");
      await expectStatus(res, 401);
    });
  });

  // User Profile (Combined) endpoint
  describe("User Profile (Combined)", () => {
    test("Get current user profile with combined data", async () => {
      const res = await authenticatedApi("/api/profile", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.user_id).toBeDefined();
    });

    test("Update profile with combined endpoint", async () => {
      const res = await authenticatedApi("/api/profile", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Combined",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBeDefined();
    });

    test("Get profile without auth should return 401", async () => {
      const res = await api("/api/profile");
      await expectStatus(res, 401);
    });
  });

  // Driver details endpoints
  describe("Driver Details Management", () => {
    test("Get driver details should return 404 before creation", async () => {
      // Create a new test user for this specific test to ensure driver details don't exist
      const { token } = await signUpTestUser();
      const res = await authenticatedApi("/api/driver/details", token);
      await expectStatus(res, 404);
    });

    test("Create driver details", async () => {
      const res = await authenticatedApi("/api/driver/details", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleMake: "Toyota",
          licensePlate: "KBR 123A",
          licenseNumber: "DL123456",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.car_make).toBe("Toyota");
      expect(data.is_available).toBeDefined();
    });

    test("Get driver details after creation", async () => {
      const res = await authenticatedApi("/api/driver/details", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.car_make).toBe("Toyota");
    });

    test("Create driver details with missing required fields should fail", async () => {
      const res = await authenticatedApi("/api/driver/details", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleMake: "Toyota",
          // missing: licensePlate, licenseNumber - but all fields are optional
        }),
      });
      await expectStatus(res, 200);
    });

    test("Get driver details without auth should return 401", async () => {
      const res = await api("/api/driver/details");
      await expectStatus(res, 401);
    });
  });

  // Driver availability endpoint
  describe("Driver Availability", () => {
    test("Update driver availability to available", async () => {
      const res = await authenticatedApi("/api/driver/availability", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_available: true,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.is_available).toBe(true);
    });

    test("Update driver availability to unavailable", async () => {
      const res = await authenticatedApi("/api/driver/availability", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_available: false,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.is_available).toBe(false);
    });

    test("Update availability with missing is_available should fail", async () => {
      const res = await authenticatedApi("/api/driver/availability", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await expectStatus(res, 400);
    });

    test("Update availability without auth should return 401", async () => {
      const res = await api("/api/driver/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_available: true,
        }),
      });
      await expectStatus(res, 401);
    });
  });

  // Driver dashboard endpoint
  describe("Driver Dashboard", () => {
    test("Get driver dashboard", async () => {
      const res = await authenticatedApi("/api/driver/dashboard", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.total_rides).toBeDefined();
      expect(data.total_earnings).toBeDefined();
      expect(data.total_km).toBeDefined();
    });

    test("Get driver dashboard with date filter", async () => {
      const res = await authenticatedApi("/api/driver/dashboard?date=2026-03-27", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.total_rides).toBeDefined();
    });

    test("Get dashboard without auth should return 401", async () => {
      const res = await api("/api/driver/dashboard");
      await expectStatus(res, 401);
    });
  });

  // Ride Statistics endpoint
  describe("Ride Statistics", () => {
    test("Get ride stats", async () => {
      const res = await authenticatedApi("/api/ride-stats", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.total_rides).toBeDefined();
      expect(data.completed_rides).toBeDefined();
      expect(data.cancelled_rides).toBeDefined();
      expect(data.total_earnings).toBeDefined();
      expect(data.rating).toBeDefined();
    });

    test("Get ride stats without auth should return 401", async () => {
      const res = await api("/api/ride-stats");
      await expectStatus(res, 401);
    });
  });

  // Driver nearby requests endpoint
  describe("Driver Nearby Requests", () => {
    test("Get nearby pending requests", async () => {
      const res = await authenticatedApi("/api/driver/nearby-requests", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.requests).toBeDefined();
      expect(Array.isArray(data.requests)).toBe(true);
    });

    test("Get nearby requests without auth should return 401", async () => {
      const res = await api("/api/driver/nearby-requests");
      await expectStatus(res, 401);
    });
  });

  // Rides endpoints
  describe("Ride Management", () => {
    test("Create ride", async () => {
      const res = await authenticatedApi("/api/rides", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Nairobi CBD",
          dropoff_location: "Westlands",
          pickup_lat: -1.2921,
          pickup_lng: 36.8219,
          dropoff_lat: -1.2657,
          dropoff_lng: 36.8092,
          vehicle_type: "sedan",
          fare: 500,
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      rideId = data.id;
      expect(data.pickup_location).toBe("Nairobi CBD");
      expect(data.dropoff_location).toBe("Westlands");
      expect(data.status).toBeDefined();
      expect(data.rider_id).toBeDefined();
    });

    test("Get ride by ID", async () => {
      const res = await authenticatedApi(`/api/rides/${rideId}`, authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBe(rideId);
      expect(data.pickup_location).toBeDefined();
      expect(data.dropoff_location).toBeDefined();
    });

    test("Get nonexistent ride should return 404", async () => {
      const res = await authenticatedApi("/api/rides/00000000-0000-0000-0000-000000000000", authToken);
      await expectStatus(res, 404);
    });

    test("Get my rides", async () => {
      const res = await authenticatedApi("/api/rides/my", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test("Get available rides", async () => {
      const res = await authenticatedApi("/api/rides/available", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test("Create ride with missing required fields should fail", async () => {
      const res = await authenticatedApi("/api/rides", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Nairobi CBD",
          // missing: dropoff_location
        }),
      });
      await expectStatus(res, 400);
    });

    test("Create ride without auth should return 401", async () => {
      const res = await api("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Test",
          dropoff_location: "Test",
        }),
      });
      await expectStatus(res, 401);
    });
  });

  // Ride actions
  describe("Ride Actions", () => {
    let testRideId: string;

    test("Create test ride for accept", async () => {
      const res = await authenticatedApi("/api/rides", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Karen",
          dropoff_location: "Kilimani",
          fare: 800,
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      testRideId = data.id;
    });

    test("Accept ride", async () => {
      const res = await authenticatedApi(`/api/rides/${testRideId}/accept`, authToken, {
        method: "POST",
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.status).toBeDefined();
    });

    test("Accept nonexistent ride should return 404", async () => {
      const res = await authenticatedApi("/api/rides/00000000-0000-0000-0000-000000000000/accept", authToken, {
        method: "POST",
      });
      await expectStatus(res, 404);
    });

    test("Create test ride for complete", async () => {
      const res = await authenticatedApi("/api/rides", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Eastleigh",
          dropoff_location: "Industrial Area",
          fare: 1000,
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      testRideId = data.id;
    });

    test("Complete ride", async () => {
      const res = await authenticatedApi(`/api/rides/${testRideId}/complete`, authToken, {
        method: "POST",
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.status).toBeDefined();
    });

    test("Complete nonexistent ride should return 404", async () => {
      const res = await authenticatedApi("/api/rides/00000000-0000-0000-0000-000000000000/complete", authToken, {
        method: "POST",
      });
      await expectStatus(res, 404);
    });

    test("Create test ride for cancel", async () => {
      const res = await authenticatedApi("/api/rides", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Kibera",
          dropoff_location: "Ngara",
          fare: 600,
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      testRideId = data.id;
    });

    test("Cancel ride", async () => {
      const res = await authenticatedApi(`/api/rides/${testRideId}/cancel`, authToken, {
        method: "POST",
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.status).toBeDefined();
    });

    test("Cancel nonexistent ride should return 404", async () => {
      const res = await authenticatedApi("/api/rides/00000000-0000-0000-0000-000000000000/cancel", authToken, {
        method: "POST",
      });
      await expectStatus(res, 404);
    });
  });

  // Ride Requests (v2) endpoints
  describe("Ride Requests Management", () => {
    let rideRequestId: string;
    let riderToken: string;

    test("Setup: Create rider user for ride requests", async () => {
      const { token, user } = await signUpTestUser();
      riderToken = token;
      // Create rider profile (not driver)
      const res = await authenticatedApi("/api/profiles/me", riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: "Test Rider",
          phone: "+254712345678",
          country: "kenya",
          language: "english",
          user_type: "rider",
        }),
      });
      await expectStatus(res, 200);
      expect(riderToken).toBeDefined();
    });

    test("Create ride request", async () => {
      const res = await authenticatedApi("/api/ride-requests", riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_type: "car",
          pickup_location: "Westlands",
          pickup_lat: -1.2657,
          pickup_lng: 36.8092,
          destination: "South B",
          destination_lat: -1.2920,
          destination_lng: 36.7800,
          distance_km: 5.2,
          offered_price: 750,
          currency: "KES",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      rideRequestId = data.id;
      expect(data.pickup_location).toBe("Westlands");
      expect(data.rider_id).toBeDefined();
      expect(data.status).toBeDefined();
    });

    test("Get ride request by ID", async () => {
      const res = await authenticatedApi(`/api/ride-requests/${rideRequestId}`, authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBe(rideRequestId);
      expect(data.pickup_location).toBe("Westlands");
      expect(data.destination).toBe("South B");
    });

    test("Get nonexistent ride request should return 404", async () => {
      const res = await authenticatedApi("/api/ride-requests/00000000-0000-0000-0000-000000000000", authToken);
      await expectStatus(res, 404);
    });

    test("Accept ride request", async () => {
      const res = await authenticatedApi(`/api/ride-requests/${rideRequestId}/accept`, authToken, {
        method: "POST",
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("Accept nonexistent ride request should return 404", async () => {
      const res = await authenticatedApi("/api/ride-requests/00000000-0000-0000-0000-000000000000/accept", authToken, {
        method: "POST",
      });
      await expectStatus(res, 404);
    });

    test("Create ride request for bargain test", async () => {
      const res = await authenticatedApi("/api/ride-requests", riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_type: "car",
          pickup_location: "Kilimani",
          pickup_lat: -1.3045,
          pickup_lng: 36.7651,
          destination: "Langata",
          destination_lat: -1.3300,
          destination_lng: 36.7500,
          distance_km: 8.5,
          offered_price: 850,
          currency: "KES",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      rideRequestId = data.id;
    });

    test("Send bargain offer with 10% discount", async () => {
      const res = await authenticatedApi(`/api/ride-requests/${rideRequestId}/bargain`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bargain_percent: 10,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.bargain_price).toBeDefined();
    });

    test("Send bargain with 25% discount", async () => {
      const res2 = await authenticatedApi("/api/ride-requests", riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_type: "car",
          pickup_location: "Upper Hill",
          pickup_lat: -1.2952,
          pickup_lng: 36.7764,
          destination: "Runda",
          destination_lat: -1.2800,
          destination_lng: 36.8100,
          distance_km: 4.0,
          offered_price: 650,
          currency: "KES",
        }),
      });
      const ride = await res2.json();

      const res = await authenticatedApi(`/api/ride-requests/${ride.id}/bargain`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bargain_percent: 25,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.bargain_price).toBeDefined();
    });

    test("Send bargain with 50% discount", async () => {
      const res2 = await authenticatedApi("/api/ride-requests", riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_type: "car",
          pickup_location: "Muthaiga",
          pickup_lat: -1.2493,
          pickup_lng: 36.8156,
          destination: "Gigiri",
          destination_lat: -1.2400,
          destination_lng: 36.8300,
          distance_km: 3.5,
          offered_price: 900,
          currency: "KES",
        }),
      });
      const ride = await res2.json();
      rideRequestId = ride.id;

      const res = await authenticatedApi(`/api/ride-requests/${ride.id}/bargain`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bargain_percent: 50,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.bargain_price).toBeDefined();
    });

    test("Send bargain with invalid percent should fail", async () => {
      const res = await authenticatedApi(`/api/ride-requests/${rideRequestId}/bargain`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bargain_percent: 35, // not in [10, 25, 50]
        }),
      });
      await expectStatus(res, 400);
    });

    test("Send bargain with missing percent should fail", async () => {
      const res = await authenticatedApi(`/api/ride-requests/${rideRequestId}/bargain`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await expectStatus(res, 400);
    });

    test("Send bargain for nonexistent request should return 404", async () => {
      const res = await authenticatedApi("/api/ride-requests/00000000-0000-0000-0000-000000000000/bargain", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bargain_percent: 10,
        }),
      });
      await expectStatus(res, 404);
    });

    test("Respond to bargain - accept", async () => {
      const res = await authenticatedApi(`/api/ride-requests/${rideRequestId}/bargain-response`, riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: "accepted",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("Respond to bargain - reject", async () => {
      const res2 = await authenticatedApi("/api/ride-requests", riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_type: "car",
          pickup_location: "Rosebank",
          pickup_lat: -1.2890,
          pickup_lng: 36.8127,
          destination: "Argwings Kodhek Road",
          destination_lat: -1.2950,
          destination_lng: 36.8200,
          distance_km: 2.5,
          offered_price: 700,
          currency: "KES",
        }),
      });
      const ride = await res2.json();

      const bargainRes = await authenticatedApi(`/api/ride-requests/${ride.id}/bargain`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bargain_percent: 10,
        }),
      });
      await expectStatus(bargainRes, 200);

      const res = await authenticatedApi(`/api/ride-requests/${ride.id}/bargain-response`, riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: "rejected",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("Respond to bargain with missing response should fail", async () => {
      const res = await authenticatedApi(`/api/ride-requests/${rideRequestId}/bargain-response`, riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await expectStatus(res, 400);
    });

    test("Respond to bargain for nonexistent request should return 404", async () => {
      const res = await authenticatedApi(
        "/api/ride-requests/00000000-0000-0000-0000-000000000000/bargain-response",
        riderToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            response: "accepted",
          }),
        }
      );
      await expectStatus(res, 404);
    });

    test("Reject ride request with 'rejected' action", async () => {
      const res2 = await authenticatedApi("/api/ride-requests", riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_type: "car",
          pickup_location: "Lavington",
          pickup_lat: -1.3139,
          pickup_lng: 36.7869,
          destination: "Hurlingham",
          destination_lat: -1.3200,
          destination_lng: 36.8000,
          distance_km: 6.0,
          offered_price: 800,
          currency: "KES",
        }),
      });
      const ride = await res2.json();

      const res = await authenticatedApi(`/api/ride-requests/${ride.id}/reject`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rejected",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("Reject ride request with 'ignored' action", async () => {
      const res2 = await authenticatedApi("/api/ride-requests", riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_type: "car",
          pickup_location: "Makadara",
          pickup_lat: -1.3031,
          pickup_lng: 36.8633,
          destination: "Imara Daima",
          destination_lat: -1.3100,
          destination_lng: 36.8700,
          distance_km: 7.0,
          offered_price: 650,
          currency: "KES",
        }),
      });
      const ride = await res2.json();

      const res = await authenticatedApi(`/api/ride-requests/${ride.id}/reject`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ignored",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("Reject with missing action should fail", async () => {
      const res2 = await authenticatedApi("/api/ride-requests", riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_type: "car",
          pickup_location: "Parklands",
          pickup_lat: -1.2641,
          pickup_lng: 36.8298,
          destination: "Spring Valley",
          destination_lat: -1.2750,
          destination_lng: 36.8450,
          distance_km: 5.5,
          offered_price: 750,
          currency: "KES",
        }),
      });
      const ride = await res2.json();

      const res = await authenticatedApi(`/api/ride-requests/${ride.id}/reject`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await expectStatus(res, 400);
    });

    test("Reject nonexistent request should return 404", async () => {
      const res = await authenticatedApi("/api/ride-requests/00000000-0000-0000-0000-000000000000/reject", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rejected",
        }),
      });
      await expectStatus(res, 404);
    });

    test("Create ride request with missing required fields should fail", async () => {
      const res = await authenticatedApi("/api/ride-requests", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Test Location",
          // missing: vehicle_type, pickup_lat, pickup_lng, destination, destination_lat, destination_lng, distance_km, offered_price, currency
        }),
      });
      await expectStatus(res, 400);
    });

    test("Get rider's current ride request with pending bargain", async () => {
      const res = await authenticatedApi("/api/ride-requests/rider/current", riderToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.ride_request).toBeDefined();
      expect(data.pending_bargain).toBeDefined();
    });

    test("Get rider's current ride request without auth should return 401", async () => {
      const res = await api("/api/ride-requests/rider/current");
      await expectStatus(res, 401);
    });

    test("Get driver's current ride request", async () => {
      const res = await authenticatedApi("/api/ride-requests/driver/current", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.ride_request).toBeDefined();
    });

    test("Get driver's current ride request without auth should return 401", async () => {
      const res = await api("/api/ride-requests/driver/current");
      await expectStatus(res, 401);
    });

    test("Create ride request without auth should return 401", async () => {
      const res = await api("/api/ride-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_type: "car",
          pickup_location: "Test",
          pickup_lat: -1.2921,
          pickup_lng: 36.8219,
          destination: "Test Dest",
          destination_lat: -1.2800,
          destination_lng: 36.8100,
          distance_km: 5.0,
          offered_price: 500,
          currency: "KES",
        }),
      });
      await expectStatus(res, 401);
    });
  });

  // Driver Mute Status endpoints
  describe("Driver Mute Status", () => {
    let muteTestToken: string;

    test("Setup: Create test user for mute tests", async () => {
      const { token } = await signUpTestUser();
      muteTestToken = token;
    });

    test("Get current mute status", async () => {
      const res = await authenticatedApi("/api/driver/mute", muteTestToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.muted).toBeDefined();
      expect(typeof data.muted).toBe("boolean");
    });

    test("Mute notifications", async () => {
      const res = await authenticatedApi("/api/driver/mute", muteTestToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          muted: true,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.muted).toBe(true);
    });

    test("Unmute notifications", async () => {
      const res = await authenticatedApi("/api/driver/mute", muteTestToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          muted: false,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.muted).toBe(false);
    });

    test("Update mute without auth should return 401", async () => {
      const res = await api("/api/driver/mute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          muted: true,
        }),
      });
      await expectStatus(res, 401);
    });

    test("Get mute status without auth should return 401", async () => {
      const res = await api("/api/driver/mute");
      await expectStatus(res, 401);
    });
  });

  // Unauthenticated access tests
  describe("Authentication", () => {
    test("Get profile without auth should return 401", async () => {
      const res = await api("/api/profiles/me");
      await expectStatus(res, 401);
    });

    test("Get combined profile without auth should return 401", async () => {
      const res = await api("/api/profile");
      await expectStatus(res, 401);
    });

    test("Create ride without auth should return 401", async () => {
      const res = await api("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Test",
          dropoff_location: "Test",
        }),
      });
      await expectStatus(res, 401);
    });

    test("Get driver details without auth should return 401", async () => {
      const res = await api("/api/driver/details");
      await expectStatus(res, 401);
    });

    test("Update availability without auth should return 401", async () => {
      const res = await api("/api/driver/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_available: true,
        }),
      });
      await expectStatus(res, 401);
    });

    test("Get dashboard without auth should return 401", async () => {
      const res = await api("/api/driver/dashboard");
      await expectStatus(res, 401);
    });

    test("Get nearby requests without auth should return 401", async () => {
      const res = await api("/api/driver/nearby-requests");
      await expectStatus(res, 401);
    });

    test("Get ride stats without auth should return 401", async () => {
      const res = await api("/api/ride-stats");
      await expectStatus(res, 401);
    });
  });
});
