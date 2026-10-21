'use client';
import {useEffect,useRef,useState} from 'react';
export default function ReceiptCode({reference}:{reference:string}){
 const canvas=useRef<HTMLCanvasElement>(null),[error,setError]=useState(false);
 useEffect(()=>{let live=true;import('qrcode').then(async m=>{if(live&&canvas.current)await m.default.toCanvas(canvas.current,reference,{width:280,margin:4,errorCorrectionLevel:'M'})}).catch(()=>setError(true));return()=>{live=false}},[reference]);
 return <div><canvas ref={canvas} aria-label="Private collection QR code" style={{maxWidth:'100%',height:'auto'}}/>{error&&<p>Use the text reference below.</p>}<p>This code is private. Staff must sign in and verify payment before collection.</p></div>;
}
