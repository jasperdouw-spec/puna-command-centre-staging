'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import UnifiedMenu from './unified-menu';
import type {Product} from '@/lib/puna';
// Reuse the real public component without an iframe or any CSP relaxation.
// The visible kitchen remains mounted and continues its authenticated heartbeat.
export default function CustomerPreview({onClose}:{onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),[products,setProducts]=useState<Product[]>([]);
 useEffect(()=>{void fetch('/api/puna',{cache:'no-store'}).then(r=>r.json()).then(d=>setProducts(d.products||[]));},[]);
 useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close();},[]);
 return createPortal(<dialog ref={ref} className="customer lk-cabinet-dialog" aria-label="Customer menu preview" onCancel={onClose} onClose={onClose}><header><p>Customer menu · live public availability · checkout closed</p><button type="button" onClick={onClose}>Close customer preview</button></header><UnifiedMenu products={products} readOnly/></dialog>,document.body);
}
