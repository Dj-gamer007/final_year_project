import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ActionItemsRequest {
  transcript: string;
}

const MAX_TRANSCRIPT_LENGTH = 100000;

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
    const body = await req.json();
    const { transcript } = body as ActionItemsRequest;

    if (!transcript || typeof transcript !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Transcript is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Transcript exceeds maximum length of ${MAX_TRANSCRIPT_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `Extract action items from this meeting transcript. 
For each action item, provide:
- task: A clear description of the task
- assignee: The person responsible (if mentioned)
- priority: "high", "medium", or "low" based on urgency
- status: "pending"

Format your response as a JSON array of objects. Example:
[
  {
    "task": "Set up WebRTC infrastructure",
    "assignee": "Team Member 1",
    "priority": "high",
    "status": "pending"
  }
]

Only return the JSON array, no additional text.`;

    console.log('Extracting action items from transcript');

    const response = await callAIWithRetry({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript }
      ],
    }, LOVABLE_API_KEY);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error after retries:", response.status, errorText);
      throw new Error("Failed to extract action items");
    }

    const data = await response.json();
    let actionItemsText = data.choices[0].message.content;

    actionItemsText = actionItemsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let actionItems;
    try {
      actionItems = JSON.parse(actionItemsText);
    } catch (parseError) {
      console.error('Failed to parse action items:', actionItemsText);
      throw new Error('Invalid action items format from AI');
    }

    console.log('Action items extracted successfully:', actionItems.length);

    return new Response(
      JSON.stringify({ actionItems }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Error in extract-action-items:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
