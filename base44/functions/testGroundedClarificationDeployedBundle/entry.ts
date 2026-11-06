import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { GROUNDED_CLARIFICATION_SUBMIT_VERSION } from '../../shared/story/groundedClarificationContract.js';
const ORIGIN='https://tale-weaver-cotfr.base44.app';
const read=async url=>{const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`Public asset returned ${response.status}`);return response.text();};
export default async function(req){
  const client=createClientFromRequest(req),user=await client.auth.me();
  if(!user||user.role!=='admin')return Response.json({error:'Admin required'},{status:403});
  try{
    const html=await read(`${ORIGIN}/Game?clarification_gate=${Date.now()}`);
    const scripts=[...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(m=>new URL(m[1],ORIGIN)).filter(u=>u.origin===ORIGIN&&/^\/assets\/index-[A-Za-z0-9_-]+\.js$/.test(u.pathname));
    if(scripts.length!==1)throw new Error(`Expected one app bundle, found ${scripts.length}`);
    const code=await read(scripts[0].href);
    const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code)))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const marker=code.includes(GROUNDED_CLARIFICATION_SUBMIT_VERSION),handler=code.includes('grounded-clarification:')&&code.includes('answer_text')&&code.includes('expected_scene_revision');
    const binding=code.includes('clarification_intent_id')&&code.includes('selected_source_id')&&code.includes('transfer_committed');
    return Response.json({public_asset:scripts[0].pathname,sha256,bytes:code.length,legacy_submit_handler_present:handler,
      expected_marker:GROUNDED_CLARIFICATION_SUBMIT_VERSION,marker_present:marker,binding_fields_present:binding,all_pass:marker&&handler&&binding,
      publish_required:!(marker&&binding),live_writes:0});
  }catch(error){return Response.json({error:error.message,all_pass:false,live_writes:0},{status:500});}
}