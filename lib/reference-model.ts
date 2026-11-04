import {z} from 'zod';
export const referenceInput=z.object({sourceKey:z.string().min(1).max(240),sourceUrl:z.string().url().max(500),title:z.string().min(1).max(255),kind:z.enum(['recipe','ingredients','suppliers','purchases','operations','catalogue']),observedAt:z.string().datetime({offset:true}),
 // Explicit, bounded projection; never a raw arbitrary workbook or customer dump.
 columns:z.array(z.string().max(150)).min(1).max(40),rows:z.array(z.array(z.union([z.string().max(2000),z.number().finite(),z.null()])).max(40)).max(500),
 formulas:z.array(z.object({cell:z.string().regex(/^[A-Z]{1,2}[1-9]\d{0,3}$/),formula:z.string().max(1000)}).strict()).max(500),issues:z.array(z.string().max(500)).max(30),sourceHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
