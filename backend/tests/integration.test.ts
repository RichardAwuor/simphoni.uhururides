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
      expect(data.email).toBeDefined();
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
  });

  // Ride Statistics endpoint
  describe("Ride Statistics", () => {
    test("Get ride stats", async () => {
      const res = await authenticatedApi("/api/ride-stats", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.total_rides).toBeDefined();
      expect(data.total_earnings).toBeDefined();
      expect(data.total_distance_km).toBeDefined();
      expect(Array.isArray(data.rides)).toBe(true);
    });

    test("Get ride stats with date range", async () => {
      const res = await authenticatedApi("/api/ride-stats?from=2026-03-01&to=2026-03-31", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.total_rides).toBeDefined();
    });

    test("Get ride stats with role filter - rider", async () => {
      const res = await authenticatedApi("/api/ride-stats?role=rider", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.total_rides).toBeDefined();
    });

    test("Get ride stats with role filter - driver", async () => {
      const res = await authenticatedApi("/api/ride-stats?role=driver", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.total_rides).toBeDefined();
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
  });

  // Rides endpoints
  describe("Ride Management", () => {
    test("Create ride request", async () => {
      const res = await authenticatedApi("/api/rides", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Nairobi CBD",
          destination: "Westlands",
          pickup_lat: -1.2921,
          pickup_lng: 36.8219,
          price_offer: 500,
          currency: "KES",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      rideId = data.id;
      expect(data.pickup_location).toBe("Nairobi CBD");
      expect(data.status).toBeDefined();
    });

    test("Get ride request by ID", async () => {
      const res = await authenticatedApi(`/api/rides/${rideId}`, authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBe(rideId);
    });

    test("Get nonexistent ride should return 404", async () => {
      const res = await authenticatedApi("/api/rides/00000000-0000-0000-0000-000000000000", authToken);
      await expectStatus(res, 404);
    });

    test("Get my ride requests", async () => {
      const res = await authenticatedApi("/api/rides/my-requests", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.requests).toBeDefined();
      expect(Array.isArray(data.requests)).toBe(true);
    });

    test("Get ride history", async () => {
      const res = await authenticatedApi("/api/rides/history", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.history).toBeDefined();
      expect(Array.isArray(data.history)).toBe(true);
    });

    test("Get ride history with date filter", async () => {
      const res = await authenticatedApi("/api/rides/history?date=2026-03-27", authToken);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.history).toBeDefined();
    });

    test("Create ride with missing required fields should fail", async () => {
      const res = await authenticatedApi("/api/rides", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Nairobi CBD",
          // missing: destination, price_offer, currency
        }),
      });
      await expectStatus(res, 400);
    });
  });

  // Ride actions
  describe("Ride Actions", () => {
    test("Accept ride request", async () => {
      const res = await authenticatedApi(`/api/rides/${rideId}/accept`, authToken, {
        method: "POST",
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("Accept nonexistent ride should return 404", async () => {
      const res = await authenticatedApi("/api/rides/00000000-0000-0000-0000-000000000000/accept", authToken, {
        method: "POST",
      });
      await expectStatus(res, 404);
    });

    test("Create ride for reject test", async () => {
      const res = await authenticatedApi("/api/rides", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Karen",
          destination: "Kilimani",
          price_offer: 800,
          currency: "KES",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      rideId = data.id;
    });

    test("Reject ride request", async () => {
      const res = await authenticatedApi(`/api/rides/${rideId}/reject`, authToken, {
        method: "POST",
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("Reject nonexistent ride should return 404", async () => {
      const res = await authenticatedApi("/api/rides/00000000-0000-0000-0000-000000000000/reject", authToken, {
        method: "POST",
      });
      await expectStatus(res, 404);
    });
  });

  // Bargain endpoints
  describe("Ride Bargaining", () => {
    test("Create ride for bargain test", async () => {
      const res = await authenticatedApi("/api/rides", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Eastleigh",
          destination: "Industrial Area",
          price_offer: 1000,
          currency: "KES",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      rideId = data.id;
    });

    test("Create bargain for ride", async () => {
      const res = await authenticatedApi(`/api/rides/${rideId}/bargain`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bargain_percentage: 10,
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      expect(data.bargain_percentage).toBe(10);
      expect(data.bargain_price).toBeDefined();
    });

    test("Create bargain with invalid percentage should fail", async () => {
      const res = await authenticatedApi(`/api/rides/${rideId}/bargain`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bargain_percentage: 15, // Not in enum: 10, 25, 50
        }),
      });
      await expectStatus(res, 400);
    });

    test("Create bargain with missing percentage should fail", async () => {
      const res = await authenticatedApi(`/api/rides/${rideId}/bargain`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await expectStatus(res, 400);
    });

    test("Create bargain for nonexistent ride should return 404", async () => {
      const res = await authenticatedApi("/api/rides/00000000-0000-0000-0000-000000000000/bargain", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bargain_percentage: 25,
        }),
      });
      await expectStatus(res, 404);
    });

    test("Respond to bargain offer - accept", async () => {
      const res = await authenticatedApi(`/api/rides/${rideId}/bargain/respond`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accept: true,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("Respond to bargain offer - reject", async () => {
      const res2 = await authenticatedApi("/api/rides", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Kibera",
          destination: "Ngara",
          price_offer: 600,
          currency: "KES",
        }),
      });
      const ride = await res2.json();
      const bargainRes = await authenticatedApi(`/api/rides/${ride.id}/bargain`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bargain_percentage: 25,
        }),
      });
      await expectStatus(bargainRes, 201);

      const res = await authenticatedApi(`/api/rides/${ride.id}/bargain/respond`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accept: false,
        }),
      });
      await expectStatus(res, 200);
    });

    test("Respond to bargain with missing accept should fail", async () => {
      const res = await authenticatedApi(`/api/rides/${rideId}/bargain/respond`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await expectStatus(res, 400);
    });

    test("Respond to bargain for nonexistent ride should return 404", async () => {
      const res = await authenticatedApi("/api/rides/00000000-0000-0000-0000-000000000000/bargain/respond", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accept: true,
        }),
      });
      await expectStatus(res, 404);
    });
  });

  // Ride completion
  describe("Ride Completion", () => {
    test("Create ride for completion test", async () => {
      const res = await authenticatedApi("/api/rides", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Makadara",
          destination: "South B",
          price_offer: 600,
          currency: "KES",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      rideId = data.id;
    });

    test("Complete ride with distance", async () => {
      const res = await authenticatedApi(`/api/rides/${rideId}/complete`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distance_km: 15.5,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("Complete ride without distance", async () => {
      const res2 = await authenticatedApi("/api/rides", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Uthiru",
          destination: "Kikuyu",
          price_offer: 400,
          currency: "KES",
        }),
      });
      const ride = await res2.json();

      const res = await authenticatedApi(`/api/rides/${ride.id}/complete`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await expectStatus(res, 200);
    });

    test("Complete nonexistent ride should return 404", async () => {
      const res = await authenticatedApi("/api/rides/00000000-0000-0000-0000-000000000000/complete", authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distance_km: 10,
        }),
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

    test("Create ride request (v2 endpoint)", async () => {
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

    test("Create ride without auth should return 401", async () => {
      const res = await api("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_location: "Test",
          destination: "Test",
          price_offer: 100,
          currency: "KES",
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
  });
});
