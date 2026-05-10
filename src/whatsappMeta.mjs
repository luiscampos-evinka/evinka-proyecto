import crypto from 'node:crypto';

export class WhatsAppMetaClient {
  constructor({ accessToken, phoneNumberId, appSecret }) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.appSecret = appSecret;
  }

  verifySignature(rawBody, signatureHeader) {
    if (!this.appSecret || !signatureHeader) return true;
    const expected = `sha256=${crypto.createHmac('sha256', this.appSecret).update(rawBody).digest('hex')}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
    } catch {
      return false;
    }
  }

  async sendPayload(payload) {
    const res = await fetch(`https://graph.facebook.com/v22.0/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        ...payload,
      }),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new Error(`Meta sendPayload -> ${res.status} ${res.statusText}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`);
    return data;
  }

  async sendText(to, body) {
    return this.sendPayload({
      to,
      type: 'text',
      text: { body },
    });
  }

  async uploadMedia({ buffer, mimeType = 'application/octet-stream', fileName = 'archivo' }) {
    const form = new FormData();
    form.set('messaging_product', 'whatsapp');
    form.set('type', mimeType);
    form.set('file', new Blob([buffer], { type: mimeType }), fileName);
    const res = await fetch(`https://graph.facebook.com/v22.0/${this.phoneNumberId}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: form,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new Error(`Meta uploadMedia -> ${res.status} ${res.statusText}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`);
    return data;
  }

  async sendImage(to, { mediaId, caption = '' }) {
    return this.sendPayload({
      to,
      type: 'image',
      image: {
        id: mediaId,
        ...(caption ? { caption } : {}),
      },
    });
  }

  async sendDocument(to, { mediaId, caption = '', fileName = undefined }) {
    return this.sendPayload({
      to,
      type: 'document',
      document: {
        id: mediaId,
        ...(caption ? { caption } : {}),
        ...(fileName ? { filename: fileName } : {}),
      },
    });
  }

  async sendButtons(to, { body, footer = '', buttons = [] }) {
    if (!buttons.length || buttons.length > 3) {
      throw new Error('sendButtons requiere entre 1 y 3 botones');
    }
    return this.sendPayload({
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body },
        ...(footer ? { footer: { text: footer } } : {}),
        action: {
          buttons: buttons.map((button) => ({
            type: 'reply',
            reply: {
              id: button.id,
              title: button.title,
            },
          })),
        },
      },
    });
  }

  async sendList(to, { body, footer = '', buttonText = 'Ver opciones', sections = [] }) {
    const normalizedSections = sections
      .map((section) => ({
        title: section.title,
        rows: Array.isArray(section.rows) ? section.rows.filter((row) => row?.id && row?.title) : [],
      }))
      .filter((section) => section.rows.length);
    const totalRows = normalizedSections.reduce((sum, section) => sum + section.rows.length, 0);
    if (!normalizedSections.length || totalRows < 1 || totalRows > 10) {
      throw new Error('sendList requiere entre 1 y 10 opciones válidas');
    }
    return this.sendPayload({
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: body },
        ...(footer ? { footer: { text: footer } } : {}),
        action: {
          button: buttonText,
          sections: normalizedSections.map((section) => ({
            ...(section.title ? { title: section.title } : {}),
            rows: section.rows.map((row) => ({
              id: row.id,
              title: row.title,
              ...(row.description ? { description: row.description } : {}),
            })),
          })),
        },
      },
    });
  }

  async getMediaInfo(mediaId) {
    const res = await fetch(`https://graph.facebook.com/v22.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new Error(`Meta getMediaInfo -> ${res.status} ${res.statusText}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`);
    return data;
  }

  async downloadMedia(mediaId) {
    const info = await this.getMediaInfo(mediaId);
    const res = await fetch(info.url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Meta downloadMedia -> ${res.status} ${res.statusText}\n${text}`);
    }
    return {
      mediaId,
      buffer: Buffer.from(await res.arrayBuffer()),
      mimeType: info.mime_type || null,
      sha256: info.sha256 || null,
      fileSize: info.file_size || null,
    };
  }

  extractMessages(payload) {
    const entries = payload?.entry || [];
    const out = [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const contacts = value.contacts || [];
        const messages = value.messages || [];
        for (const msg of messages) {
          const media = msg.image || msg.document || null;
          out.push({
            id: msg.id,
            from: msg.from,
            profileName: contacts[0]?.profile?.name || null,
            type: msg.type,
            text:
              msg.text?.body ||
              msg.image?.caption ||
              msg.document?.caption ||
              msg.interactive?.button_reply?.title ||
              msg.interactive?.list_reply?.title ||
              null,
            interactive: msg.interactive?.button_reply ? {
              id: msg.interactive.button_reply.id,
              title: msg.interactive.button_reply.title,
              kind: 'button_reply',
            } : msg.interactive?.list_reply ? {
              id: msg.interactive.list_reply.id,
              title: msg.interactive.list_reply.title,
              description: msg.interactive.list_reply.description || null,
              kind: 'list_reply',
            } : null,
            media: media ? {
              id: media.id,
              mimeType: media.mime_type || null,
              sha256: media.sha256 || null,
              caption: media.caption || null,
              fileName: media.filename || null,
            } : null,
            raw: msg,
            value,
          });
        }
      }
    }
    return out;
  }
}
