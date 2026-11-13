import {boundedArray} from './bounded-array';
import {z} from 'zod';
const uuid=z.string().uuid(),quantity=z.number().int().min(1).max(500),channel=z.enum(['online','truck']),stage=z.enum(['ready','baking']),reason=z.string().trim().min(5).max(500);
const base={key:uuid,clientId:uuid,version:z.number().int().positive()};
export const kitchenInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('inspect'),clientId:uuid}).strict(),
 z.object({action:z.literal('heartbeat'),clientId:uuid}).strict(),
 z.object({...base,action:z.literal('connect'),checked:z.literal(true)}).strict(),
 z.object({...base,action:z.literal('mode'),mode:z.enum(['open','paused','closed']),closesAt:z.string().datetime().optional()}).strict(),
 z.object({...base,action:z.literal('service-policy'),reviewMinutes:z.number().int().min(60).max(720),prepMinutes:z.number().int().min(5).max(60),windowMinutes:z.number().int().min(5).max(60),capacityOrders:z.number().int().min(1).max(100),capacityUnits:z.number().int().min(1).max(500)}).strict(),
 z.object({...base,action:z.literal('confidence'),reason:reason.max(240)}).strict(),
 z.object({...base,action:z.literal('start'),productId:z.string().min(1).max(64),quantity,online:z.number().int().min(0).max(500),minutes:z.number().int().min(1).max(240)}).strict(),
 z.object({...base,action:z.literal('count'),productId:z.string().min(1).max(64),quantity,online:z.number().int().min(0).max(500),reason}).strict(),
 z.object({...base,action:z.literal('display-step'),productId:z.string().min(1).max(64),delta:z.union([z.literal(-1),z.literal(1)])}).strict(),
 z.object({...base,action:z.literal('oven-step'),lotId:uuid,delta:z.union([z.literal(-1),z.literal(1)])}).strict(),
 z.object({...base,action:z.literal('cancel-batch'),lotId:uuid,reason}).strict(),
 z.object({...base,action:z.literal('estimate'),lotId:uuid,minutes:z.number().int().min(1).max(240)}).strict(),
 z.object({...base,action:z.literal('ready'),lotId:uuid,quantity}).strict(),
 z.object({...base,action:z.literal('delay'),lotId:uuid,minutes:z.number().int().min(-60).max(120),reason}).strict(),
 z.object({...base,action:z.literal('transfer'),lotId:uuid,channel,stage,quantity}).strict(),
 z.object({...base,action:z.literal('waste'),lotId:uuid,channel,stage,quantity,reason}).strict(),
 z.object({...base,action:z.literal('correct'),lotId:uuid,channel,stage,quantity:z.number().int().min(0).max(500),reason}).strict(),
 z.object({...base,action:z.literal('counter-reserve'),lotId:uuid,quantity}).strict(),
 z.object({...base,action:z.literal('counter-finish'),id:uuid,confirmed:z.literal(true)}).strict(),
 z.object({...base,action:z.literal('counter-release'),id:uuid,confirmedUnpaid:z.literal(true),reason}).strict(),
 z.object({...base,action:z.literal('set-aside'),id:uuid}).strict(),
 z.object({...base,action:z.literal('hold-policy'),seconds:z.number().int().min(60).max(900)}).strict(),
 // Available only inside the guarded disposable preview, never customer checkout.
 z.object({...base,action:z.literal('fixture-reserve'),items:boundedArray(z.object({lotId:uuid,quantity}).strict(),10,1),pickupAt:z.string().datetime(),label:z.string().trim().min(1).max(80)}).strict(),
 z.object({...base,action:z.literal('fixture-payment'),id:uuid,state:z.enum(['pending','uncertain','paid','failed'])}).strict(),
 z.object({...base,action:z.literal('fixture-collect'),id:uuid}).strict(),
]);
export type KitchenInput=z.infer<typeof kitchenInput>;
