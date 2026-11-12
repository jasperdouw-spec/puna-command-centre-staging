import {notFound,redirect} from 'next/navigation';import {currentUser} from '@/lib/auth';import {orderingLocal} from '@/lib/ordering-gates';import Scanner from '../../ordering/scanner';import {pageMetadata} from '@/lib/site-metadata';
export const dynamic='force-dynamic';export const metadata=pageMetadata('Pickup scanner | PUNA','Private worker pickup inspection.');
export default async function Page(){if(!orderingLocal())notFound();const u=await currentUser();if(!u)redirect('/sign-in');return <Scanner/>;}
