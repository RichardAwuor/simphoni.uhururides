CREATE TYPE "public"."bargain_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."car_make" AS ENUM('Toyota', 'Nissan', 'Ford', 'Mercedes', 'Volkswagen', 'Others');--> statement-breakpoint
CREATE TYPE "public"."country" AS ENUM('kenya', 'tanzania', 'uganda');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('KES', 'TZS', 'UGX');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('english', 'swahili', 'luganda');--> statement-breakpoint
CREATE TYPE "public"."ride_status" AS ENUM('pending', 'bargaining', 'accepted', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('driver', 'rider');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_details" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"car_make" "car_make" NOT NULL,
	"car_registration" text NOT NULL,
	"car_color" text NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_details_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_type" "user_type" NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"resident_district" text NOT NULL,
	"mobile_number" text,
	"country" "country" NOT NULL,
	"language" "language" NOT NULL,
	"profile_picture_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "ride_bargains" (
	"id" text PRIMARY KEY NOT NULL,
	"ride_request_id" text NOT NULL,
	"driver_id" text NOT NULL,
	"bargain_percentage" integer NOT NULL,
	"bargain_price" real NOT NULL,
	"status" "bargain_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ride_history" (
	"id" text PRIMARY KEY NOT NULL,
	"ride_request_id" text NOT NULL,
	"driver_id" text NOT NULL,
	"rider_id" text NOT NULL,
	"price_final" real NOT NULL,
	"currency" "currency" NOT NULL,
	"distance_km" real,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ride_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"rider_id" text NOT NULL,
	"pickup_location" text NOT NULL,
	"pickup_lat" real,
	"pickup_lng" real,
	"destination" text NOT NULL,
	"price_offer" real NOT NULL,
	"currency" "currency" NOT NULL,
	"status" "ride_status" DEFAULT 'pending' NOT NULL,
	"assigned_driver_id" text,
	"driver_attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_details" ADD CONSTRAINT "driver_details_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_bargains" ADD CONSTRAINT "ride_bargains_ride_request_id_ride_requests_id_fk" FOREIGN KEY ("ride_request_id") REFERENCES "public"."ride_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_bargains" ADD CONSTRAINT "ride_bargains_driver_id_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_history" ADD CONSTRAINT "ride_history_ride_request_id_ride_requests_id_fk" FOREIGN KEY ("ride_request_id") REFERENCES "public"."ride_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_history" ADD CONSTRAINT "ride_history_driver_id_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_history" ADD CONSTRAINT "ride_history_rider_id_user_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_rider_id_user_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_assigned_driver_id_user_id_fk" FOREIGN KEY ("assigned_driver_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;