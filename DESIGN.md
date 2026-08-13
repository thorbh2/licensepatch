# LicensePatch interface system

## Product surface

LicensePatch uses an independent release compliance IDE with package tree, license matrix, obligation inspector, and certificate state. Its primary interaction is to move a release from manifest scan to certification.

## Design DNA

- Product: Software release license certification
- Navigation: releases, dependencies, obligations, exceptions, certificate
- Visual engine: CSS dependency conveyor
- Asset system: prepared package, code and license icons, using prepared Font Awesome assets
- Typography: technical humanist sans plus monospace labels
- Palette: #eef1ee, #202923, #35a37a, #d64a66

## Differentiation rule

This interface does not reuse the shared headline, side visual, three metrics, record cards, and four-detail-panel skeleton from the first pass. Layout, navigation placement, information density, responsive behavior, and interaction hierarchy are specific to this product.

The client reads real deployed state from GenLayer Studionet. Loading and error states do not replace unavailable contract data with sample records.
