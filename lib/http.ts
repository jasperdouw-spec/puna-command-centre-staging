import {NextResponse} from 'next/server';
export function json(value:unknown,status=200){return NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}})}
export function failure(e:unknown){const m=(e as Error).message;return json({error:m==='UNAUTHENTICATED'?'Sign in required':m==='FORBIDDEN'?'Access denied':'Service unavailable'},m==='UNAUTHENTICATED'?401:m==='FORBIDDEN'?403:503)}
