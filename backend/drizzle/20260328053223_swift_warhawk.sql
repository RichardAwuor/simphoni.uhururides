CREATE TABLE "driver_ride_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"ride_request_id" text NOT NULL,
	"driver_id" text NOT NULL,
	"action" text NOT NULL,
	"bargain_multiplier" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "rider_name" text;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "pickup_address" text;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "destination_address" text;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "bargain_multiplier" real;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD COLUMN "current_driver_id" text;--> statement-breakpoint
ALTER TABLE "driver_ride_actions" ADD CONSTRAINT "driver_ride_actions_ride_request_id_ride_requests_id_fk" FOREIGN KEY ("ride_request_id") REFERENCES "public"."ride_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_ride_actions" ADD CONSTRAINT "driver_ride_actions_driver_id_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_current_driver_id_user_id_fk" FOREIGN KEY ("current_driver_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;