import {notFound} from 'next/navigation';import {orderingLocal} from '@/lib/ordering-gates';import OrderStatus from '../ordering/status';import {pageMetadata} from '@/lib/site-metadata';
export const dynamic='force-dynamic';export const metadata=pageMetadata('Your pickup | PUNA','Private order status and pickup pass.');
export default function Page(){if(!orderingLocal())notFound();return <OrderStatus/>;}
