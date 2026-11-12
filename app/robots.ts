import type {MetadataRoute} from 'next';
import {isPublicProduction,siteOrigin,privatePaths} from '@/lib/site-metadata';
export default function robots():MetadataRoute.Robots {
 // Allow public-page retrieval so crawlers can observe staging's noindex headers.
 // Robots exclusions are not access control; staff APIs still require authentication.
 return {rules:{userAgent:'*',allow:'/',disallow:privatePaths},...(isPublicProduction?{sitemap:siteOrigin+'/sitemap.xml'}:{})};
}
