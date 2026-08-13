# LicensePatch contract specification

Contract: [0x570f56a6666f5743Fd612e59787dDFceCF82E444](https://explorer-bradbury.genlayer.com/address/0x570f56a6666f5743Fd612e59787dDFceCF82E444)

## Domain records

- Primary record: `release`
- Child record A: `dependency` through `add_dependency`
- Child record B: `obligation` through `add_license_obligation`
- Review method: `review_release_with_genlayer`
- States: `SCANNING`, `REVIEWING`, `REVIEWED`, `EXCEPTION_WINDOW`, `APPEALED`, `CERTIFIED`, `ARCHIVED`
- Outcomes: `pending`, `compatible`, `blocked`, `needs_counsel`

Evidence and domain records require the primary record operator. Protocol changes require the contract owner. Validator review ignores instructions embedded in rendered source content. Pending challenges or appeals block finalization, and granted rulings can revise the stored outcome and confidence before settlement.
