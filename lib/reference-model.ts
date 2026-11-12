import {boundedArray} from './bounded-array';
import {z} from 'zod';
export const referenceInput=z.object({sourceKey:z.string().min(1).max(240),sourceUrl:z.string().url().max(500),title:z.string().min(1).max(255),kind:z.enum(['recipe','ingredients','suppliers','purchases','operations','catalogue']),observedAt:z.string().datetime({offset:true}),
 // Explicit, bounded projection; never a raw arbitrary workbook or customer dump.
 columns:boundedArray(z.string().max(150),40,1),rows:boundedArray(boundedArray(z.union([z.string().max(2000),z.number().finite(),z.null()]),40,0),500,0),
 formulas:boundedArray(z.object({cell:z.string().regex(/^[A-Z]{1,2}[1-9]\d{0,3}$/),formula:z.string().max(1000)}).strict(),500,0),issues:boundedArray(z.string().max(500),30,0),sourceHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
