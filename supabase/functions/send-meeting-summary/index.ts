import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_FROM_EMAIL = Deno.env.get("BREVO_FROM_EMAIL") || "noreply@example.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendSummaryRequest {
  meetingId: string;
  meetingTitle?: string;
  summaries: { [role: string]: string };
  actionItems: Array<{
    task: string;
    assignee?: string;
    priority: string;
    status: string;
  }>;
  participants: Array<{
    name: string;
    email?: string;
    role: string;
    engagement_score: number;
  }>;
  decisions?: {
    decisions?: Array<{ text: string; confidence?: number; speaker?: string }>;
    pending?: Array<{ text: string; reason?: string }>;
    blockers?: Array<{ text: string; impact?: string }>;
  } | null;
  influence?: {
    speakers?: Array<{
      name: string;
      influence_score: number;
      role_alignment: string;
      talk_time_percent: number;
      decision_words: number;
      key_contributions: string;
    }>;
    meeting_leader?: string;
    participation_balance?: string;
  } | null;
  accountability?: {
    tasks?: Array<{
      task: string;
      owner: string | null;
      deadline: string | null;
      ownership_clarity: string;
      accountability_score: number;
    }>;
    unassigned_count?: number;
    average_score?: number;
    risk_summary?: string;
  } | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SendSummaryRequest = await req.json();
    const { meetingId, meetingTitle, summaries, actionItems, participants, decisions, influence, accountability } = body;

    console.log("Sending meeting summary emails for meeting:", meetingId);

    const recipientsWithEmail = participants.filter(
      (p) => p.email && p.email.includes("@")
    );

    if (recipientsWithEmail.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No participants with valid email addresses", emailsSent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const summaryHtml = Object.entries(summaries)
      .map(([role, content]) => `
        <h3 style="color: #4f46e5; margin-top: 20px;">${role.charAt(0).toUpperCase() + role.slice(1)} Summary</h3>
        <p style="white-space: pre-line; color: #374151;">${content}</p>
      `)
      .join("");

    const actionItemsHtml = actionItems.length > 0 ? `
      <h3 style="color: #4f46e5; margin-top: 30px;">Action Items</h3>
      <ul style="color: #374151;">
        ${actionItems.map(item => `
          <li style="margin-bottom: 10px;">
            <strong>${item.task}</strong><br/>
            <span style="font-size: 12px; color: #6b7280;">
              Priority: ${item.priority} | Status: ${item.status}
              ${item.assignee ? ` | Assigned to: ${item.assignee}` : ""}
            </span>
          </li>
        `).join("")}
      </ul>
    ` : "";

    const participantsHtml = `
      <h3 style="color: #4f46e5; margin-top: 30px;">Participants</h3>
      <ul style="color: #374151;">
        ${participants.map(p => `<li>${p.name} (${p.role}) - Engagement: ${p.engagement_score}%</li>`).join("")}
      </ul>
    `;

    // Decisions section
    let decisionsHtml = "";
    if (decisions) {
      const hasContent = (decisions.decisions?.length || 0) + (decisions.pending?.length || 0) + (decisions.blockers?.length || 0) > 0;
      if (hasContent) {
        decisionsHtml = `<h3 style="color: #4f46e5; margin-top: 30px;">📋 Decisions & Commitments</h3>`;
        
        if (decisions.decisions?.length) {
          decisionsHtml += `<div style="margin-bottom: 16px;">
            <h4 style="color: #10B981; font-size: 14px;">🟢 Decisions (${decisions.decisions.length})</h4>
            ${decisions.decisions.map(d => `
              <div style="border-left: 3px solid #10B981; padding: 6px 12px; margin-bottom: 6px; background: #ECFDF5; border-radius: 0 4px 4px 0;">
                <div style="font-size: 13px; font-weight: bold; color: #065F46;">✅ ${d.text}</div>
                ${d.speaker ? `<div style="font-size: 11px; color: #6B7280;">Speaker: ${d.speaker}</div>` : ""}
              </div>
            `).join("")}
          </div>`;
        }
        
        if (decisions.pending?.length) {
          decisionsHtml += `<div style="margin-bottom: 16px;">
            <h4 style="color: #F59E0B; font-size: 14px;">🟡 Pending (${decisions.pending.length})</h4>
            ${decisions.pending.map(p => `
              <div style="border-left: 3px solid #F59E0B; padding: 6px 12px; margin-bottom: 6px; background: #FFFBEB; border-radius: 0 4px 4px 0;">
                <div style="font-size: 13px; font-weight: bold; color: #92400E;">⏳ ${p.text}</div>
                ${p.reason ? `<div style="font-size: 11px; color: #6B7280;">Reason: ${p.reason}</div>` : ""}
              </div>
            `).join("")}
          </div>`;
        }
        
        if (decisions.blockers?.length) {
          decisionsHtml += `<div style="margin-bottom: 16px;">
            <h4 style="color: #EF4444; font-size: 14px;">🔴 Blockers (${decisions.blockers.length})</h4>
            ${decisions.blockers.map(b => `
              <div style="border-left: 3px solid #EF4444; padding: 6px 12px; margin-bottom: 6px; background: #FEF2F2; border-radius: 0 4px 4px 0;">
                <div style="font-size: 13px; font-weight: bold; color: #991B1B;">🚫 ${b.text}</div>
                ${b.impact ? `<div style="font-size: 11px; color: #6B7280;">Impact: ${b.impact}</div>` : ""}
              </div>
            `).join("")}
          </div>`;
        }
      }
    }

    // Influence section
    let influenceHtml = "";
    if (influence?.speakers?.length) {
      const sorted = [...influence.speakers].sort((a, b) => b.influence_score - a.influence_score);
      influenceHtml = `
        <h3 style="color: #4f46e5; margin-top: 30px;">📊 Speaker Influence Analysis</h3>
        <p style="font-size: 13px; color: #374151; margin-bottom: 12px;">
          <strong>Meeting Leader:</strong> ${influence.meeting_leader || 'N/A'} &nbsp;|&nbsp;
          <strong>Balance:</strong> ${influence.participation_balance === 'balanced' ? '✅ Well Balanced' : influence.participation_balance === 'moderate' ? '⚠️ Moderately Balanced' : '🔴 One-Sided'}
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tr style="background: #374151; color: white;">
            <th style="padding: 8px; text-align: left;">Speaker</th>
            <th style="padding: 8px; text-align: center;">Role</th>
            <th style="padding: 8px; text-align: center;">Score</th>
            <th style="padding: 8px; text-align: center;">Talk %</th>
            <th style="padding: 8px; text-align: center;">Decisions</th>
          </tr>
          ${sorted.map((s, i) => {
            const bg = i % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
            const roleColor = s.role_alignment === 'Leader' ? '#D97706' : s.role_alignment === 'Contributor' ? '#2563EB' : '#6B7280';
            return `<tr style="background: ${bg};">
              <td style="padding: 6px 8px; font-weight: bold;">${s.name}</td>
              <td style="padding: 6px 8px; text-align: center;"><span style="background: ${roleColor}20; color: ${roleColor}; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold;">${s.role_alignment}</span></td>
              <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: ${roleColor};">${Math.round(s.influence_score)}</td>
              <td style="padding: 6px 8px; text-align: center;">${Math.round(s.talk_time_percent)}%</td>
              <td style="padding: 6px 8px; text-align: center;">${s.decision_words}</td>
            </tr>`;
          }).join("")}
        </table>
      `;
    }

    // Accountability section
    let accountabilityHtml = "";
    if (accountability?.tasks?.length) {
      const scoreColor = (accountability.average_score || 0) >= 70 ? '#10B981' : (accountability.average_score || 0) >= 50 ? '#F59E0B' : '#EF4444';
      accountabilityHtml = `
        <h3 style="color: #4f46e5; margin-top: 30px;">🛡️ Task Ownership & Accountability</h3>
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <div style="flex: 1; background: #F0FDF4; border-radius: 6px; padding: 8px; text-align: center;">
            <div style="font-size: 11px; color: #6B7280;">Avg Score</div>
            <div style="font-size: 20px; font-weight: bold; color: ${scoreColor};">${accountability.average_score || 0}%</div>
          </div>
          <div style="flex: 1; background: ${(accountability.unassigned_count || 0) > 0 ? '#FEF2F2' : '#F0FDF4'}; border-radius: 6px; padding: 8px; text-align: center;">
            <div style="font-size: 11px; color: #6B7280;">Unassigned</div>
            <div style="font-size: 20px; font-weight: bold; color: ${(accountability.unassigned_count || 0) > 0 ? '#EF4444' : '#10B981'};">${accountability.unassigned_count || 0}</div>
          </div>
        </div>
        ${accountability.risk_summary ? `<div style="border-left: 3px solid #F59E0B; padding: 6px 12px; margin-bottom: 12px; background: #FFFBEB; border-radius: 0 4px 4px 0; font-size: 12px;"><strong style="color: #92400E;">⚠️ Risk:</strong> <span style="color: #374151;">${accountability.risk_summary}</span></div>` : ''}
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tr style="background: #374151; color: white;">
            <th style="padding: 6px 8px; text-align: left;">Task</th>
            <th style="padding: 6px 8px; text-align: center;">Owner</th>
            <th style="padding: 6px 8px; text-align: center;">Clarity</th>
            <th style="padding: 6px 8px; text-align: center;">Score</th>
          </tr>
          ${accountability.tasks.map((t, i) => {
            const bg = i % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
            const cColor = t.ownership_clarity === 'clear' ? '#10B981' : t.ownership_clarity === 'ambiguous' ? '#F59E0B' : '#EF4444';
            return `<tr style="background: ${bg};">
              <td style="padding: 6px 8px; font-weight: bold;">${t.task}</td>
              <td style="padding: 6px 8px; text-align: center;">${t.owner || '—'}</td>
              <td style="padding: 6px 8px; text-align: center;"><span style="background: ${cColor}20; color: ${cColor}; padding: 2px 6px; border-radius: 8px; font-size: 10px; font-weight: bold;">${t.ownership_clarity}</span></td>
              <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${t.accountability_score}%</td>
            </tr>`;
          }).join("")}
        </table>
      `;
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background-color: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h1 style="color: #111827; font-size: 24px; margin-bottom: 10px;">📋 Meeting Summary</h1>
          <p style="color: #6b7280; margin-bottom: 30px;">
            ${meetingTitle || `Meeting ID: ${meetingId.slice(0, 8)}`}<br/>
            <span style="font-size: 12px;">Generated on ${new Date().toLocaleString()}</span>
          </p>
          ${summaryHtml || '<p style="color: #6b7280;">No summaries generated for this meeting.</p>'}
          ${actionItemsHtml}
          ${decisionsHtml}
          ${influenceHtml}
          ${accountabilityHtml}
          ${participantsHtml}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;"/>
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            This is an automated meeting summary from AI Meeting Summarizer.<br/>Do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;

    const emailSubject = `Meeting Summary: ${meetingTitle || meetingId.slice(0, 8)}`;

    const results = [];
    for (const participant of recipientsWithEmail) {
      try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": BREVO_API_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: "Meeting Summary", email: BREVO_FROM_EMAIL },
            to: [{ email: participant.email }],
            subject: emailSubject,
            htmlContent: emailHtml,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          console.error("Brevo error for", participant.email, data);
          results.push({ email: participant.email, success: false, error: data.message || "Brevo API error" });
        } else {
          results.push({ email: participant.email, success: true });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        results.push({ email: participant.email, success: false, error: msg });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return new Response(
      JSON.stringify({ success: true, emailsSent: successCount, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
