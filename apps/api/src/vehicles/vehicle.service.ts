import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../common/request-user';
import type { CreateVehicleInput } from './vehicle.schemas';

type VehicleRow = {
  id: string;
  owner_id: string;
  label: string;
  body_type: string;
  max_payload_kg: string | null;
  fuel_type:string|null; engine_displacement_cc:number|null; curb_weight_kg:string|null; gross_weight_kg:string|null; avg_consumption_per_100:string|null; energy_consumption_kwh_100:string|null;
  cargo_length_cm: string | null;
  cargo_width_cm: string | null;
  cargo_height_cm: string | null;
  verification_status: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

@Injectable()
export class VehicleService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async create(user: RequestUser, input: CreateVehicleInput) {
    const result = await this.db.query<VehicleRow>(`
      INSERT INTO vehicle(owner_id,label,body_type,fuel_type,engine_displacement_cc,curb_weight_kg,gross_weight_kg,max_payload_kg,avg_consumption_per_100,energy_consumption_kwh_100,cargo_length_cm,cargo_width_cm,cargo_height_cm,client_reference)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (owner_id,client_reference) WHERE client_reference IS NOT NULL
      DO UPDATE SET updated_at=vehicle.updated_at
      RETURNING *
    `, [user.id,input.label,input.bodyType,input.fuelType,input.engineDisplacementCc??null,input.curbWeightKg,input.grossWeightKg??null,input.maxPayloadKg??null,input.avgConsumptionPer100??null,input.energyConsumptionKwh100??null,input.cargoLengthCm??null,input.cargoWidthCm??null,input.cargoHeightCm??null,input.clientReference??null]);
    return this.toDto(result.rows[0]);
  }

  async listMine(user: RequestUser) {
    const result = await this.db.query<VehicleRow>(`
      SELECT * FROM vehicle WHERE owner_id=$1 AND status='active' ORDER BY created_at DESC LIMIT 25
    `, [user.id]);
    return result.rows.map((row) => this.toDto(row));
  }

  async requireOwnedActive(userId: string, id: string) {
    const result = await this.db.query<VehicleRow>('SELECT * FROM vehicle WHERE id=$1', [id]);
    const row = result.rows[0];
    if (!row || row.owner_id !== userId) throw new NotFoundException({ code: 'VEHICLE_NOT_FOUND', message: 'Vehicle not found' });
    if (row.status !== 'active') throw new ConflictException({ code: 'VEHICLE_ARCHIVED', message: 'Vehicle is archived' });
    return row;
  }

  private toDto(row: VehicleRow) {
    return {
      id: row.id,
      label: row.label,
      bodyType: row.body_type,
      maxPayloadKg: row.max_payload_kg === null ? null : Number(row.max_payload_kg),
      fuelType:row.fuel_type,engineDisplacementCc:row.engine_displacement_cc,curbWeightKg:row.curb_weight_kg===null?null:Number(row.curb_weight_kg),grossWeightKg:row.gross_weight_kg===null?null:Number(row.gross_weight_kg),avgConsumptionPer100:row.avg_consumption_per_100===null?null:Number(row.avg_consumption_per_100),energyConsumptionKwh100:row.energy_consumption_kwh_100===null?null:Number(row.energy_consumption_kwh_100),
      cargoSpace: {
        lengthCm: row.cargo_length_cm === null ? null : Number(row.cargo_length_cm),
        widthCm: row.cargo_width_cm === null ? null : Number(row.cargo_width_cm),
        heightCm: row.cargo_height_cm === null ? null : Number(row.cargo_height_cm),
      },
      verificationStatus: row.verification_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastUsedAt: row.last_used_at,
    };
  }
}
