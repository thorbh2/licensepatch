import Head from 'next/head';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { openOnchainAction, useOnchain } from '../lib/onchain';
import { contractState, project } from '../lib/project-data';
import { ProductVisual } from './ProductVisual';

const human = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const short = (value: string) => value ? value.slice(0, 7) + '...' + value.slice(-5) : 'not available';
const routeHref = (route: string) => route === project.routes[0] ? '/' : '/' + route;
const icons = ["fa-code-branch","fa-cubes","fa-scale-balanced","fa-triangle-exclamation","fa-certificate"];

export function AppFrame({ view = "releases" }: { view?: string }) {
  const { snapshot, refreshing, refresh } = useOnchain();
  const active = snapshot.cases[0];
  const details = active ? snapshot.details[active.id] : undefined;
  const evidence = details?.evidence.length || 0;
  const reviews = details?.reviews.length || 0;
  const challenges = details?.challenges.length || 0;
  const appeals = details?.appeals.length || 0;
  const disputes = challenges + appeals;
  const confidence = Math.round((active?.confidenceBps || 0) / 100);
  const pending = (details?.challenges.filter(item => item.ruling === 'pending').length || 0)
    + (details?.appeals.filter(item => item.ruling === 'pending').length || 0);
  const records = snapshot.cases;
  const viewLabel = human(view);
  
  return <div className="license-app">
    <Head><title>{project.name} | Release compliance IDE</title><meta name="description" content={project.intro} /><link rel="icon" href="data:," /></Head>
    <header className="repo-bar">
      <Link href="/" className="repo-brand"><i className="fa-solid fa-code-branch" />{project.name}</Link>
      <div className="repo-path"><span>workspace</span><i className="fa-solid fa-chevron-right" /><b>{active?.title || 'new-release'}</b><i className="fa-solid fa-chevron-right" /><em>{viewLabel}</em></div>
      <nav>{project.routes.map((route, index) => <Link className={route === view ? 'active' : ''} href={routeHref(route)} key={route}><i className={'fa-solid ' + icons[index]} />{human(route)}</Link>)}</nav>
      <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />
    </header>
    <main className="license-workbench">
      <aside className="package-tree">
        <header><b>PACKAGE EXPLORER</b><button title="Scan manifest" onClick={() => void refresh()}><i className={'fa-solid fa-arrows-rotate' + (refreshing ? ' fa-spin' : '')} /></button></header>
        <div className="tree-root"><i className="fa-solid fa-folder-open" /><b>{active?.title || 'release'}</b></div>
        <ul><li><i className="fa-solid fa-file-code" /> package.json <span>tracked</span></li><li><i className="fa-solid fa-boxes-stacked" /> dependencies <span>{evidence}</span></li><li><i className="fa-solid fa-scale-balanced" /> obligations <span>{reviews}</span></li><li className={pending ? 'warn' : 'pass'}><i className="fa-solid fa-triangle-exclamation" /> exceptions <span>{pending}</span></li></ul>
        <button className="new-release" onClick={() => openOnchainAction('create')}><i className="fa-solid fa-plus" /> Open release</button>
      </aside>
      <section className="license-editor">
        <header><span>compliance.matrix</span><em>{human(active?.status || 'scanning')}</em></header>
        <div className="release-banner"><div><small>Release candidate</small><h1>{active?.title || project.headline}</h1><p>{active?.summary || active?.claim || project.intro}</p></div><div className="clearance"><strong>{confidence}%</strong><span>manifest clearance</span></div></div>
        <ProductVisual evidence={evidence} reviews={reviews} disputes={disputes} confidence={confidence} />
        <section className="dependency-register"><header><span>Component</span><span>Evidence</span><span>Risk</span><span>Disposition</span><span /></header>{records.map(record => <article key={record.id}><b><i className="fa-solid fa-cube" /> {record.title}</b><span>{record.evidenceCount} sources</span><span>{record.challengeCount + record.appealCount}</span><em>{human(record.outcome)}</em><button title="Inspect release" onClick={() => openOnchainAction('lifecycle', record.id)}><i className="fa-solid fa-chevron-right" /></button></article>)}</section>
      </section>
      <aside className="obligation-inspector">
        <header><small>Certificate candidate</small><b>{human(active?.outcome || 'pending')}</b></header>
        <dl><div><dt>Contract</dt><dd>{short(contractState.address)}</dd></div><div><dt>Evidence</dt><dd>{evidence}</dd></div><div><dt>Reviews</dt><dd>{reviews}</dd></div><div><dt>Open filings</dt><dd>{pending}</dd></div></dl>
        <div className="source-list">{details?.evidence.slice(0, 4).map(item => <a href={item.url} target="_blank" rel="noreferrer" key={item.id}><i className="fa-solid fa-link" />{item.title}</a>)}</div>
        <button onClick={() => openOnchainAction('lifecycle', active?.id)}>Resolve obligations</button>
        <a className="contract-link" href={contractState.explorerUrl} target="_blank" rel="noreferrer">Open deployed contract <i className="fa-solid fa-arrow-up-right-from-square" /></a>
      </aside>
    </main>
  </div>;
  
}
