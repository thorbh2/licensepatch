# Security policy

## Scope

The public frontend contains no deployer private key, vault password, faucet credential, or server-side signing endpoint. User transactions are requested through RainbowKit and the connected browser wallet.

## Contract controls

- Owner-only protocol configuration.
- Operator-only evidence and domain-record mutation.
- HTTP(S) source validation and bounded rendered content.
- Explicit prompt-injection isolation.
- Comparative validator consensus with a neutral fallback.
- Replay and case-ID checks for challenges and appeals.
- Finalization blocked while a filing is pending.

Report a suspected issue privately before publishing transaction details that could affect users.
