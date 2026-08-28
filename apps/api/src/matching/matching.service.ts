import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

// Matching v5: corridor + direction + ETA-aware time windows + rotatable cargo dimensions.
// Route geometry is still based on our current routing source, but matching no longer treats a stale
// trip or a cargo that can only be collected long after the driver passes it as a good candidate.
const matchProjection = `
  WITH base AS (
    SELECT t.id AS trip_id,c.id AS cargo_id,
      ROUND(ST_Distance(c.pickup_point,t.route))::int AS pickup_distance_m,
      ROUND(ST_Distance(c.delivery_point,t.route))::int AS delivery_distance_m,
      ST_LineLocatePoint(t.route::geometry,c.pickup_point::geometry) AS pickup_fraction,
      ST_LineLocatePoint(t.route::geometry,c.delivery_point::geometry) AS delivery_fraction,
      ROUND((ST_Distance(c.pickup_point,t.route)+ST_Distance(c.delivery_point,t.route))*2)::int AS estimated_extra_m,
      t.departure_from + make_interval(secs => COALESCE(t.route_duration_s,0) * ST_LineLocatePoint(t.route::geometry,c.pickup_point::geometry)) AS pickup_eta,
      t.departure_from + make_interval(secs => COALESCE(t.route_duration_s,0) * ST_LineLocatePoint(t.route::geometry,c.delivery_point::geometry)) AS delivery_eta,
      t.origin_country_code,t.origin_city_id,t.destination_country_code,t.destination_city_id,
      t.max_detour_km,t.capacity_kg,t.capacity_length_cm,t.capacity_width_cm,t.capacity_height_cm,
      c.pickup_country_code,c.pickup_city_id,c.delivery_country_code,c.delivery_city_id,
      c.weight_kg,c.length_cm,c.width_cm,c.height_cm,c.pickup_from,c.pickup_until,c.delivery_until,c.reward_minor
    FROM trip t
    JOIN cargo c ON c.status='published' AND c.owner_id<>t.driver_id
    WHERE t.status='published' AND t.route IS NOT NULL
      AND t.departure_from >= now() - INTERVAL '2 hours'
      AND EXISTS(SELECT 1 FROM app_user au WHERE au.id=c.owner_id AND au.verification_status='verified')
      AND ST_DWithin(c.pickup_point,t.route,t.max_detour_km*1000)
      AND ST_DWithin(c.delivery_point,t.route,t.max_detour_km*1000)
      AND (t.capacity_kg IS NULL OR c.weight_kg IS NULL OR c.weight_kg <= t.capacity_kg)
      AND (
        c.length_cm IS NULL OR c.width_cm IS NULL OR c.height_cm IS NULL OR
        t.capacity_length_cm IS NULL OR t.capacity_width_cm IS NULL OR t.capacity_height_cm IS NULL OR
        (c.length_cm<=t.capacity_length_cm AND c.width_cm<=t.capacity_width_cm AND c.height_cm<=t.capacity_height_cm) OR
        (c.length_cm<=t.capacity_length_cm AND c.height_cm<=t.capacity_width_cm AND c.width_cm<=t.capacity_height_cm) OR
        (c.width_cm<=t.capacity_length_cm AND c.length_cm<=t.capacity_width_cm AND c.height_cm<=t.capacity_height_cm) OR
        (c.width_cm<=t.capacity_length_cm AND c.height_cm<=t.capacity_width_cm AND c.length_cm<=t.capacity_height_cm) OR
        (c.height_cm<=t.capacity_length_cm AND c.length_cm<=t.capacity_width_cm AND c.width_cm<=t.capacity_height_cm) OR
        (c.height_cm<=t.capacity_length_cm AND c.width_cm<=t.capacity_width_cm AND c.length_cm<=t.capacity_height_cm)
      )
  ), candidates AS (
    SELECT *,
      CASE
        WHEN origin_country_code=pickup_country_code AND origin_city_id=pickup_city_id
         AND destination_country_code=delivery_country_code AND destination_city_id=delivery_city_id THEN 45
        WHEN origin_country_code=pickup_country_code AND destination_country_code=delivery_country_code THEN 30
        ELSE 15 END::smallint AS score_city,
      GREATEST(0,LEAST(20,ROUND(20 - ((pickup_distance_m+delivery_distance_m)/GREATEST(max_detour_km*2000,1))*20)))::smallint AS score_proximity,
      CASE WHEN delivery_fraction-pickup_fraction>=.25 THEN 10 WHEN delivery_fraction-pickup_fraction>=.05 THEN 8 ELSE 6 END::smallint AS score_direction,
      CASE WHEN weight_kg IS NULL OR capacity_kg IS NULL THEN 6
           WHEN weight_kg <= capacity_kg*0.5 THEN 10
           WHEN weight_kg <= capacity_kg*0.8 THEN 8 ELSE 6 END::smallint AS score_capacity,
      CASE WHEN pickup_from IS NULL AND pickup_until IS NULL AND delivery_until IS NULL THEN 8
           WHEN (pickup_until IS NULL OR pickup_eta<=pickup_until)
            AND (pickup_from IS NULL OR pickup_eta>=pickup_from)
            AND (delivery_until IS NULL OR delivery_eta<=delivery_until) THEN 10
           ELSE 6 END::smallint AS score_time,
      GREATEST(1,LEAST(5,ROUND(reward_minor/20000.0)))::smallint AS score_reward,
      CASE
        WHEN origin_country_code=pickup_country_code AND origin_city_id=pickup_city_id
         AND destination_country_code=delivery_country_code AND destination_city_id=delivery_city_id THEN 'exact_city_pair'
        WHEN origin_country_code=pickup_country_code AND destination_country_code=delivery_country_code THEN 'nearby_city_pair'
        ELSE 'corridor' END AS match_kind
    FROM base
    WHERE pickup_fraction + 0.00001 < delivery_fraction
      AND (pickup_until IS NULL OR pickup_eta <= pickup_until + INTERVAL '2 hours')
      AND (pickup_from IS NULL OR pickup_eta >= pickup_from - INTERVAL '2 hours')
      AND (delivery_until IS NULL OR delivery_eta <= delivery_until + INTERVAL '3 hours')
  )
  SELECT trip_id,cargo_id,pickup_distance_m,delivery_distance_m,pickup_fraction,delivery_fraction,estimated_extra_m,
    LEAST(100,score_city+score_proximity+score_direction+score_capacity+score_time+score_reward)::smallint AS score,
    score_city,score_proximity,score_direction,score_capacity,score_time,score_reward,match_kind
  FROM candidates
`;
const upsert=`ON CONFLICT(trip_id,cargo_id) DO UPDATE SET pickup_distance_m=EXCLUDED.pickup_distance_m,delivery_distance_m=EXCLUDED.delivery_distance_m,pickup_fraction=EXCLUDED.pickup_fraction,delivery_fraction=EXCLUDED.delivery_fraction,estimated_extra_m=EXCLUDED.estimated_extra_m,score=EXCLUDED.score,score_city=EXCLUDED.score_city,score_proximity=EXCLUDED.score_proximity,score_direction=EXCLUDED.score_direction,score_capacity=EXCLUDED.score_capacity,score_time=EXCLUDED.score_time,score_reward=EXCLUDED.score_reward,match_kind=EXCLUDED.match_kind,computed_at=now()`;
@Injectable() export class MatchingService{
 constructor(@Inject(DatabaseService) private readonly db:DatabaseService){}
 async recomputeTrip(client:PoolClient,tripId:string){await client.query('DELETE FROM trip_match WHERE trip_id=$1',[tripId]);await client.query(`INSERT INTO trip_match(trip_id,cargo_id,pickup_distance_m,delivery_distance_m,pickup_fraction,delivery_fraction,estimated_extra_m,score,score_city,score_proximity,score_direction,score_capacity,score_time,score_reward,match_kind) ${matchProjection} WHERE trip_id=$1 ${upsert}`,[tripId]);await client.query('UPDATE trip SET matching_version=5 WHERE id=$1',[tripId]);}
 async recomputeCargo(client:PoolClient,cargoId:string){await client.query('DELETE FROM trip_match WHERE cargo_id=$1',[cargoId]);await client.query(`INSERT INTO trip_match(trip_id,cargo_id,pickup_distance_m,delivery_distance_m,pickup_fraction,delivery_fraction,estimated_extra_m,score,score_city,score_proximity,score_direction,score_capacity,score_time,score_reward,match_kind) ${matchProjection} WHERE cargo_id=$1 ${upsert}`,[cargoId]);}
 async removeCargo(client:PoolClient,id:string){await client.query('DELETE FROM trip_match WHERE cargo_id=$1',[id]);}
 async removeTrip(client:PoolClient,id:string){await client.query('DELETE FROM trip_match WHERE trip_id=$1',[id]);}
}
