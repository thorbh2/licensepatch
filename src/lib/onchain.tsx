import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createAccount, createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { useAccount } from 'wagmi';
import { contractState } from './project-data';
import { ProjectChainState } from '../components/ProjectChainState';

const GENLAYER_READ_RPC = typeof window === 'undefined'
  ? 'https://rpc-bradbury.genlayer.com'
  : `${window.location.origin}/api/genlayer`;
const genLayerReadChain = {
  ...testnetBradbury,
  rpcUrls: {
    ...testnetBradbury.rpcUrls,
    default: { http: [GENLAYER_READ_RPC] },
  },
};

export type ChainCase = {
  id: string;
  kind: string;
  actor: string;
  title: string;
  claim: string;
  sourceUrl: string;
  fields: Record<string, unknown>;
  status: string;
  outcome: string;
  confidenceBps: number;
  supportBps: number;
  contradictionBps: number;
  summary: string;
  rationale: string;
  riskFlags: string[];
  evidenceCount: number;
  reviewCount: number;
  challengeCount: number;
  appealCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ChainEvidence = {
  id: string;
  caseId: string;
  actor: string;
  url: string;
  title: string;
  note: string;
  createdAt: string;
};

export type ChainReview = {
  id: string;
  caseId: string;
  actor: string;
  outcome: string;
  confidenceBps: number;
  supportBps: number;
  contradictionBps: number;
  summary: string;
  rationale: string;
  riskFlags: string[];
  createdAt: string;
};

export type ChainChallenge = {
  id: string;
  caseId: string;
  actor: string;
  claim: string;
  evidenceUrl: string;
  ruling: string;
  confidenceDeltaBps: number;
  reason: string;
  riskFlags: string[];
  createdAt: string;
};

export type ChainAppeal = {
  id: string;
  caseId: string;
  actor: string;
  reason: string;
  evidenceUrl: string;
  ruling: string;
  confidenceDeltaBps: number;
  decisionReason: string;
  riskFlags: string[];
  createdAt: string;
};

export type ChainAudit = {
  id: string;
  caseId: string;
  actor: string;
  action: string;
  note: string;
  fromStatus: string;
  toStatus: string;
  createdAt: string;
};

export type ChainCaseDetails = {
  evidence: ChainEvidence[];
  reviews: ChainReview[];
  challenges: ChainChallenge[];
  appeals: ChainAppeal[];
  audit: ChainAudit[];
};

export type ChainStats = {
  contract: string;
  cases: number;
  evidence: number;
  reviews: number;
  challenges: number;
  appeals: number;
  audits: number;
  profiles: number;
  byStatus: Record<string, number>;
  supported: number;
  contradicted: number;
  unclear: number;
};

export type OnchainSnapshot = {
  contract: string;
  owner: string;
  statuses: string[];
  outcomes: string[];
  cases: ChainCase[];
  details: Record<string, ChainCaseDetails>;
  stats: ChainStats;
  quality: { qualityBps: number; reason: string };
};

type ActionMode = 'create' | 'evidence' | 'review' | 'challenge' | 'appeal' | 'lifecycle';

const ACTION_LABELS: Record<ActionMode, string> = {
  create: 'Open release',
  evidence: 'Manifest',
  review: 'Review',
  challenge: 'Exception',
  appeal: 'Appeal',
  lifecycle: 'Certify',
};
type ActionPrefill = { title?: string; claim?: string; sourceUrl?: string; note?: string };

type OnchainContextValue = {
  snapshot: OnchainSnapshot;
  refreshing: boolean;
  lastTx: string;
  refresh: () => Promise<void>;
  openAction: (mode?: ActionMode, caseId?: string) => void;
};

type Eip1193Provider = {
  request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const BRADBURY_HEX = '0x107d';
const RPC = 'https://rpc-bradbury.genlayer.com';
const EXPLORER_TX = 'https://explorer-bradbury.genlayer.com/tx/';
const CACHE_KEY = `genlayer:snapshot:${contractState.address.toLowerCase()}`;
const CACHE_TTL_MS = 300_000;
let serverSnapshotCache: { savedAt: number; snapshot: OnchainSnapshot } | null = null;
const OnchainContext = createContext<OnchainContextValue | null>(null);

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseArray<T>(value: unknown): T[] {
  const parsed = parseJson<unknown>(value, []);
  return Array.isArray(parsed) ? parsed as T[] : [];
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'The onchain request failed.';
}

async function ensureBradbury(provider: Eip1193Provider) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BRADBURY_HEX }] });
  } catch (error) {
    const candidate = error as { code?: number; message?: string };
    if (candidate.code !== 4902 && !/unrecognized chain/i.test(candidate.message || '')) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: BRADBURY_HEX,
        chainName: 'GenLayer Bradbury',
        nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
        rpcUrls: [RPC],
        blockExplorers: [{ name: 'GenLayer Explorer', url: 'https://explorer-bradbury.genlayer.com' }],
      }],
    });
  }
}

function browserWalletProvider(provider: Eip1193Provider): Eip1193Provider {
  return {
    request: async request => {
      if (request.method !== 'eth_sendTransaction' || !Array.isArray(request.params) || !request.params[0]) {
        return provider.request(request);
      }
      const transaction = { ...(request.params[0] as Record<string, unknown>) };
      if (!transaction.gas) transaction.gas = '0x200000';
      return provider.request({ ...request, params: [transaction] });
    },
  };
}

export async function loadOnchainSnapshot(force = false): Promise<OnchainSnapshot> {
  if (!force && typeof window === 'undefined' && serverSnapshotCache && Date.now() - serverSnapshotCache.savedAt < CACHE_TTL_MS) return serverSnapshotCache.snapshot;
  if (!force && typeof window !== 'undefined') {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const entry = parseJson<{ savedAt: number; snapshot: OnchainSnapshot } | null>(cached, null);
      if (entry && Date.now() - entry.savedAt < CACHE_TTL_MS) return entry.snapshot;
    }
  }
  const client = createClient({ chain: genLayerReadChain, account: createAccount() });
  const address = contractState.address as `0x${string}`;
  const read = async (functionName: string, args: unknown[] = []) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await client.readContract({ address, functionName, args: args as never[] });
      } catch (error) {
        lastError = error;
        if (!/server busy|node is at capacity/i.test(errorText(error)) || attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 650 * (attempt + 1)));
      }
    }
    throw lastError;
  };

  const [bootstrapRaw, ownerRaw] = await Promise.all([
    read('get_frontend_bootstrap'),
    read('get_owner'),
  ]);
  const bootstrap = parseJson<{
    contract?: string;
    statuses?: string[];
    outcomes?: string[];
    recentCases?: ChainCase[];
    stats?: ChainStats;
    quality?: { qualityBps: number; reason: string };
  }>(bootstrapRaw, {});
  const cases = Array.isArray(bootstrap.recentCases) ? bootstrap.recentCases : [];
  const detailEntries: Array<readonly [string, ChainCaseDetails]> = await Promise.all(
    cases.map(async (item) => {
      const [evidence, reviews, challenges, appeals, audit] = await Promise.all([
        read('get_evidence', [item.id]),
        read('get_reviews', [item.id]),
        read('get_challenges', [item.id]),
        read('get_appeals', [item.id]),
        read('get_audit_log', [item.id]),
      ]);
      return [item.id, {
        evidence: parseArray<ChainEvidence>(evidence),
        reviews: parseArray<ChainReview>(reviews),
        challenges: parseArray<ChainChallenge>(challenges),
        appeals: parseArray<ChainAppeal>(appeals),
        audit: parseArray<ChainAudit>(audit),
      }] as const;
    })
  );

  const snapshot: OnchainSnapshot = {
    contract: bootstrap.contract || 'GenLayer contract',
    owner: String(ownerRaw || ''),
    statuses: bootstrap.statuses || [],
    outcomes: bootstrap.outcomes || [],
    cases,
    details: Object.fromEntries(detailEntries),
    stats: bootstrap.stats || {
      contract: bootstrap.contract || '',
      cases: cases.length,
      evidence: 0,
      reviews: 0,
      challenges: 0,
      appeals: 0,
      audits: 0,
      profiles: 0,
      byStatus: {},
      supported: 0,
      contradicted: 0,
      unclear: 0,
    },
    quality: bootstrap.quality || { qualityBps: 0, reason: '' },
  };
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), snapshot }));
  } else {
    serverSnapshotCache = { savedAt: Date.now(), snapshot };
  }
  return snapshot;
}

export function openOnchainAction(mode: ActionMode = 'lifecycle', caseId = '', prefill: ActionPrefill = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('genlayer:action', { detail: { mode, caseId, prefill } }));
}

export function useOnchain() {
  const value = useContext(OnchainContext);
  if (!value) throw new Error('useOnchain must be used inside OnchainProvider.');
  return value;
}

export function OnchainProvider({ children, initialSnapshot = null }: { children: ReactNode; initialSnapshot?: OnchainSnapshot | null }) {
  const { address } = useAccount();
  const [snapshot, setSnapshot] = useState<OnchainSnapshot | null>(() => {
    return initialSnapshot ?? null;
  });
  const [loading, setLoading] = useState(!initialSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [dockOpen, setDockOpen] = useState(false);
  const [mode, setMode] = useState<ActionMode>('lifecycle');
  const [caseId, setCaseId] = useState('');
  const [title, setTitle] = useState('');
  const [claim, setClaim] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const [lastTx, setLastTx] = useState('');

  const refresh = useCallback(async (force = true) => {
    setRefreshing(true);
    try {
      const next = await loadOnchainSnapshot(force);
      setSnapshot(next);
      setCaseId(current => next.cases.some(item => item.id === current) ? current : next.cases[0]?.id || '');
      setLoadError('');
      setRevision(value => value + 1);
    } catch (error) {
      setLoadError(errorText(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (initialSnapshot) {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), snapshot: initialSnapshot }));
      return;
    }
    void refresh(false);
  }, [refresh, initialSnapshot]);

  const openAction = useCallback((nextMode: ActionMode = 'lifecycle', nextCaseId = '') => {
    setMode(nextMode);
    if (nextCaseId) setCaseId(nextCaseId.replace(/^[A-Z]+-0*/, ''));
    setActionError('');
    setDockOpen(true);
  }, []);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: ActionMode; caseId?: string; prefill?: ActionPrefill }>).detail || {};
      if (detail.prefill?.title !== undefined) setTitle(detail.prefill.title);
      if (detail.prefill?.claim !== undefined) setClaim(detail.prefill.claim);
      if (detail.prefill?.sourceUrl !== undefined) setSourceUrl(detail.prefill.sourceUrl);
      if (detail.prefill?.note !== undefined) setNote(detail.prefill.note);
      openAction(detail.mode, detail.caseId);
    };
    window.addEventListener('genlayer:action', listener);
    return () => window.removeEventListener('genlayer:action', listener);
  }, [openAction]);

  const selected = useMemo(
    () => snapshot?.cases.find(item => item.id === caseId) || snapshot?.cases[0],
    [caseId, snapshot],
  );
  const selectedDetails = selected && snapshot ? snapshot.details[selected.id] : undefined;
  const operator = Boolean(
    address && selected && (
      address.toLowerCase() === selected.actor.toLowerCase() ||
      address.toLowerCase() === snapshot?.owner.toLowerCase()
    ),
  );

  const execute = useCallback(async (functionName: string, args: unknown[]) => {
    const provider = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
    if (!provider) throw new Error('Install an EVM browser wallet before sending a transaction.');
    await ensureBradbury(provider);
    const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
    const signer = accounts[0];
    if (!signer) throw new Error('No wallet account is connected.');
    const client = createClient({
      chain: testnetBradbury,
      account: signer as never,
      provider: browserWalletProvider(provider) as never,
    });
    const hash = await client.writeContract({
      address: contractState.address as `0x${string}`,
      functionName,
      args: args as never[],
      value: BigInt(0),
    });
    setLastTx(hash);
    await client.waitForTransactionReceipt({ hash, status: 'ACCEPTED' as never, retries: 200 });
    sessionStorage.removeItem(CACHE_KEY);
    await refresh(true);
    return hash;
  }, [refresh]);

  const run = async (functionName: string, args: unknown[]) => {
    setBusy(functionName);
    setActionError('');
    try {
      await execute(functionName, args);
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return <ProjectChainState mode="loading" explorerUrl={contractState.explorerUrl} />;
  }

  if (!snapshot || loadError) {
    return <ProjectChainState
      mode="error"
      message={loadError || 'The deployed contract did not return a valid state.'}
      onRetry={() => void refresh()}
      explorerUrl={contractState.explorerUrl}
    />;
  }

  const child = Children.only(children);
  const renderedChild = isValidElement(child)
    ? cloneElement(child as ReactElement, { key: revision })
    : child;

  const contextValue: OnchainContextValue = {
    snapshot,
    refreshing,
    lastTx,
    refresh,
    openAction,
  };

  return (
    <OnchainContext.Provider value={contextValue}>
      {snapshot.cases.length ? renderedChild : (
        <ProjectChainState
          mode="empty"
          onCreate={() => openAction('create')}
          explorerUrl={contractState.explorerUrl}
        />
      )}

      {dockOpen && (
        <div className="chain-dock-scrim chain-dock-scrim--license-patch" role="presentation" onMouseDown={event => {
          if (event.currentTarget === event.target) setDockOpen(false);
        }}>
          <section className="chain-dock chain-dock--license-patch" data-panel="license-patch" role="dialog" aria-modal="true" aria-label="Onchain contract controls">
            <header>
              <div><span>RELEASE COMPLIANCE</span><b>{snapshot.contract}</b></div>
              <button type="button" onClick={() => setDockOpen(false)} aria-label="Close onchain controls"><i className="fa-solid fa-xmark" /></button>
            </header>

            <div className="chain-dock-status">
              <span><i />Live contract</span>
              <a href={contractState.explorerUrl} target="_blank" rel="noreferrer">{contractState.address.slice(0, 8)}...{contractState.address.slice(-6)}</a>
              <button type="button" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? 'Refreshing' : 'Refresh'}</button>
            </div>

            <nav aria-label="Onchain action type">
              {(['create', 'evidence', 'review', 'challenge', 'appeal', 'lifecycle'] as ActionMode[]).map(item => (
                <button key={item} type="button" data-mode={item} className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>{ACTION_LABELS[item]}</button>
              ))}
            </nav>

            <div className="chain-dock-body">
            {mode !== 'create' && (
              <label>Record
                <select value={selected?.id || ''} onChange={event => setCaseId(event.target.value)}>
                  {snapshot.cases.map(item => <option key={item.id} value={item.id}>#{item.id} / {item.status} / {item.title}</option>)}
                </select>
              </label>
            )}

            {selected && mode !== 'create' && (
              <div className="chain-record-summary">
                <span>{selected.status}</span><b>{selected.title}</b>
                <p>{selected.summary || selected.claim}</p>
                <small>{selected.evidenceCount} evidence / {selected.challengeCount} challenges / {selected.appealCount} appeals</small>
              </div>
            )}

            {mode === 'create' && (
              <div className="chain-fields">
                <label>Title<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Release name" /></label>
                <label>Claim<textarea value={claim} onChange={event => setClaim(event.target.value)} placeholder="SPDX publishes standardized license identifiers that can ground dependency license review before software release certification." /></label>
                <label>Public source URL<input value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://..." /></label>
                <button type="button" disabled={Boolean(busy) || !title.trim() || !claim.trim() || !/^https?:\/\//i.test(sourceUrl)} onClick={() => void run('open_release', [title.trim(), "Repository", claim.trim(), sourceUrl.trim()])}>
                  {busy === 'open_release' ? 'Waiting for finality' : 'Open release onchain'}
                </button>
              </div>
            )}

            {mode === 'evidence' && selected && (
              <div className="chain-fields">
                <label>Evidence title<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Source label" /></label>
                <label>Public source URL<input value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://..." /></label>
                <label>Evidence note<textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Explain what this source proves or contradicts" /></label>
                <button type="button" disabled={Boolean(busy) || !operator || !title.trim() || !/^https?:\/\//i.test(sourceUrl)} onClick={() => void run('add_evidence', [selected.id, sourceUrl.trim(), title.trim(), note.trim()])}>
                  {busy === 'add_evidence' ? 'Waiting for finality' : operator ? 'Add evidence onchain' : 'Release operator required'}
                </button>
              </div>
            )}

            {mode === 'review' && selected && (
              <div className="chain-fields">
                <p>This invokes GenLayer web reasoning over every source currently attached to record #{selected.id}.</p>
                <button type="button" disabled={Boolean(busy) || !operator || selected.status !== 'SCANNING' || selected.evidenceCount === 0} onClick={() => void run('review_with_genlayer', [selected.id])}>
                  {busy === 'review_with_genlayer' ? 'Validators are reviewing' : !operator ? 'Release operator required' : selected.status !== 'SCANNING' ? `Record is ${selected.status}` : 'Run validator review'}
                </button>
              </div>
            )}

            {mode === 'challenge' && selected && (
              <div className="chain-fields">
                <label>Contradictory claim<textarea value={claim} onChange={event => setClaim(event.target.value)} placeholder="Explain what should change in the current outcome" /></label>
                <label>Public evidence URL<input value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://..." /></label>
                <button type="button" disabled={Boolean(busy) || selected.status !== 'EXCEPTION_WINDOW' || !claim.trim() || !/^https?:\/\//i.test(sourceUrl)} onClick={() => void run('submit_challenge', [selected.id, claim.trim(), sourceUrl.trim()])}>
                  {busy === 'submit_challenge' ? 'Waiting for finality' : selected.status !== 'EXCEPTION_WINDOW' ? `Record is ${selected.status}` : 'Submit challenge onchain'}
                </button>
                {selectedDetails?.challenges.filter(item => item.ruling === 'pending').map(item => (
                  <div key={item.id} className="chain-filing-actions">
                    {operator && <button type="button" disabled={Boolean(busy)} onClick={() => void run('resolve_challenge_with_genlayer', [selected.id, item.id])}>Resolve challenge #{item.id} with validators</button>}
                    <button type="button" disabled={Boolean(busy)} onClick={() => void run('expire_challenge', [selected.id, item.id])}>Expire challenge #{item.id} after deadline</button>
                  </div>
                ))}
              </div>
            )}

            {mode === 'appeal' && selected && (
              <div className="chain-fields">
                <label>Appeal reason<textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Explain why the reviewed outcome should be reconsidered" /></label>
                <label>Public evidence URL<input value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://..." /></label>
                <button type="button" disabled={Boolean(busy) || !['REVIEWED', 'EXCEPTION_WINDOW'].includes(selected.status) || !note.trim() || !/^https?:\/\//i.test(sourceUrl)} onClick={() => void run('submit_appeal', [selected.id, note.trim(), sourceUrl.trim()])}>
                  {busy === 'submit_appeal' ? 'Waiting for finality' : !['REVIEWED', 'EXCEPTION_WINDOW'].includes(selected.status) ? `Record is ${selected.status}` : 'Submit appeal onchain'}
                </button>
                {selectedDetails?.appeals.filter(item => item.ruling === 'pending').map(item => (
                  <div key={item.id} className="chain-filing-actions">
                    {operator && <button type="button" disabled={Boolean(busy)} onClick={() => void run('resolve_appeal_with_genlayer', [selected.id, item.id])}>Resolve appeal #{item.id} with validators</button>}
                    <button type="button" disabled={Boolean(busy)} onClick={() => void run('expire_appeal', [selected.id, item.id])}>Expire appeal #{item.id} after deadline</button>
                  </div>
                ))}
              </div>
            )}

            {mode === 'lifecycle' && selected && (
              <div className="chain-fields chain-lifecycle">
                <button type="button" disabled={Boolean(busy) || !operator || selected.status !== 'REVIEWED'} onClick={() => void run('open_challenge_window', [selected.id])}>Open challenge window</button>
                <button type="button" disabled={Boolean(busy) || !operator || !['REVIEWED', 'EXCEPTION_WINDOW'].includes(selected.status)} onClick={() => void run('finalize_case', [selected.id])}>Finalize eligible record</button>
                <button type="button" disabled={Boolean(busy) || !operator || selected.status !== 'CERTIFIED'} onClick={() => void run('archive_case', [selected.id])}>Archive finalized record</button>
                {!operator && <p>Lifecycle transitions are restricted to the record operator or contract owner.</p>}
              </div>
            )}

            {actionError && <div className="chain-action-error">{actionError}</div>}
            {lastTx && <a className="chain-last-tx" href={`${EXPLORER_TX}${lastTx}`} target="_blank" rel="noreferrer">Open finalized transaction <i className="fa-solid fa-arrow-up-right-from-square" /></a>}
            </div>
          </section>
        </div>
      )}
    </OnchainContext.Provider>
  );
}
