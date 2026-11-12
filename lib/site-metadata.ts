import type {Metadata} from 'next';
// Production indexing requires a reviewed release, not NODE_ENV=production alone.
export const PUBLIC_INDEXING_RELEASE_APPROVED = false;
export const isPublicProduction = PUBLIC_INDEXING_RELEASE_APPROVED && process.env.PUNA_SITE_ENV === 'production';
export const siteOrigin = isPublicProduction ? 'https://punaempanadas.ca' : 'https://staging.punaempanadas.ca';
export const privatePaths = ['/workspace','/food-truck','/dashboard','/sign-in','/setup','/recover','/cart','/receipt','/api'];
export function pageMetadata(title:string,description:string):Metadata {
 return {title,description,robots:{index:false,follow:false},openGraph:{type:'website',locale:'en_CA',siteName:'PUNA',title,description,images:[{url:'/social/puna-social.jpg',width:1200,height:630,alt:'PUNA — Andean roots. West Coast life.'}]},twitter:{card:'summary_large_image',title,description,images:['/social/puna-social.jpg']}};
}
