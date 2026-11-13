import {z} from 'zod';
export const cropSchema=z.object({x:z.number().int().min(0).max(100),y:z.number().int().min(0).max(100),zoom:z.number().int().min(100).max(200)}).strict();
export const cropKey=(c:z.infer<typeof cropSchema>)=>`${c.x}-${c.y}-${c.zoom}`;
export const menuDraftSchema=z.object({
 name:z.string().trim().min(1).max(120),description:z.string().trim().max(10000),
 ingredients:z.string().trim().max(5000),allergens:z.string().trim().max(2000),
 priceCents:z.number().int().min(0).max(100000).nullable(),
 category:z.enum(['empanada','sauce','drink','ingredient']),variationLabel:z.string().trim().max(120),
 weekly:z.boolean(),ovenEligible:z.boolean(),startsAt:z.string().datetime().nullable(),endsAt:z.string().datetime().nullable(),
 photoId:z.string().uuid().nullable(),crop:cropSchema,photoAlt:z.string().trim().max(240),
 squareCandidate:z.string().trim().max(100)
}).strict().superRefine((d,c)=>{if(d.endsAt&&d.startsAt&&Date.parse(d.endsAt)<=Date.parse(d.startsAt))c.addIssue({code:'custom',message:'End must be after start'});if(d.category!=='empanada'&&(d.ovenEligible||d.weekly))c.addIssue({code:'custom',message:'Only empanadas use oven batches or Weekly Special'});});
export type MenuDraft=z.infer<typeof menuDraftSchema>;
export function scheduleActive(starts:string|null,ends:string|null,now:number){return (!starts||Date.parse(starts)<=now)&&(!ends||Date.parse(ends)>now);}
// SQL aliases are fixed internal identifiers, never request input.
export const menuActiveSql="(u.product_id IS NULL OR (u.archived=0 AND (u.starts_at IS NULL OR u.starts_at<=UTC_TIMESTAMP(3)) AND (u.ends_at IS NULL OR u.ends_at>UTC_TIMESTAMP(3))))";
export function sauceSuggestion(empanadas:number,available:number){return Math.max(0,Math.min(Math.ceil(empanadas/2),Math.floor(available)));}
export function photoUrl(id:string,crop:string,width=640,format='webp'){return `/api/menu-media/${id}/${crop}-${width}.${format}`;}
