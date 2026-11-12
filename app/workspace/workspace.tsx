'use client';

import {useEffect, useRef, useState, type KeyboardEvent, type ReactNode} from 'react';
import {ArrowUpRight, ChefHat, ChevronRight, LogOut, Menu as MenuIcon, PanelTop, ReceiptText, Settings2, Sun, Users, Utensils, X} from 'lucide-react';
import ProductWorkspace from './products';
import WebsiteEditor from './website';
import Accounts from './accounts';
import Operations from './operations';
import LiveKitchen from '../live-kitchen/live-kitchen';
import GoogleLink from './google-link';
import Records from './records';
import Customers from './customers';
import WorkspaceDesk from './workspace-desk';
import './workspace.css';

type Section = 'today' | 'orders' | 'customers' | 'menu' | 'kitchen' | 'website' | 'settings';
type Selection = {section: Section; tab: string};
const sections = [
  {id: 'today', label: 'Today', icon: Sun, subtitle: 'The orders, pickups and small details that need your attention.'},
  {id: 'orders', label: 'Orders', icon: ReceiptText, subtitle: 'A clear view of each order, from payment to pickup.'},
  {id: 'customers', label: 'Customers', icon: Users, subtitle: 'Order history and useful notes, kept together.'},
  {id: 'menu', label: 'Menu', icon: Utensils, subtitle: 'Your products, prices and availability in one place.'},
  {id: 'kitchen', label: 'Kitchen', icon: ChefHat, subtitle: 'Prepare the next batch and keep stock up to date.'},
  {id: 'website', label: 'Website', icon: PanelTop, subtitle: 'Keep your story, opening hours and practical details current.'},
  {id: 'settings', label: 'Team & settings', icon: Settings2, subtitle: 'Team access, pickup schedules and the details behind the day.'},
] as const;
const groups: Partial<Record<Section, Array<{id: string; label: string}>>> = {
  today: [{id: 'overview', label: 'Overview'}, {id: 'sales', label: 'Sales reports'}, {id: 'costs', label: 'Costs'}],
  kitchen: [{id: 'pickup', label: 'Pickup queue'}, {id: 'inventory', label: 'Inventory'}, {id: 'recipes', label: 'Recipes & production'}],
  settings: [{id: 'team', label: 'Team access'}, {id: 'schedule', label: 'Pickup schedule'}, {id: 'feedback', label: 'Feedback'}, {id: 'audit', label: 'Audit'}],
};
const initialTabs: Record<Section, string> = {today: 'overview', orders: '', customers: '', menu: '', kitchen: 'pickup', website: '', settings: 'team'};

function fromLocation(): Selection {
  const query = new URLSearchParams(window.location.search);
  const view = query.get('view') || 'today';
  const legacy: Record<string, Selection> = {
    edit: {section: 'menu', tab: ''}, content: {section: 'website', tab: ''},
    staff: {section: 'settings', tab: 'team'}, truck: {section: 'kitchen', tab: 'pickup'},
  };
  if (legacy[view]) return legacy[view];
  const section = sections.some(s => s.id === view) ? view as Section : 'today';
  const requested = query.get('tab');
  const tab = groups[section]?.some(t => t.id === requested) ? requested! : initialTabs[section];
  return {section, tab};
}

export default function PunaWorkspace({displayName = 'Owner', liveKitchen = false}: {displayName?: string; liveKitchen?: boolean}) {
  const [section, setSection] = useState<Section>('today');
  const [tabs, setTabs] = useState(initialTabs);
  const [visited, setVisited] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const content = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const active = sections.find(s => s.id === section)!;
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'P';

  function remember(next: Selection) {
    document.querySelectorAll<HTMLDialogElement>('.puna-workspace dialog[open]').forEach(dialog => dialog.close());
    setSection(next.section);
    setTabs(previous => ({...previous, [next.section]: next.tab}));
    setVisited(previous => [...new Set([...previous, next.section, next.section + ':' + next.tab])]);
    setMobileOpen(false);
  }

  useEffect(() => {
    const restore = () => {remember(fromLocation()); setReady(true)};
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  function navigate(nextSection: Section, nextTab = tabs[nextSection]) {
    const next = {section: nextSection, tab: nextTab};
    remember(next);
    const query = new URLSearchParams();
    if (nextSection !== 'today' || nextTab !== 'overview') query.set('view', nextSection);
    if (nextTab && nextTab !== initialTabs[nextSection]) query.set('tab', nextTab);
    const nextUrl = '/workspace' + (query.size ? '?' + query.toString() : '');
    if (window.location.pathname + window.location.search !== nextUrl) window.history.pushState(null, '', nextUrl);
    requestAnimationFrame(() => {content.current?.focus({preventScroll: true}); window.scrollTo({top: 0, behavior: 'auto'})});
  }

  async function logout() {
    setSigningOut(true); setError('');
    try {
      const response = await fetch('/api/auth', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'logout'})});
      if (!response.ok) throw Error('Sign out failed. Please try again.');
      window.location.assign('/sign-in');
    } catch (cause) {setError((cause as Error).message); setSigningOut(false)}
  }

  const seen = (id: Section, tab = '') => visited.includes(tab ? id + ':' + tab : id);
  function tabKeys(event: KeyboardEvent<HTMLButtonElement>, id: Section, index: number) {
    const list = groups[id]!;
    const target = event.key === 'ArrowRight' ? (index + 1) % list.length : event.key === 'ArrowLeft' ? (index - 1 + list.length) % list.length : event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : -1;
    if (target < 0) return;
    event.preventDefault();
    navigate(id, list[target].id);
    requestAnimationFrame(() => document.getElementById('pw-tab-' + id + '-' + list[target].id)?.focus());
  }
  function groupTabs(id: Section) {
    return <div className="pw-tabs" role="tablist" aria-label={id === 'today' ? 'Today views' : id === 'kitchen' ? 'Kitchen views' : 'Team and settings views'}>
      {groups[id]!.map((tab, index) => <button type="button" role="tab" key={tab.id} id={'pw-tab-' + id + '-' + tab.id} aria-controls={'pw-panel-' + id + '-' + tab.id} aria-selected={tabs[id] === tab.id} tabIndex={tabs[id] === tab.id ? 0 : -1} onClick={() => navigate(id, tab.id)} onKeyDown={event => tabKeys(event, id, index)}>{tab.label}</button>)}
    </div>;
  }
  function tabPanel(id: Section, tab: string, children: ReactNode) {
    return seen(id, tab) ? <div id={'pw-panel-' + id + '-' + tab} role="tabpanel" aria-labelledby={'pw-tab-' + id + '-' + tab} hidden={tabs[id] !== tab}>{children}</div> : null;
  }

  return <div className="workspace-theme puna-workspace">
    <a className="pw-skip" href="#pw-main">Skip to workspace</a>
    <div className="pw-layout">
      <aside className={'pw-rail ' + (mobileOpen ? 'pw-rail-open' : '')} aria-label="Workspace sidebar">
        <a className="pw-brand" href="/" aria-label="Puna website"><img src="/puna-official-logo.svg" width="42" height="42" alt=""/><span><strong>PUNA</strong><small>THE WORKSPACE</small></span></a>
        <button type="button" ref={menuButton} className="pw-mobile-toggle" aria-label={mobileOpen ? 'Close workspace menu' : 'Open workspace menu'} aria-expanded={mobileOpen} aria-controls="pw-navigation" onClick={() => setMobileOpen(open => !open)}><span>{active.label}</span>{mobileOpen ? <X size={19}/> : <MenuIcon size={19}/>}</button>
        <nav className="pw-navigation" id="pw-navigation" aria-label="Puna workspace" onKeyDown={event => {if (event.key === 'Escape' && mobileOpen) {setMobileOpen(false); menuButton.current?.focus()}}}>
          <p className="pw-nav-caption">YOUR DAY, ORGANISED</p>
          {sections.filter(s => s.id !== 'settings').map(item => {const Icon = item.icon; return <button key={item.id} type="button" className="pw-nav-item" aria-current={section === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><Icon size={19} aria-hidden="true"/><span>{item.label}</span></button>})}
          <div className="pw-rail-bottom">
            <button type="button" className="pw-nav-item" aria-current={section === 'settings' ? 'page' : undefined} onClick={() => navigate('settings')}><Settings2 size={19} aria-hidden="true"/><span>Team & settings</span></button>
            <a href="/" className="pw-nav-item pw-site-link"><ArrowUpRight size={18} aria-hidden="true"/><span>View Puna website</span></a>
            <div className="pw-owner"><span className="pw-avatar" aria-hidden="true">{initials}</span><span><strong>{displayName}</strong><small>Owner workspace</small></span><button type="button" className="pw-icon-button" aria-label="Sign out" disabled={signingOut} onClick={logout}><LogOut size={18} aria-hidden="true"/></button></div>
          </div>
        </nav>
      </aside>
      <main id="pw-main" className="pw-main" tabIndex={-1} ref={content}>
        <header className="pw-topbar"><div className="pw-breadcrumb"><span>Workspace</span><ChevronRight size={14} aria-hidden="true"/><strong>{active.label}</strong></div><span className="pw-environment">Staging workspace</span></header>
        <div className="pw-content">
          <div className="pw-page-heading"><div><p className="pw-kicker">PUNA / {section === 'today' ? 'THE DAY AHEAD' : 'BUSINESS OPERATIONS'}</p><h1>{active.label}</h1><p className="pw-muted">{active.subtitle}</p></div></div>
          {error && <p className="pw-alert" role="alert">{error}</p>}
          {!ready && <p className="pw-empty" role="status">Opening your workspace…</p>}
          {ready && <>
            <section hidden={section !== 'today'} aria-label="Today workspace">{seen('today') && <>{groupTabs('today')}{tabPanel('today', 'overview', <WorkspaceDesk section="today" onKitchen={() => navigate('kitchen', 'pickup')} onOrders={() => navigate('orders')}/>)}{tabPanel('today', 'sales', <Records section="Sales"/>)}{tabPanel('today', 'costs', <Records section="Financials"/>)}</>}</section>
            <section hidden={section !== 'orders'} aria-label="Orders workspace">{seen('orders') && <WorkspaceDesk section="orders" onKitchen={() => navigate('kitchen', 'pickup')}/>}</section>
            <section hidden={section !== 'customers'} aria-label="Customers workspace">{seen('customers') && <Customers/>}</section>
            <section hidden={section !== 'menu'} aria-label="Menu workspace">{seen('menu') && <ProductWorkspace/>}</section>
            <section hidden={section !== 'kitchen'} aria-label="Kitchen workspace">{seen('kitchen') && <>{groupTabs('kitchen')}{tabPanel('kitchen', 'pickup', liveKitchen?<><LiveKitchen/><details><summary>Detailed tools & legacy pickups</summary><Operations section="Food Truck"/></details></>:<Operations section="Food Truck"/>)}{tabPanel('kitchen', 'inventory', <Operations section="Inventory"/>)}{tabPanel('kitchen', 'recipes', <Records section="Production"/>)}</>}</section>
            <section hidden={section !== 'website'} aria-label="Website workspace">{seen('website') && <WebsiteEditor/>}</section>
            <section hidden={section !== 'settings'} aria-label="Team and settings workspace">{seen('settings') && <>{groupTabs('settings')}{tabPanel('settings', 'team', <><Accounts/><GoogleLink/></>)}{tabPanel('settings', 'schedule', <Operations section="Settings"/>)}{tabPanel('settings', 'feedback', <Operations section="Feedback"/>)}{tabPanel('settings', 'audit', <Operations section="Audit"/>)}</>}</section>
          </>}
        </div>
      </main>
    </div>
  </div>;
}
