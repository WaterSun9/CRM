// Parts that are built but switched off on the live site (2026-11-20, Mahvish).
// OEM past data: to be moved into the warranty page history (who added it) instead of a page of
// its own; its SQL (20261116130000_oem_past_data.sql) is not run. OEM claims and the Tata form:
// switched on 2026-11-20 (Mahvish) together with 20261116140000_oem_claims.sql, which must be
// run on live BEFORE this is deployed.
export const OEM_PAST_DATA = false;
export const OEM_CLAIMS = true;
