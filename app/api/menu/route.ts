import {z} from 'zod';
import {requireRole,checkOrigin} from '@/lib/auth';
import {json,failure} from '@/lib/http';
import {boundedText} from '@/lib/ordering-gates';
import {CommerceError} from '@/lib/commerce-model';
import {ownerMenu,changeMenu} from '@/lib/menu';
import {menuDraftSchema} from '@/lib/menu-model';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{await requireRole(['owner']);return json(await ownerMenu());}catch(e){return failure(e);}}
const input=z.object({action:z.enum(['create','save','publish','unpublish','archive','restore','clone']),key:z.string().uuid(),id:z.string().min(1).max(64).optional(),version:z.number().int().positive().optional(),draft:menuDraftSchema.optional(),revision:z.number().int().positive().optional(),confirmed:z.boolean().optional(),ingredientsConfirmed:z.boolean().optional()}).strict();
export async function POST(req:Request){if(!checkOrigin(req))return json({error:'Invalid origin'},403);try{const u=await requireRole(['owner']);const raw=await boundedText(req,30000);const p=input.safeParse(JSON.parse(raw));if(!p.success)return json({error:'Check product fields and schedule.'},400);return json(await changeMenu(u.id,p.data));}catch(e){if(e instanceof SyntaxError||e instanceof z.ZodError)return json({error:'Invalid product details'},400);return e instanceof CommerceError?json({error:e.code},e.status):failure(e);}}
