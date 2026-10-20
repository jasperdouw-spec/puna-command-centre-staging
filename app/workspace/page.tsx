import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import OrbitalWorkspace from './orbital';
export const dynamic='force-dynamic';
export default async function Workspace(){const user=await currentUser();if(!user)redirect('/sign-in');if(user.role!=='owner')redirect('/food-truck');return <div className="workspace-theme"><main className="shell"><p className="eyebrow">PUNA / BUSINESS OPERATIONS</p><h1>Business Command Centre</h1><p className="subtle">Welcome, {user.display_name}</p><a href="/">View Puna website</a><OrbitalWorkspace/></main></div>}
