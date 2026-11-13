import {z} from 'zod';
import {requireRole,checkOrigin} from '@/lib/auth';
import {boundedText} from '@/lib/ordering-gates';
import {json,failure} from '@/lib/http';
import {CommerceError} from '@/lib/commerce-model';
import {SalesError} from '@/lib/sales-model';
import {ownerCatalog,syncSquareCatalog,changeCatalog} from '@/lib/square-catalog';
import {beginSquareAuthorization} from '@/lib/square-reporting';
export const runtime='nodejs';
export const maxDuration=60;
const id=z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),base={key:z.string().uuid(),generation:z.number().int().nonnegative()};
const command=z.discriminatedUnion('action',[
 z.object({action:z.literal('sync')}).strict(),z.object({action:z.literal('authorize')}).strict(),
 z.object({...base,action:z.literal('location'),locationId:id,note:z.string().trim().min(20).max(1000)}).strict(),
 z.object({...base,action:z.literal('map'),productId:z.string().min(1).max(64),variationId:id,version:z.number().int().positive()}).strict(),
 z.object({...base,action:z.literal('review'),productId:z.string().min(1).max(64),version:z.number().int().positive(),commercialHash:z.string().regex(/^[a-f0-9]{64}$/),depositCents:z.number().int().min(0).max(10000),depositTaxable:z.boolean(),note:z.string().trim().min(20).max(1000)}).strict()
]);
const error=(e:unknown)=>e instanceof CommerceError||e instanceof SalesError?json({error:e.code},e.status):e instanceof SyntaxError||e instanceof z.ZodError?json({error:'Check the catalog review fields.'},400):failure(e);
export async function GET(){try{await requireRole(['owner']);return json(await ownerCatalog());}catch(e){return error(e);}}
export async function POST(req:Request){if(!checkOrigin(req))return json({error:'Invalid origin'},403);try{const u=await requireRole(['owner']),p=command.parse(JSON.parse(await boundedText(req,6000)));if(p.action==='authorize')return json(await beginSquareAuthorization(u.id,true));if(p.action==='sync')return json(await syncSquareCatalog(u.id,true));return json(await changeCatalog(u.id,p));}catch(e){return error(e);}}
