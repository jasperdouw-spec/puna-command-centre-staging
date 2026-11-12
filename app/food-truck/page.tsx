import PickupQueue from '../ordering/worker';
import {orderingLocal} from '@/lib/ordering-gates';
import LiveKitchen from '../live-kitchen/live-kitchen';
import {kitchenEnabled} from '@/lib/kitchen';
import {currentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
import Operations from '../workspace/operations';
import SignOut from '../workspace/sign-out';
export const dynamic='force-dynamic';
export default async function FoodTruck(){const u=await currentUser();if(!u)redirect('/sign-in');const live=kitchenEnabled();return <div className={live?'workspace-theme live-kitchen-workspace':'workspace-theme'}><main className="shell"><p className="eyebrow">PUNA / FOOD-TRUCK WORKSPACE</p><h1>Welcome, {u.display_name}</h1><nav><a href="/">View website</a> {u.role==='owner'&&<a href="/workspace">Owner dashboard</a>} <SignOut/></nav>{orderingLocal()&&<PickupQueue manager={u.role==='owner'||u.role==='manager'}/>}
{live?<><LiveKitchen/><details><summary>Detailed tools & legacy pickups</summary><Operations worker/></details></>:<Operations worker/>}</main></div>}
