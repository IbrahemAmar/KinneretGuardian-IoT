const IMS_URL   = 'https://api.ims.gov.il/v1/envista/stations/8/data/latest';
const API_TOKEN = process.env.IMS_API_TOKEN ?? '1a901e45-9028-44ff-bd2c-35e82407fb9b';

export async function GET() {
  try {
    const res = await fetch(IMS_URL, {
      headers: { Authorization: `ApiToken ${API_TOKEN}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`IMS HTTP ${res.status}`);
    const json = await res.json();

    const obs = Array.isArray(json.data) ? json.data[0] : null;
    const channels = obs?.channels ?? [];
    const get = name => channels.find(c => c.name === name && c.valid)?.value ?? null;

    return Response.json({
      ok: true,
      ws: get('WS'),
      wd: get('WD'),
      datetime: obs?.datetime ?? null,
      raw: json,
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
