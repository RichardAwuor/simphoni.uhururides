ALTER TYPE "public"."currency" ADD VALUE 'USD';--> statement-breakpoint
ALTER TYPE "public"."ride_status" ADD VALUE 'rejected' BEFORE 'cancelled';--> statement-breakpoint
CREATE TABLE "driver_status" (
	"id" text PRIMARY KEY NOT NULL,
	"driver_id" text NOT NULL,
	"is_muted" boolean DEFAULT false NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"current_lat" real,
	"current_lng" real,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_status_driver_id_unique" UNIQUE("driver_id")
);
--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "driver_id" text;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "destination_lat" real;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "destination_lng" real;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "distance_km" real;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "bargain_price" real;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "bargain_percent" integer;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "routing_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "routed_driver_ids" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "rider_phone" text;--> statement-breakpoint
ALTER TABLE "driver_status" ADD CONSTRAINT "driver_status_driver_id_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_driver_id_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;