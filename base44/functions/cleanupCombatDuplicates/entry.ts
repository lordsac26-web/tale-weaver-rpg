Deno.serve(() => Response.json({ error: 'Cleanup endpoint retired' }, { status: 410 }));
