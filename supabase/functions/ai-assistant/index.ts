
// Supabase Edge Function - AEGIS AI Assistant
// Secure backend proxy for AI provider. Never expose key to client.
// Deploy: supabase functions deploy ai-assistant

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req)=>{
  const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});

  try{
    const { query, organization_id, context } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // RLS check via JWT (verify user is org member) - simplified
    // TODO: validate auth header

    // Gather authorized org data for context (sample aggregation)
    const { data: risks } = await supabase.from("risks").select("title,severity,inherent_score").eq("organization_id", organization_id).eq("status","open").order("inherent_score",{ascending:false}).limit(5);
    const { data: assessments } = await supabase.from("compliance_assessments").select("status").eq("organization_id", organization_id);
    
    const nonCompliantCount = assessments?.filter(a=> a.status==='non_compliant').length || 0;

    const aiKey = Deno.env.get("AI_PROVIDER_API_KEY");
    if(!aiKey){
      // Demo mode response
      return new Response(JSON.stringify({
        answer: `[DEMO] You asked: "${query}". Based on authorized org data: ${risks?.length||0} open high risks, ${nonCompliantCount} non-compliant controls. Top recommendation: Review DPDP consent logs (DP-1, DP-7), automate CERT-In 6hr reporting, complete RBI asset inventory. Sources: DPDP Act Sec 6/8, CERT-In Dir 28-Apr-2022, ISO A.5.31. This is not legal advice.`,
        sources: ["DPDP Act 2023", "CERT-In Directions", "ISO 27001 A.5.31"],
        is_demo: true
      }), { headers:{...cors, "Content-Type":"application/json"} });
    }

    // Real provider call (OpenAI example)
    const prompt = `You are AEGIS GRC AI assistant. Org context: risks=${JSON.stringify(risks)}, assessments non-compliant=${nonCompliantCount}. Question: ${query}. Respect permissions, cite sources, distinguish facts vs suggestions, no legal certification claims.`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{ "Authorization":`Bearer ${aiKey}`, "Content-Type":"application/json" },
      body: JSON.stringify({ model:"gpt-4o-mini", messages:[{role:"system", content:"You are a GRC expert assistant."},{role:"user", content: prompt}], temperature:0.3 })
    });
    const aiJson = await aiRes.json();
    const answer = aiJson.choices?.[0]?.message?.content || "AI unavailable";

    return new Response(JSON.stringify({ answer, sources:["Org DB","Framework library"], is_demo:false }), { headers:{...cors, "Content-Type":"application/json"} });

  }catch(e){
    return new Response(JSON.stringify({ error: String(e) }), { status:500, headers: {"Content-Type":"application/json"} });
  }
});
