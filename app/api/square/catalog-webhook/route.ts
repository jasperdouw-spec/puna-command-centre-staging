import {catalogWebhook} from '@/lib/square-catalog';
import {boundedText} from '@/lib/ordering-gates';
import {CommerceError} from '@/lib/commerce-model';
import {json} from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request){try{return json(await catalogWebhook(await boundedText(req,64000),req.headers.get('x-square-hmacsha256-signature')));}catch(e){return json({error:e instanceof CommerceError?e.code:'Invalid catalog event'},e instanceof CommerceError?e.status:400);}}
