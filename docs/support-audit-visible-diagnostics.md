# Support audit visible diagnostics

This PR surfaces the support completeness audit in the normal conversion status/log so support issues can be seen without opening raw audit JSON.

It reports:

- support completeness pass/fail
- rendered support rows vs source rows
- missing support rows
- node 205 rendered/source count
- node 205 Y support rendered flag
- node 205 spring rendered flag
- unknown support count
- X fallback support count

Scope is UI diagnostics/logging only. It does not change support geometry, mapper rules, RVM writer layouts, XML enrichment, or parser behavior.
