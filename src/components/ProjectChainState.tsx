import { contractState, project } from '../lib/project-data';

type Props = {
  mode: 'loading' | 'error' | 'empty';
  message?: string;
  explorerUrl: string;
  onRetry?: () => void;
  onCreate?: () => void;
};

export function ProjectChainState({ mode, message, explorerUrl, onRetry, onCreate }: Props) {
  const title = mode === 'loading'
    ? 'Reading the live Bradbury record'
    : mode === 'empty'
      ? "No release is registered yet"
      : 'The contract read did not complete';
  const detail = mode === 'loading'
    ? 'Fetching the deployed register and its public evidence.'
    : mode === 'empty'
      ? "Create the first release through the connected wallet."
      : message || 'Retry the live contract read.';
  return <main className="chain-state">
    <section>
      <header><i className={`fa-solid ${project.icon}`} /><b>{project.name}</b><span>BRADBURY / 4221</span></header>
      <h1>{title}</h1><p>{detail}</p>
      {mode === 'loading' ? <div className="state-progress"><i /></div> : <div className="state-actions">
        {mode === 'empty' && <button onClick={onCreate}>{project.action}</button>}
        {mode === 'error' && <button onClick={onRetry}>Retry</button>}
        <a href={explorerUrl || contractState.explorerUrl} target="_blank" rel="noreferrer">Open contract</a>
      </div>}
    </section>
  </main>;
}
