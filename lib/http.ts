import {NextResponse} from 'next/server';
export function json(value:unknown,status=200){return NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}})}
export function failure(e:unknown){
 const m=(e as Error).message,d=e as {errno?:unknown;sqlState?:unknown};
 // Driver messages may contain SQL values. Record only numeric diagnostics.
 if(Number.isInteger(d?.errno))console.error('database-request-failure',JSON.stringify({errno:d.errno,sqlState:typeof d.sqlState==='string'&&/^[0-9A-Z]{5}$/.test(d.sqlState)?d.sqlState:null}));
 return json({error:m==='UNAUTHENTICATED'?'Sign in required':m==='FORBIDDEN'?'Access denied':'Service unavailable'},m==='UNAUTHENTICATED'?401:m==='FORBIDDEN'?403:503);
}
