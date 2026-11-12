import {json,failure} from '@/lib/http';
import {publicAvailability} from '@/lib/kitchen';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{return json(await publicAvailability());}catch(e){return failure(e);}}
