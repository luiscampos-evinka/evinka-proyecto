export class SupabaseRest {
  constructor({ url, key }) {
    this.baseUrl = `${url.replace(/\/$/, '')}/rest/v1`;
    this.key = key;
  }

  async request(pathname, { method = 'GET', body, headers = {}, prefer, object = false } = {}) {
    const res = await fetch(`${this.baseUrl}/${pathname}`, {
      method,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
        ...(object ? { Accept: 'application/vnd.pgrst.object+json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    if (!res.ok) throw new Error(`${method} ${pathname} -> ${res.status} ${res.statusText}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`);
    return data;
  }

  async select(table, query) {
    return this.request(`${table}?${query}`);
  }

  async insert(table, row) {
    return this.request(table, { method: 'POST', body: [row], prefer: 'return=representation' });
  }

  async update(table, matchQuery, patch) {
    return this.request(`${table}?${matchQuery}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
  }

  async delete(table, matchQuery) {
    return this.request(`${table}?${matchQuery}`, { method: 'DELETE', prefer: 'return=representation' });
  }
}
