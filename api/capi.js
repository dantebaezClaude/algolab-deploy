// Meta Conversions API (server-side) — reenvía eventos del píxel con el mismo event_id
// para deduplicar contra el evento de navegador. Requiere la variable de entorno
// META_ACCESS_TOKEN configurada en Vercel (Project Settings → Environment Variables).
const PIXEL_ID = '2262112711227862';
const GRAPH_VERSION = 'v19.0';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    res.status(500).json({ error: 'META_ACCESS_TOKEN no configurado en Vercel' });
    return;
  }

  const { event_name, event_id, event_source_url, fbp, fbc, user_agent } = req.body || {};
  if (!event_name || !event_id) {
    res.status(400).json({ error: 'Faltan event_name o event_id' });
    return;
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIp = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || '')
    .split(',')[0].trim() || req.socket?.remoteAddress;

  const payload = {
    data: [{
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id,
      event_source_url,
      action_source: 'website',
      user_data: {
        client_ip_address: clientIp,
        client_user_agent: user_agent,
        ...(fbp ? { fbp } : {}),
        ...(fbc ? { fbc } : {}),
      },
    }],
  };

  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    const data = await metaRes.json();
    res.status(metaRes.ok ? 200 : 502).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error enviando evento a Meta' });
  }
};
