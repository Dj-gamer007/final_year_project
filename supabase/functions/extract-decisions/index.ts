import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { transcript } = await req.json();
    if (!transcript || typeof transcript !== "string") {
      throw new Error("Missing or invalid transcript");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a meeting analyst that extracts decisions, commitments, and blockers from meeting transcripts. You must respond ONLY by calling the extract_decisions function.`,
          },
          {
            role: "user",
            content: `Analyze the following meeting transcript and extract all final decisions, approvals, pending items, and blockers.\n\nTranscript:\n${transcript}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_decisions",
              description: "Extract structured decisions, pending items, and blockers from a meeting transcript.",
              parameters: {
                type: "object",
                properties: {
                  decisions: {
                    type: "array",
                    description: "Final decisions, approvals, or commitments made during the meeting",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "The decision or commitment" },
                        confidence: { type: "number", description: "Confidence score 0-1" },
                        speaker: { type: "string", description: "Who made or announced the decision" },
                      },
                      required: ["text", "confidence"],
                      additionalProperties: false,
                    },
                  },
                  pending: {
                    type: "array",
                    description: "Items still under discussion, awaiting approval, or deferred",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "The pending item" },
                        reason: { type: "string", description: "Why it is pending" },
                      },
                      required: ["text"],
                      additionalProperties: false,
                    },
                  },
                  blockers: {
                    type: "array",
                    description: "Issues blocking progress, unresolved conflicts, or hard dependencies",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "The blocker" },
                        impact: { type: "string", description: "What it blocks or impacts" },
                      },
                      required: ["text"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["decisions", "pending", "blockers"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_decisions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No structured output from AI");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("extract-decisions error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
