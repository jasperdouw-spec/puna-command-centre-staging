import {orderingLocal} from '@/lib/ordering-gates';
import LocalCheckout from '../ordering/checkout';
export const dynamic='force-dynamic';
import {pageMetadata} from '@/lib/site-metadata';
export const metadata=pageMetadata('Your bag | PUNA','Review your PUNA bag. Online ordering remains closed on staging.');
import PunaApp from '../puna-app';
export default function Cart(){return orderingLocal()?<LocalCheckout/>:<PunaApp cartPage/>}
