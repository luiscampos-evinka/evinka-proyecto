function encodeObjectPath(value = '') {
  return String(value || '')
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export class SupabaseStorage {
  constructor({ url, key }) {
    this.baseUrl = String(url || '').replace(/\/$/, '');
    this.key = key;
  }

  objectUrl(bucket = '', objectPath = '') {
    return `${this.baseUrl}/storage/v1/object/${encodeURIComponent(String(bucket || '').trim())}/${encodeObjectPath(objectPath)}`;
  }

  async uploadObject(bucket, objectPath, buffer, { contentType = 'application/octet-stream', upsert = true } = {}) {
    const res = await fetch(this.objectUrl(bucket, objectPath), {
      method: 'POST',
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        'Content-Type': contentType,
        'x-upsert': upsert ? 'true' : 'false',
      },
      body: buffer,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      throw new Error(`Storage upload ${bucket}/${objectPath} -> ${res.status} ${res.statusText}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`);
    }
    return {
      bucket,
      objectPath,
      contentType,
      size: Buffer.byteLength(buffer),
      response: data,
    };
  }

  async downloadObject(bucket, objectPath) {
    const res = await fetch(this.objectUrl(bucket, objectPath), {
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Storage download ${bucket}/${objectPath} -> ${res.status} ${res.statusText}\n${text}`);
    }
    return {
      bucket,
      objectPath,
      buffer: Buffer.from(await res.arrayBuffer()),
      mimeType: res.headers.get('content-type') || null,
      fileSize: Number(res.headers.get('content-length') || 0) || null,
    };
  }
}
