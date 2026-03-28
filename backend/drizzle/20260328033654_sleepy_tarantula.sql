CREATE TABLE "rides" (
	"id" text PRIMARY KEY NOT NULL,
	"rider_id" text NOT NULL,
	"driver_id" text,
	"pickup_location" text NOT NULL,
	"dropoff_location" text NOT NULL,
	"pickup_lat" real,
	"pickup_lng" real,
	"dropoff_lat" real,
	"dropoff_lng" real,
	"status" text DEFAULT 'pending' NOT NULL,
	"vehicle_type" text,
	"fare" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_rider_id_user_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_driver_id_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;