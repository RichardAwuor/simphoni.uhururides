CREATE TABLE "ride_request_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"ride_request_id" text NOT NULL,
	"driver_id" text NOT NULL,
	"action" text NOT NULL,
	"bargain_percent" integer,
	"bargain_price" real,
	"rider_response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "muted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "pickup_lat" real;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "pickup_lng" real;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "offered_price" real;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "final_price" real;--> statement-breakpoint
ALTER TABLE "ride_request_attempts" ADD CONSTRAINT "ride_request_attempts_ride_request_id_ride_requests_id_fk" FOREIGN KEY ("ride_request_id") REFERENCES "public"."ride_requests"("id") ON DELETE cascade ON UPDATE no action;