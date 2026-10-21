import {currentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
import Operations from '../workspace/operations';
import SignOut from '../workspace/sign-out';
export const dynamic='force-dynamic';
export default async function FoodTruck(){const u=await currentUser();if(!u)redirect('/sign-in');return <div className="workspace-theme"><main className="shell"><p className="eyebrow">PUNA / FOOD-TRUCK WORKSPACE</p><h1>Welcome, {u.display_name}</h1><nav><a href="/">View website</a> {u.role==='owner'&&<a href="/workspace">Owner dashboard</a>} <SignOut/></nav><Operations worker/></main></div>}
