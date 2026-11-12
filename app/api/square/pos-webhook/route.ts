import {handlePosWebhook} from '@/lib/kitchen-square';
import {KitchenError} from '@/lib/kitchen';
import {boundedText} from '@/lib/ordering-gates';
import {json} from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request){try{return json(await handlePosWebhook(await boundedText(req,65536),req.headers.get('x-square-hmacsha256-signature')));}catch(e){return json({error:e instanceof KitchenError?e.message:'Square POS reconciliation unavailable'},e instanceof KitchenError?e.status:503);}}
