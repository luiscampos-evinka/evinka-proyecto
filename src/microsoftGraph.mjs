import { requiredEnv } from './config.mjs';

function graphBaseUrl() {
  return (process.env.MICROSOFT_GRAPH_BASE_URL || 'https://graph.microsoft.com/v1.0').replace(/\/$/, '');
}

function tokenUrl() {
  const tenantId = requiredEnv('MICROSOFT_TENANT_ID');
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

export class MicrosoftGraphClient {
  constructor({
    clientId = requiredEnv('MICROSOFT_CLIENT_ID'),
    clientSecret = requiredEnv('MICROSOFT_CLIENT_SECRET'),
    senderEmail = requiredEnv('MICROSOFT_SENDER_EMAIL'),
    senderName = process.env.MICROSOFT_SENDER_NAME || 'EVINKABOT',
    defaultTimeZone = process.env.MICROSOFT_TIMEZONE || 'America/Lima',
    baseUrl = graphBaseUrl(),
  } = {}) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.senderEmail = senderEmail;
    this.senderName = senderName;
    this.defaultTimeZone = defaultTimeZone;
    this.baseUrl = baseUrl;
    this.tokenCache = null;
  }

  async getAccessToken() {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 60_000) return this.tokenCache.accessToken;

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const res = await fetch(tokenUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      throw new Error(`Microsoft token -> ${res.status} ${res.statusText}\n${JSON.stringify(data, null, 2)}`);
    }

    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: now + ((data.expires_in || 3600) * 1000),
    };
    return this.tokenCache.accessToken;
  }

  async request(path, { method = 'GET', headers = {}, body } = {}) {
    const accessToken = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: `outlook.timezone="${this.defaultTimeZone}"`,
        ...headers,
      },
      body: body == null ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      throw new Error(`Microsoft Graph ${method} ${path} -> ${res.status} ${res.statusText}\n${JSON.stringify(data, null, 2)}`);
    }
    return data;
  }

  async sendMail({ to, subject, text = '', html = '', attachments = [] }) {
    const recipients = Array.isArray(to) ? to : [to];
    return this.request(`/users/${encodeURIComponent(this.senderEmail)}/sendMail`, {
      method: 'POST',
      body: {
        message: {
          subject,
          body: {
            contentType: html ? 'HTML' : 'Text',
            content: html || text,
          },
          toRecipients: recipients.filter(Boolean).map((email) => ({
            emailAddress: { address: email },
          })),
          ...(attachments.length ? {
            attachments: attachments.map((item) => ({
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: item.name,
              contentType: item.contentType || 'application/octet-stream',
              contentBytes: item.contentBytes,
            })),
          } : {}),
        },
        saveToSentItems: true,
      },
    });
  }

  async getDefaultCalendar() {
    return this.request(`/users/${encodeURIComponent(this.senderEmail)}/calendar`);
  }

  async listEvents({ top = 20, startDateTime = null, endDateTime = null } = {}) {
    if (startDateTime && endDateTime) {
      const qs = new URLSearchParams({ startDateTime, endDateTime, $top: String(top) });
      const data = await this.request(`/users/${encodeURIComponent(this.senderEmail)}/calendarView?${qs.toString()}`);
      return data?.value || [];
    }
    const qs = new URLSearchParams({ $top: String(top) });
    const data = await this.request(`/users/${encodeURIComponent(this.senderEmail)}/events?${qs.toString()}`);
    return data?.value || [];
  }

  async createEvent({ subject, startDateTime, endDateTime, timeZone = this.defaultTimeZone, body = '', location = '', attendees = [], categories = [] }) {
    return this.request(`/users/${encodeURIComponent(this.senderEmail)}/events`, {
      method: 'POST',
      body: {
        subject,
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
        body: { contentType: 'text', content: body },
        location: location ? { displayName: location } : undefined,
        attendees,
        categories,
      },
    });
  }

  async getEvent(eventId) {
    return this.request(`/users/${encodeURIComponent(this.senderEmail)}/events/${encodeURIComponent(eventId)}`);
  }

  async updateEvent(eventId, patch) {
    return this.request(`/users/${encodeURIComponent(this.senderEmail)}/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      body: patch,
    });
  }

  async cancelEvent(eventId, comment = 'Cancelada desde EVINKABOT.') {
    await this.request(`/users/${encodeURIComponent(this.senderEmail)}/events/${encodeURIComponent(eventId)}/cancel`, {
      method: 'POST',
      body: { comment },
    });
    return { ok: true };
  }

  async deleteEvent(eventId) {
    await this.request(`/users/${encodeURIComponent(this.senderEmail)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
    return { ok: true };
  }
}
