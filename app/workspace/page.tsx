import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import ProductWorkspace from './products';
export const dynamic='force-dynamic';
export default async function Workspace(){const user=await currentUser();if(!user)redirect('/sign-in');return <main className="shell"><p className="eyebrow">PUNA / SECURE WORKSPACE</p><h1>Welcome, {user.display_name}</h1><p className="subtle">Role: {user.role}. Development workspace; the orbital UI will be integrated after functional verification.</p>{user.role==='staff'?<section className="panel"><h2>Food Truck</h2><a href="https://squareup.com/dashboard" target="_blank" rel="noreferrer">Open Square website ↗</a></section>:<ProductWorkspace/>}</main>}
