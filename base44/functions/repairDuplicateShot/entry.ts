Deno.serve(() => Response.json({ error: 'Repair endpoint retired' }, { status: 410 }));
