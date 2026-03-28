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
          name: "Test User",
          phone: "+254712345678",
          country: "kenya",
          language: "english",
          userType: "driver",
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
          name: "Test User",
          // missing required fields: phone, country, language, userType
        }),
      });
      await expectStatus(res, 400);
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
          // missing: licensePlate, licenseNumber
        }),
      });
      await expectStatus(res, 400);
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
          name: "Test Rider",
          phone: "+254712345678",
          country: "kenya",
          language: "english",
          userType: "rider",
        }),
      });
      await expectStatus(res, 200);
      expect(riderToken).toBeDefined();
    });

    test("Setup: Initialize driver status for test driver", async () => {
      // Initialize driver status so driver can be assigned to ride requests
      const res = await authenticatedApi("/api/driver-status", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_available: true,
          is_muted: false,
          current_lat: -1.2921,
          current_lng: 36.8219,
        }),
      });
      await expectStatus(res, 200);
    });

    test("Create ride request", async () => {
      const res = await authenticatedApi("/api/ride-requests", riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Westlands",
          pickup_lat: -1.2657,
          pickup_lng: 36.8092,
          destination: "South B",
          price_offer: 750,
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
      const res = await authenticatedApi(`/api/ride-requests/${rideRequestId}`, riderToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBe(rideRequestId);
    });

    test("Get ride requests as rider", async () => {
      const res = await authenticatedApi("/api/ride-requests?role=rider", riderToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.requests).toBeDefined();
      expect(Array.isArray(data.requests)).toBe(true);
    });

    test("Get ride requests as driver with location", async () => {
      const res = await authenticatedApi("/api/ride-requests?role=driver&lat=-1.2921&lng=36.8219", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.requests).toBeDefined();
      expect(Array.isArray(data.requests)).toBe(true);
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
          pickup_location: "Kilimani",
          pickup_lat: -1.3045,
          pickup_lng: 36.7651,
          destination: "Langata",
          price_offer: 850,
          currency: "KES",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      rideRequestId = data.id;
    });

    test("Send bargain offer", async () => {
      const res = await authenticatedApi(`/api/ride-requests/${rideRequestId}/bargain`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bargain_percent: 25,
        }),
      });
      await expectStatus(res, 200);
    });

    test("Send bargain with invalid percentage should fail", async () => {
      const res = await authenticatedApi(`/api/ride-requests/${rideRequestId}/bargain`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bargain_percent: 15, // Not in enum: 10, 25, 50
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
      const res = await authenticatedApi(`/api/ride-requests/${rideRequestId}/respond-bargain`, riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accept: true,
        }),
      });
      await expectStatus(res, 200);
    });

    test("Respond to bargain - reject", async () => {
      const res2 = await authenticatedApi("/api/ride-requests", riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Upper Hill",
          pickup_lat: -1.2952,
          pickup_lng: 36.7764,
          destination: "Runda",
          price_offer: 650,
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

      const res = await authenticatedApi(`/api/ride-requests/${ride.id}/respond-bargain`, riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accept: false,
        }),
      });
      await expectStatus(res, 200);
    });

    test("Respond to bargain with missing accept should fail", async () => {
      const res = await authenticatedApi(`/api/ride-requests/${rideRequestId}/respond-bargain`, riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await expectStatus(res, 400);
    });

    test("Respond to bargain for nonexistent request should return 404", async () => {
      const res = await authenticatedApi(
        "/api/ride-requests/00000000-0000-0000-0000-000000000000/respond-bargain",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accept: true,
          }),
        }
      );
      await expectStatus(res, 404);
    });

    test("Create ride request for ignore test", async () => {
      const res = await authenticatedApi("/api/ride-requests", riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Muthaiga",
          pickup_lat: -1.2493,
          pickup_lng: 36.8156,
          destination: "Gigiri",
          price_offer: 900,
          currency: "KES",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      rideRequestId = data.id;
    });

    test("Ignore ride request", async () => {
      const res = await authenticatedApi(`/api/ride-requests/${rideRequestId}/ignore`, authToken, {
        method: "POST",
      });
      await expectStatus(res, 200);
    });

    test("Ignore nonexistent request should return 404", async () => {
      const res = await authenticatedApi("/api/ride-requests/00000000-0000-0000-0000-000000000000/ignore", authToken, {
        method: "POST",
      });
      await expectStatus(res, 404);
    });

    test("Create ride request for cancel test", async () => {
      const res = await authenticatedApi("/api/ride-requests", riderToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Parklands",
          pickup_lat: -1.2641,
          pickup_lng: 36.8298,
          destination: "Spring Valley",
          price_offer: 750,
          currency: "KES",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      rideRequestId = data.id;
    });

    test("Cancel ride request", async () => {
      const res = await authenticatedApi(`/api/ride-requests/${rideRequestId}/cancel`, riderToken, {
        method: "POST",
      });
      await expectStatus(res, 200);
    });

    test("Cancel nonexistent request should return 404", async () => {
      const res = await authenticatedApi("/api/ride-requests/00000000-0000-0000-0000-000000000000/cancel", authToken, {
        method: "POST",
      });
      await expectStatus(res, 404);
    });

    test("Create ride request with missing required fields should fail", async () => {
      const res = await authenticatedApi("/api/ride-requests", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Test Location",
          // missing: pickup_lat, pickup_lng, destination, price_offer, currency
        }),
      });
      await expectStatus(res, 400);
    });

    test("Create ride request with invalid currency should fail", async () => {
      const res = await authenticatedApi("/api/ride-requests", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Test Location",
          pickup_lat: -1.2921,
          pickup_lng: 36.8219,
          destination: "Test Destination",
          price_offer: 500,
          currency: "INR", // Not in enum: KES, TZS, UGX, USD
        }),
      });
      await expectStatus(res, 400);
    });

    test("Get ride requests without auth should return 401", async () => {
      const res = await api("/api/ride-requests?role=rider");
      await expectStatus(res, 401);
    });

    test("Create ride request without auth should return 401", async () => {
      const res = await api("/api/ride-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Test",
          pickup_lat: -1.2921,
          pickup_lng: 36.8219,
          destination: "Test Dest",
          price_offer: 500,
          currency: "KES",
        }),
      });
      await expectStatus(res, 401);
    });
  });

  // Driver Status endpoints
  describe("Driver Status Management", () => {
    test("Get driver status", async () => {
      const res = await authenticatedApi("/api/driver-status", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.driver_id).toBeDefined();
      expect(data.is_muted).toBeDefined();
      expect(data.is_available).toBeDefined();
      expect(data.updated_at).toBeDefined();
    });

    test("Update driver status - availability", async () => {
      const res = await authenticatedApi("/api/driver-status", authToken, {
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

    test("Update driver status - muted status", async () => {
      const res = await authenticatedApi("/api/driver-status", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_muted: false,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.is_muted).toBe(false);
    });

    test("Update driver status - location", async () => {
      const res = await authenticatedApi("/api/driver-status", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_lat: -1.2921,
          current_lng: 36.8219,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.current_lat).toBe(-1.2921);
      expect(data.current_lng).toBe(36.8219);
    });

    test("Update driver status - multiple fields", async () => {
      const res = await authenticatedApi("/api/driver-status", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_available: true,
          is_muted: true,
          current_lat: -1.3000,
          current_lng: 36.8300,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.is_available).toBe(true);
      expect(data.is_muted).toBe(true);
    });

    test("Update driver status with empty body should succeed", async () => {
      const res = await authenticatedApi("/api/driver-status", authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await expectStatus(res, 200);
    });

    test("Get driver status without auth should return 401", async () => {
      const res = await api("/api/driver-status");
      await expectStatus(res, 401);
    });

    test("Update driver status without auth should return 401", async () => {
      const res = await api("/api/driver-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_available: true,
        }),
      });
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
