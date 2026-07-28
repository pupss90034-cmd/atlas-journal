import type { APIRoute } from 'astro';

// This route needs to run on-demand (not prerendered) so it can read the
// request body and write to the NEWSLETTER_KV binding on every submission.
export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export const POST: APIRoute = async ({ request, locals }) => {
	let body: Record<string, unknown>;
	const contentType = request.headers.get('content-type') ?? '';

	try {
		if (contentType.includes('application/json')) {
			body = await request.json();
		} else {
			const form = await request.formData();
			body = Object.fromEntries(form.entries());
		}
	} catch {
		return json({ ok: false, error: 'INVALID_BODY' }, 400);
	}

	// Honeypot: a real person never fills this hidden field in. Bots that
	// blindly fill every field will trip it — silently pretend success so we
	// don't tip them off, but never write to KV.
	const honeypot = typeof body.company === 'string' ? body.company.trim() : '';
	if (honeypot) {
		return json({ ok: true });
	}

	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	if (!email || !EMAIL_RE.test(email)) {
		return json({ ok: false, error: 'INVALID_EMAIL' }, 400);
	}

	const kv = locals.runtime?.env?.NEWSLETTER_KV;
	if (!kv) {
		return json({ ok: false, error: 'STORAGE_UNAVAILABLE' }, 500);
	}

	const existing = await kv.get(email);
	if (existing) {
		return json({ ok: true, alreadySubscribed: true });
	}

	await kv.put(
		email,
		JSON.stringify({
			email,
			subscribedAt: new Date().toISOString(),
			source: request.headers.get('referer') ?? 'unknown',
		}),
	);

	return json({ ok: true });
};
