'use client';
import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import Availability from './public-availability';
// Reuse the real public component without an iframe or any CSP relaxation.
// The visible kitchen remains mounted and continues its authenticated heartbeat.
export default function CustomerPreview({onClose}:{onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close();},[]);
 return createPortal(<dialog ref={ref} className="customer lk-cabinet-dialog" aria-label="Customer cabinet preview" onCancel={onClose} onClose={onClose}><header><p>Customer cabinet · live public availability · checkout closed</p><button type="button" onClick={onClose}>Close customer preview</button></header><Availability/></dialog>,document.body);
}
