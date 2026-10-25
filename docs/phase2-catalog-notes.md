# Phase 2 catalog draft

`data/catalog-phase2-products.json` contains 150 additional draft records. The
250 figure is the total of the 100 definitions in `scripts/seed-data.mjs` and
these 150 drafts. It is not a live database count; no database was queried.

The artifact refers to existing categories by their source slugs because live
MongoDB ObjectIds are not available from the checked-in source. An operator
must resolve each slug to the existing category record before creating a
product. The artifact does not create or change category records.

All draft products are inactive with zero stock. Prices and descriptions are
proposals, not supplier-verified commercial facts. The local SVGs in
`public/products/phase2/` are generated catalog illustrations, not product
photographs. Replace or approve them only after sourcing appropriate product
images and confirming the product facts.

## Validation

Run these source-only commands from the repository root:

```powershell
node scripts/prepare-phase2-catalog.mjs
node scripts/validate-phase2-catalog.mjs
```

The validator reads the checked-in sample catalog and local artwork only. It
does not load environment files or connect to MongoDB.

## Import procedure

There is intentionally no direct database importer. The repository has no bulk
catalog import API, and direct collection inserts would bypass the existing
product validation and inventory audit path. Do not import this draft into a
live database as-is. First inspect the live catalog through an approved
read-only export, reconcile duplicate SKUs/slugs and target counts, confirm
supplier facts/prices and image rights, and resolve category slugs to existing
category IDs. Then use the protected admin product workflow so normal server
validation and inventory handling remain in force. Keep products inactive and
at zero stock until commercial details and fulfillment are confirmed.

No database writes, index creation, migration, or production import were run
while preparing this artifact.
