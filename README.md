# LicensePatch

Ship the release, not an unresolved license obligation.

LicensePatch is a GenLayer Bradbury application for software release license certification. It gives release engineers and open-source compliance teams a concrete workflow to prove that every shipped dependency has compatible license evidence and a resolved exception. The client reads its register from the deployed intelligent contract; it does not ship sample records or substitute static outcomes when a contract read fails.

## Live architecture

| Layer | Implementation |
| --- | --- |
| Live app | [licensepatch-review.vercel.app](https://licensepatch-review.vercel.app) |
| Network | GenLayer Bradbury, chain `4221` |
| Contract | [`0x570f56a6666f5743Fd612e59787dDFceCF82E444`](https://explorer-bradbury.genlayer.com/address/0x570f56a6666f5743Fd612e59787dDFceCF82E444) |
| Reasoning | validator-local `gl.nondet.web.get` with render fallback, `gl.nondet.exec_prompt`, custom consensus |
| Settlement | operator permissions, challenges, appeals, blocked finalization, audit log, reputation |
| Wallet UX | RainbowKit + wagmi on Bradbury |
| Interface | conveyor workflow, CSS dependency conveyor, Font Awesome prepared icon assets |

## Product workflow

1. Create a release with a public primary source.
2. Attach dependency and obligation records.
3. Lock the evidence set and invoke GenLayer web reasoning.
4. Open the review window, then resolve challenges and appeals.
5. Finalize only when no filing remains pending.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Connect an EVM browser wallet through RainbowKit and switch to GenLayer Bradbury when prompted.

## Verification

```bash
npm run typecheck
npm run build
npm test
npm run test:network
```

See [CONTRACT_SPEC.md](./CONTRACT_SPEC.md), [DESIGN.md](./DESIGN.md), [SECURITY.md](./SECURITY.md), and [public/assets/ASSET_SOURCES.md](./public/assets/ASSET_SOURCES.md).
