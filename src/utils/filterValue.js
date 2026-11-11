// A typed value inside a Supabase .or() filter, in double quotes. Without them a
// comma, dot or bracket in the text ("Patel, R") breaks the filter and the
// search finds nothing.
export const filterValue = value => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
