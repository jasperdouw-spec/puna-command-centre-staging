'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, Check, Pencil, RefreshCw, X} from 'lucide-react';
import CommerceEditor from './commerce-editor';
import SourceImport from './source-import';

type Product = {id: string; name: string; description: string; price_cents: number; available: number | boolean; kind: string; source_status: string; version: number};
type Draft = Product & {price: string; confirmed: boolean};
const money = (cents: number) => new Intl.NumberFormat('en-CA', {style: 'currency', currency: 'CAD'}).format(cents / 100);
const draftFrom = (product: Product): Draft => ({...product, price: (product.price_cents / 100).toFixed(2), confirmed: false});

export default function ProductWorkspace() {
  const [revision, setRevision] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);
  const product = products.find(item => item.id === selected);
  const draft = product ? drafts[product.id] || draftFrom(product) : null;

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/products', {cache: 'no-store'});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Unable to load products');
      setProducts(data.products); setDrafts({});
    } catch (cause) {setError((cause as Error).message)}
    finally {setLoading(false)}
  }
  useEffect(() => {void load()}, []);
  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!selected && dialog.current?.open) dialog.current.close();
  }, [selected]);

  function open(item: Product) {
    setError(''); setNotice('');
    setDrafts(previous => ({...previous, [item.id]: previous[item.id] || draftFrom(item)}));
    setSelected(item.id);
  }
  function edit(changes: Partial<Draft>) {
    if (!draft) return;
    setDrafts(previous => ({...previous, [draft.id]: {...draft, ...changes, confirmed: changes.confirmed ?? false}}));
    setNotice('');
  }
  async function save() {
    if (!draft || busy) return;
    setError(''); setNotice('');
    if (!/^\d+(\.\d{1,2})?$/.test(draft.price)) {setError('Enter a price with no more than two decimal places.'); return}
    const priceCents = Math.round(Number(draft.price) * 100);
    if (!Number.isSafeInteger(priceCents) || priceCents < 0 || priceCents > 100000) {setError('Enter a price between $0.00 and $1,000.00.'); return}
    setBusy(true);
    try {
      const response = await fetch('/api/products', {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: draft.id, version: draft.version, name: draft.name, description: draft.description, price_cents: priceCents, available: Boolean(draft.available), confirm: draft.confirmed})});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Product could not be saved.');
      const saved: Product = {...draft, price_cents: priceCents, version: data.version, source_status: data.source_status};
      setProducts(previous => previous.map(item => item.id === saved.id ? saved : item));
      setDrafts(previous => ({...previous, [saved.id]: draftFrom(saved)}));
      setNotice('Product saved');
    } catch (cause) {setError((cause as Error).message)}
    finally {setBusy(false)}
  }
  function close() {if (!busy) setSelected(null)}
  const changed = (item: Product) => {
    const value = drafts[item.id];
    return !!value && (value.name !== item.name || value.description !== item.description || Math.round(Number(value.price) * 100) !== item.price_cents || Boolean(value.available) !== Boolean(item.available) || value.confirmed);
  };

  return <>
    <div className="pw-section-head"><div><h2>Menu items</h2><p className="pw-muted">Select a product to edit its details.</p></div><button type="button" onClick={load} disabled={busy || loading}><RefreshCw size={15} aria-hidden="true"/>Reload products</button></div>
    {!selected && error && <p className="pw-alert" role="alert">{error}</p>}
    {!selected && notice && <p className="pw-success" role="status">{notice}</p>}
    {loading && !products.length ? <p className="pw-empty" role="status">Loading your menu…</p> : !products.length && !error ? <div className="pw-empty"><h2>Your menu is ready to begin</h2><p>Imported products will appear here for review and editing.</p></div> : products.length > 0 && <div className="pw-table-wrap"><table className="pw-table"><thead><tr><th>Product</th><th>Price</th><th className="pw-menu-availability">Availability</th><th><span className="pw-muted">Edit</span></th></tr></thead><tbody>{products.map(item => <tr key={item.id}><td><strong>{item.name}</strong><span className="pw-order-id">{item.kind === 'frozen' ? 'Frozen / internal' : 'Fresh menu'}{changed(item) ? ' · Unsaved changes' : ''}</span><span className="pw-menu-mobile-status">{item.available ? 'Available' : 'Unavailable'}</span></td><td className="pw-number">{money(item.price_cents)}</td><td className="pw-menu-availability"><span className={'pw-badge ' + (item.available ? 'pw-ready' : '')}>{item.available ? 'Available' : 'Unavailable'}</span></td><td><button type="button" className="pw-icon-button" aria-label={'Edit ' + item.name} onClick={() => open(item)}><Pencil size={17} aria-hidden="true"/><span className="pw-menu-edit-label">Edit</span></button></td></tr>)}</tbody></table></div>}

    <dialog className="pw-drawer" ref={dialog} aria-label="Edit menu item" onCancel={event => {if (busy) event.preventDefault(); else close()}} onClose={close}>
      {draft && <><div className="pw-drawer-head"><div><p className="pw-kicker">MENU ITEM</p><h2>{product?.name}</h2><p className="pw-muted">Changes are saved to the staging catalogue.</p></div><button type="button" className="pw-icon-button" aria-label="Close menu item" onClick={close} disabled={busy}><X size={19} aria-hidden="true"/></button></div>
      <form onSubmit={event => {event.preventDefault(); void save()}}><fieldset disabled={busy}>
        <label htmlFor="pw-product-name">Name</label><input id="pw-product-name" required maxLength={120} value={draft.name} onChange={event => edit({name: event.target.value})}/>
        <label htmlFor="pw-product-description">Description</label><textarea id="pw-product-description" rows={5} maxLength={10000} value={draft.description} onChange={event => edit({description: event.target.value})}/>
        <label htmlFor="pw-product-price">Price (CAD)</label><input id="pw-product-price" type="number" required min="0" max="1000" step="0.01" inputMode="decimal" value={draft.price} onChange={event => edit({price: event.target.value})}/>
        <label className="pw-checkbox"><input type="checkbox" checked={Boolean(draft.available)} onChange={event => edit({available: event.target.checked})}/>Available</label>
        <p className="pw-readonly-note">Current record: {draft.source_status.replaceAll('_', ' ')}. Saving an edit and confirming product details are separate choices.</p>
        <label className="pw-checkbox"><input type="checkbox" checked={draft.confirmed} onChange={event => edit({confirmed: event.target.checked})}/>I confirm these product details</label>
        {error && <p className="pw-alert" role="alert">{error}</p>}{notice && <p className="pw-success" role="status">{notice}</p>}
        <div className="pw-actions"><button type="submit" className="pw-primary"><Check size={16} aria-hidden="true"/>{busy ? 'Saving…' : 'Save product'}</button><button type="button" onClick={close}>Close</button></div>
      </fieldset></form></>}
    </dialog>

    <details className="pw-panel pw-advanced"><summary>Advanced checkout settings <ArrowUpRight size={14} aria-hidden="true"/></summary><CommerceEditor key={revision}/></details>
    <SourceImport onImported={async () => {await load(); setRevision(value => value + 1)}}/>
  </>;
}
