export function ProductVisual({ evidence, reviews, disputes, confidence }: { evidence: number; reviews: number; disputes: number; confidence: number }) {
  const dependencies = [
    { name: '@core/runtime', license: 'MIT', state: 'clear' },
    { name: '@data/parser', license: 'Apache-2.0', state: evidence > 1 ? 'clear' : 'scan' },
    { name: '@media/codec', license: 'LGPL-2.1', state: disputes ? 'exception' : 'clear' },
    { name: '@client/sdk', license: 'BSD-3-Clause', state: reviews ? 'clear' : 'scan' },
  ];
  return <div className="license-matrix">
    <header><span>DEPENDENCY</span><span>SPDX</span><span>NOTICE</span><span>SOURCE</span><span>RELEASE</span></header>
    {dependencies.map((item, index) => <article key={item.name}><b><i className="fa-solid fa-cube" /> {item.name}</b><code>{item.license}</code><i className={evidence > index ? 'pass' : 'wait'}>{evidence > index ? 'YES' : 'WAIT'}</i><i className={reviews ? 'pass' : 'wait'}>{reviews ? 'BOUND' : 'SCAN'}</i><em className={item.state}>{item.state.toUpperCase()}</em></article>)}
    <footer><span>Manifest clearance</span><strong>{confidence}%</strong></footer>
  </div>;
}
