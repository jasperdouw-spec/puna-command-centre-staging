import {boundedArray} from './bounded-array';
import {z} from 'zod';
const token=z.string().regex(/^[a-f0-9]{64}$/),key=z.string().uuid(),number=z.string().regex(/^PUNA-[A-F0-9]{10}$/);
export const orderingInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('session')}).strict(),
 z.object({action:z.literal('quote'),items:boundedArray(z.object({offer:z.string().min(20).max(1500),quantity:z.number().int().min(1).max(500)}).strict(),20,1)}).strict(),
 z.object({action:z.literal('reserve'),checkoutKey:key,accessKey:token,quoteToken:z.string().min(20).max(12000),name:z.string().trim().min(1).max(80),email:z.string().email().max(254)}).strict(),
 z.object({action:z.literal('pay'),token}).strict(),
 z.object({action:z.literal('status'),token}).strict(),
 z.object({action:z.literal('cancel'),token}).strict(),
 z.object({action:z.literal('reconcile'),token}).strict()
]);
const mutation={orderNumber:number,version:z.number().int().positive(),key};
export const pickupInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('inspect'),pickupToken:token}).strict(),
 z.object({action:z.literal('manual-lookup'),orderNumber:number,email:z.string().email().max(254)}).strict(),
 z.object({action:z.literal('set-aside'),...mutation}).strict(),
 z.object({action:z.literal('pack'),...mutation}).strict(),
 z.object({action:z.literal('handover'),...mutation,pickupToken:token.optional(),manualEmail:z.string().email().max(254).optional(),reason:z.string().trim().min(5).max(300).optional()}).strict(),
 z.object({action:z.literal('reissue'),...mutation,reason:z.string().trim().min(5).max(300)}).strict(),
 z.object({action:z.literal('resolve-late'),...mutation,reason:z.string().trim().min(5).max(300)}).strict(),
 z.object({action:z.literal('resolve-delay'),...mutation,reason:z.string().trim().min(5).max(300)}).strict(),
 z.object({action:z.literal('refund'),...mutation,reason:z.string().trim().min(5).max(300)}).strict(),
 z.object({action:z.literal('cancel'),...mutation,reason:z.string().trim().min(5).max(300)}).strict()
]);
