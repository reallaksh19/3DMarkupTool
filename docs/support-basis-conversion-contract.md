# Support basis conversion contract

This change makes the support basis selection operational in conversion.

## Contract

Only one support basis is active per managed-stage conversion:

- `stagedJson`: use support rows from the uploaded InputXML/stagedJson profile.
- `isonote`: use support rows parsed from uploaded/sideloaded ISONOTE text.
- `off`: emit no support markers.

Both stagedJson and ISONOTE rows are normalized through the same support mapper and support marker contract path.

## Audit

The converter/source contract stamps the active support basis and source counts so mixed source usage can be diagnosed from the downloaded audit JSON.

## Scope

No pipe geometry, bend/code4 planning, XML enrichment, RVM primitive payload layout, or ATT schema changes.
