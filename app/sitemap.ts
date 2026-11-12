import type {MetadataRoute} from 'next';
import {isPublicProduction,siteOrigin} from '@/lib/site-metadata';
export default function sitemap():MetadataRoute.Sitemap {return isPublicProduction?[{url:siteOrigin+'/',changeFrequency:'weekly'}]:[];}
