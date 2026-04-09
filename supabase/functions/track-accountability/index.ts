import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function callAIWithRetry(body: object, apiKey: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.ok) return response;
    if (response.status === 402) return response;
    if (response.status === 429) {
      const waitMs = Math.min(2000 * Math.pow(2, attempt), 10000);
      console.log(`Rate limited, waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    if (response.status >= 400 && response.status < 500) return response;

    const waitMs = Math.min(1000 * Math.pow(2, attempt), 8000);
    console.log(`Server error ${response.status}, retrying in ${waitMs}ms (${attempt + 1}/${maxRetries})`);
    await new Promise(r => setTimeout(r, waitMs));
  }

  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();

    if (!transcript || transcript.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Transcript is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const response = await callAIWithRetry({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are a meeting accountability analyst. Analyze transcripts to extract action items with ownership tracking.

For each action item found, determine:
- task: The action item description
- owner: The person assigned (or null if unclear)
- deadline: Any mentioned deadline (or null)
- ownership_clarity: "clear" | "ambiguous" | "missing"
- accountability_score: 0-100 based on: clear owner + deadline = 100, owner only = 70, deadline only = 50, neither = 20

Also provide:
- unassigned_count: Number of tasks with no clear owner
- risk_summary: A one-sentence risk assessment

Return ONLY valid JSON in this exact format:
{
  "tasks": [
    {
      "task": "string",
      "owner": "string or null",
      "deadline": "string or null",
      "ownership_clarity": "clear | ambiguous | missing",
      "accountability_score": number
    }
  ],
  "unassigned_count": number,
  "average_score": number,
  "risk_summary": "string"
}`
        },
        {
          role: 'user',
          content: `Analyze this meeting transcript for task ownership and accountability:\n\n${transcript}`
        }
      ],
      temperature: 0.3,
    }, apiKey);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error after retries:", response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { tasks: [], unassigned_count: 0, average_score: 0, risk_summary: "Could not parse response" };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
