const DEFAULT_PAGE_SIZE = 1000;

/**
 * Fetch all rows from a Supabase query by paginating in 1000-row chunks
 * to avoid PostgREST's default 1000-row cap.
 */
export async function fetchAllSupabaseRows(makeQuery, pageSize = DEFAULT_PAGE_SIZE) {
  const allRows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await makeQuery(offset, offset + pageSize - 1);
    if (error) throw error;
    const batch = Array.isArray(data) ? data : [];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return allRows;
}
