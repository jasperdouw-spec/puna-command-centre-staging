import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import PunaWorkspace from './workspace';
export const dynamic='force-dynamic';
export const metadata={title:'Puna Workspace'};
export default async function Workspace(){const user=await currentUser();if(!user)redirect('/sign-in');if(user.role!=='owner')redirect('/food-truck');return <PunaWorkspace displayName={user.display_name}/>}
