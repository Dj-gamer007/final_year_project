import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function callAIWithRetry(apiKey: string, body: object, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (response.ok) return response;
    if (response.status === 429 || response.status >= 500) {
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      continue;
    }
    return response;
  }
  throw new Error('AI API failed after retries');
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

    const response = await callAIWithRetry(apiKey, {
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are a meeting influence analyst. Analyze the speaker-tagged transcript to measure each speaker's influence and contribution.

For each speaker, calculate:
- talk_time_percent: Percentage of total words spoken by this speaker
- decision_words: Count of decision/action keywords ("approve", "finalize", "assign", "decide", "confirm", "agree", "commit", "launch", "deploy", "release")
- question_count: Number of questions asked
- command_count: Number of imperative/directive sentences
- influence_score: 0-100 calculated as: (talk_time_percent * 0.3) + (decision_word_density * 0.4) + (command_ratio * 0.2) + (engagement * 0.1), normalized to 100
- role_alignment: "Leader" if influence_score >= 70, "Contributor" if >= 40, "Observer" if < 40
- key_contributions: 1-2 sentence summary of their main contributions

Also provide:
- meeting_leader: Name of the most influential speaker
- participation_balance: "balanced" | "moderate" | "dominated" based on spread of talk time

Return ONLY valid JSON in this exact format:
{
  "speakers": [
    {
      "name": "string",
      "talk_time_percent": number,
      "decision_words": number,
      "question_count": number,
      "command_count": number,
      "influence_score": number,
      "role_alignment": "Leader | Contributor | Observer",
      "key_contributions": "string"
    }
  ],
  "meeting_leader": "string",
  "participation_balance": "balanced | moderate | dominated"
}`
        },
        {
          role: 'user',
          content: `Analyze this meeting transcript for speaker influence and contributions:\n\n${transcript}`
        }
      ],
      temperature: 0.3,
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { speakers: [], meeting_leader: "Unknown", participation_balance: "unknown" };
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
