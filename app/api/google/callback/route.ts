import {NextResponse} from 'next/server';
import {finishGoogle} from '@/lib/google-identity';
export const runtime='nodejs';
export async function GET(req:Request){const u=new URL(req.url),code=u.searchParams.get('code'),state=u.searchParams.get('state');if(!code||!state)return NextResponse.redirect(new URL('/sign-in?identity=failed',req.url));try{await finishGoogle(code,state);return NextResponse.redirect(new URL('/workspace',req.url))}catch{return NextResponse.redirect(new URL('/sign-in?identity=failed',req.url))}}
