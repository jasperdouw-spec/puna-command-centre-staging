'use client';

import {useEffect, useState} from 'react';
import {ArrowUpRight, Check, Eye, FileText, RefreshCw} from 'lucide-react';
import {initialSettings, type Settings} from '@/lib/puna';

type WebsiteDraft = {id: number; base_version: number; value: string; created_at?: string};
const fields = [
  ['storyHeading', 'Story heading', 100, 2],
  ['headline', 'Homepage headline', 100, 2],
  ['intro', 'Homepage introduction', 300, 3],
  ['story', 'PUNA story', 4000, 8],
  ['location', 'Location', 500, 2],
  ['hours', 'Opening hours', 700, 3],
] as const;

export default function WebsiteEditor() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(true);
  const [drafts, setDrafts] = useState<WebsiteDraft[]>([]);
  const busy = !!saving || loading;

  async function load() {
    setLoading(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/website', {cache: 'no-store'});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Unable to load website settings');
      setSettings({...initialSettings, ...data.settings});
      setVersion(data.version); setDrafts(data.drafts || []);
    } catch (cause) {setError((cause as Error).message)}
    finally {setLoading(false)}
  }
  useEffect(() => {void load()}, []);

  async function save(kind: 'draft' | 'publish') {
    if (!settings || busy) return;
    setSaving(kind); setError(''); setMessage('');
    try {
      const response = await fetch('/api/website', {method: kind === 'draft' ? 'POST' : 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({settings, version})});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Website details could not be saved');
      if (kind === 'publish') {setVersion(data.version); setMessage('Website details saved')}
      else {
        setDrafts(previous => [{id: data.id, base_version: version, value: JSON.stringify(settings), created_at: new Date().toISOString()}, ...previous].slice(0, 20));
        setMessage('Draft saved privately. Staging homepage unchanged.');
      }
    } catch (cause) {setError((cause as Error).message)}
    finally {setSaving(null)}
  }

  function loadDraft(item: WebsiteDraft) {
    try {
      const next = {...initialSettings, ...JSON.parse(item.value)};
      if (fields.some(([key]) => typeof next[key] !== 'string')) throw Error('This saved draft could not be read.');
      setSettings(next); setVersion(item.base_version); setError('');
      setMessage('Draft loaded. Publishing checks for conflicts with newer content.');
    } catch (cause) {setError((cause as Error).message)}
  }

  return <>
    <div className="pw-section-head"><div><h2>Website content & hours</h2><p className="pw-muted">Save a private draft, or publish your changes to staging.</p></div><button type="button" disabled={busy} onClick={load}><RefreshCw size={15} aria-hidden="true"/>Reload website details</button></div>
    {error && <p className="pw-alert" role="alert">{error}</p>}
    {message && <p className="pw-success" role="status">{message}</p>}
    {loading && !settings && <p className="pw-empty" role="status">Loading website details…</p>}
    {settings && <div className="pw-content-editor">
      <form className="pw-panel" onSubmit={event => {event.preventDefault(); void save('publish')}}><fieldset disabled={busy}>
        {fields.map(([key, label, max, rows]) => <div className="pw-field" key={key}><label htmlFor={'website-' + key}>{label}</label><textarea id={'website-' + key} required maxLength={max} rows={rows} value={settings[key]} onChange={event => {setSettings({...settings, [key]: event.target.value}); setMessage('')}}/></div>)}
        <div className="pw-actions"><button type="submit" className="pw-primary"><Check size={16} aria-hidden="true"/>{saving === 'publish' ? 'Publishing…' : 'Publish to staging'}</button><button type="button" onClick={() => void save('draft')}><FileText size={16} aria-hidden="true"/>{saving === 'draft' ? 'Saving…' : 'Save draft'}</button></div>
        <p className="pw-muted">These controls update the staging homepage. Public launch is managed separately.</p>
      </fieldset></form>
      <aside className="pw-site-preview" aria-label="Website draft preview"><div className="pw-section-head"><h2>Preview</h2><button type="button" aria-pressed={preview} onClick={() => setPreview(value => !value)}><Eye size={16} aria-hidden="true"/>Preview draft</button></div>
        {preview && <article className="pw-panel"><p className="pw-kicker">DRAFT PREVIEW — NOT PUBLISHED</p><div className="pw-preview-heading"><p className="pw-kicker">OUR STORY</p><h3>{settings.storyHeading}</h3></div><h3 className="pw-preview-copy">{settings.headline}</h3><p className="pw-preview-copy">{settings.intro}</p><p className="pw-preview-copy">{settings.story}</p><h3>Find Puna</h3><p className="pw-preview-copy">{settings.location}</p><p className="pw-preview-copy">{settings.hours}</p></article>}
        <a className="pw-button" href="/" target="_blank" rel="noreferrer">View staging homepage <ArrowUpRight size={16} aria-hidden="true"/></a>
        {drafts.length > 0 && <details className="pw-panel"><summary>Saved drafts</summary><div className="pw-draft-list">{drafts.map(item => <button type="button" key={item.id} disabled={busy} onClick={() => loadDraft(item)}>Load draft {item.id}<span className="pw-muted">Version {item.base_version}</span></button>)}</div></details>}
      </aside>
    </div>}
  </>;
}
