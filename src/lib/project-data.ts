import deployment from '../../deployment.json';

export const project = {
  id: "56-licensepatch",
  name: "LicensePatch",
  product: "Software release license certification",
  audience: "release engineers and open-source compliance teams",
  pain: "prove that every shipped dependency has compatible license evidence and a resolved exception",
  kicker: "Release compliance",
  headline: "Ship the release, not an unresolved license obligation.",
  intro: "Move a dependency manifest through license evidence, exception review, validator analysis, and a durable release certificate.",
  metric: "manifest clearance",
  action: "Open release",
  icon: "fa-code-branch",
  primaryKind: "release",
  primaryTitle: "Release name",
  extraLabel: "Repository",
  createMethod: "open_release",
  childA: "dependency",
  childB: "obligation",
  routes: ["releases","dependencies","obligations","exceptions","certificate"],
  statuses: ["SCANNING","REVIEWING","REVIEWED","EXCEPTION_WINDOW","APPEALED","CERTIFIED","ARCHIVED"],
  outcomes: ["pending","compatible","blocked","needs_counsel"],
  sourceUrl: "https://spdx.org/licenses/",
  sourceLabel: "SPDX license list",
  layout: "conveyor-workflow",
  palette: ["#eef1ee","#202923","#35a37a","#d64a66"],
} as const;

export const contractState = {
  network: 'GenLayer Bradbury',
  chainId: deployment.chainId,
  status: 'deployed',
  address: deployment.contractAddress,
  deployTxHash: deployment.deployTxHash,
  explorerUrl: deployment.contractExplorer,
};
