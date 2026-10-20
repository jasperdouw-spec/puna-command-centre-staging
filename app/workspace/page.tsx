import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import OrbitalWorkspace from './orbital';
export const dynamic='force-dynamic';
export default async function Workspace(){const user=await currentUser();if(!user)redirect('/sign-in');return <main className="shell"><p className="eyebrow">PUNA / BUSINESS OPERATIONS</p><h1>Business Command Centre</h1><p className="subtle">Welcome, {user.display_name}</p>{user.role==='staff'?<section className="panel"><h2>Food Truck</h2><p>Product management is restricted to owners and managers.</p></section>:<OrbitalWorkspace/>}</main>}
