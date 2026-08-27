import { z } from 'zod';
const optionalDimension=z.number().finite().positive().max(1000).optional();
export const vehicleIdSchema=z.string().uuid();
export const fuelTypes=['petrol','diesel','lpg','petrol_lpg','hybrid','plug_in_hybrid','electric'] as const;
export const createVehicleSchema=z.object({
  label:z.string().trim().min(2).max(80),
  bodyType:z.enum(['sedan','hatchback','wagon','suv','van','pickup','other']),
  fuelType:z.enum(fuelTypes),
  engineDisplacementCc:z.number().int().min(500).max(10000).optional(),
  curbWeightKg:z.number().finite().min(500).max(20000),
  grossWeightKg:z.number().finite().min(600).max(30000),
  maxPayloadKg:z.number().finite().positive().max(50_000).optional(),
  avgConsumptionPer100:z.number().finite().min(1).max(80).optional(),
  energyConsumptionKwh100:z.number().finite().min(5).max(100).optional(),
  cargoLengthCm:optionalDimension,cargoWidthCm:optionalDimension,cargoHeightCm:optionalDimension,
  clientReference:z.string().trim().min(12).max(120).regex(/^[A-Za-z0-9._:-]+$/).optional(),
}).superRefine((v,ctx)=>{if(v.fuelType!=='electric'&&v.engineDisplacementCc==null)ctx.addIssue({code:'custom',path:['engineDisplacementCc'],message:'Вкажіть об’єм двигуна'});if(v.fuelType==='electric'){if(v.energyConsumptionKwh100==null)ctx.addIssue({code:'custom',path:['energyConsumptionKwh100'],message:'Для електромобіля вкажіть кВт·год/100 км'});}else if(v.avgConsumptionPer100==null)ctx.addIssue({code:'custom',path:['avgConsumptionPer100'],message:'Вкажіть середню витрату пального на 100 км'});if(v.grossWeightKg<=v.curbWeightKg)ctx.addIssue({code:'custom',path:['grossWeightKg'],message:'Повна маса має бути більшою за споряджену'});});
export type CreateVehicleInput=z.infer<typeof createVehicleSchema>;
