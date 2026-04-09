import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { detectScript } from './pdfFonts';

interface DecisionItem {
  text: string;
  confidence?: number;
  speaker?: string;
}

interface PendingItem {
  text: string;
  reason?: string;
}

interface BlockerItem {
  text: string;
  impact?: string;
}

interface SpeakerInfluenceItem {
  name: string;
  talk_time_percent: number;
  decision_words: number;
  question_count: number;
  command_count: number;
  influence_score: number;
  role_alignment: string;
  key_contributions: string;
}

interface InfluenceData {
  speakers: SpeakerInfluenceItem[];
  meeting_leader: string;
  participation_balance: string;
}

interface AccountabilityTask {
  task: string;
  owner: string | null;
  deadline: string | null;
  ownership_clarity: "clear" | "ambiguous" | "missing";
  accountability_score: number;
}

interface AccountabilityData {
  tasks: AccountabilityTask[];
  unassigned_count: number;
  average_score: number;
  risk_summary: string;
}

interface PDFExportData {
  meetingId: string;
  transcripts: { speaker: string; text: string }[];
  summaries: Record<string, string>;
  actionItems: { task: string; priority?: string; status?: string; assignee?: string }[];
  participants: { name: string; role: string; engagement_score?: number | null }[];
  decisions?: { decisions: DecisionItem[]; pending: PendingItem[]; blockers: BlockerItem[] } | null;
  influence?: InfluenceData | null;
  accountability?: AccountabilityData | null;
  options: {
    includeGeneralSummary: boolean;
    includeRoleSummaries: boolean;
    includeParticipants: boolean;
    includeActionItems: boolean;
    includeDecisions: boolean;
    includeInfluence: boolean;
    includeAccountability: boolean;
  };
  isManager: boolean;
  summaryRole: string;
}

/**
 * Check if content requires html2canvas rendering (non-Latin scripts).
 */
export function needsHtml2CanvasExport(contentSamples: string[]): boolean {
  const allContent = contentSamples.join(' ');
  return detectScript(allContent) !== 'latin';
}

/**
 * Build an off-screen HTML element with the meeting report, render via html2canvas,
 * then produce a multi-page PDF.
 */
export async function exportPDFViaHtml2Canvas(data: PDFExportData): Promise<void> {
  const {
    meetingId, summaries, actionItems, participants, transcripts, options, isManager, summaryRole, decisions, influence,
  } = data;

  // Build styled HTML
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed; left: -9999px; top: 0;
    width: 794px; /* A4 at 96 DPI */
    background: white;
    font-family: 'Noto Sans', 'Noto Sans Tamil', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Telugu', 'Noto Sans Kannada', 'Noto Sans Malayalam', Arial, sans-serif;
    color: #374151;
    padding: 40px;
    box-sizing: border-box;
    line-height: 1.6;
  `;

  let html = '';

  // Header
  html += `
    <div style="background: #2563EB; color: white; padding: 20px 24px; margin: -40px -40px 30px -40px; border-radius: 0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">MEETING REPORT</h1>
        </div>
        <div style="text-align: right; font-size: 11px; opacity: 0.9;">
          <div>Meeting ID: ${meetingId.slice(0, 8).toUpperCase()}</div>
          <div>Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div>Time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    </div>
  `;

  // Executive summary box
  html += `
    <div style="border: 2px solid #2563EB; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px;">
      <div style="font-size: 11px; font-weight: bold; color: #2563EB; margin-bottom: 6px;">EXECUTIVE SUMMARY</div>
      <div style="font-size: 11px;">This report contains ${transcripts.length} transcript entries, meeting summaries, ${actionItems.length} action items, and ${participants.length} participants.</div>
    </div>
  `;

  // Helper: render markdown-like content
  const renderContent = (content: string): string => {
    return content.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      // Bold markers
      const formatted = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      // Bullet points
      if (/^[\*\-•]\s+/.test(trimmed)) {
        const text = formatted.replace(/^[\*\-•]\s+/, '');
        return `<div style="display:flex;align-items:flex-start;margin-bottom:4px;"><span style="color:#2563EB;margin-right:8px;font-size:18px;line-height:1;">•</span><span style="flex:1;">${text}</span></div>`;
      }
      return `<p style="margin:0 0 6px 0;">${formatted}</p>`;
    }).join('');
  };

  // Section header helper
  const sectionHeader = (title: string): string => `
    <div style="background:#F3F4F6;padding:6px 12px;border-radius:4px;margin-bottom:12px;margin-top:20px;">
      <span style="font-size:12px;font-weight:bold;color:#374151;letter-spacing:1px;">${title.toUpperCase()}</span>
    </div>
  `;

  // General Summary
  if (options.includeGeneralSummary && summaries['general']) {
    html += sectionHeader('General Summary');
    html += `<div style="font-size:11px;padding:0 8px;">${renderContent(summaries['general'])}</div>`;
  }

  // Role Summaries
  if (options.includeRoleSummaries) {
    const roleSummaries = Object.entries(summaries).filter(([role]) => role !== 'general');
    if (roleSummaries.length > 0) {
      html += sectionHeader('Role-Based Summaries');
      roleSummaries.forEach(([role, content]) => {
        html += `
          <div style="margin-bottom:16px;padding:0 8px;">
            <span style="display:inline-block;background:#2563EB;color:white;padding:2px 8px;border-radius:3px;font-size:8px;font-weight:bold;margin-bottom:8px;letter-spacing:0.5px;">${role.toUpperCase()}</span>
            <div style="font-size:11px;margin-top:6px;">${renderContent(content)}</div>
          </div>
        `;
      });
    }
  }

  // Participants
  if (options.includeParticipants && participants.length > 0) {
    html += sectionHeader('Participants');
    html += `<table style="width:100%;border-collapse:collapse;font-size:10px;">`;
    html += `<thead><tr style="background:#374151;color:white;">
      <th style="padding:6px 10px;text-align:left;">NAME</th>
      <th style="padding:6px 10px;text-align:left;">ROLE</th>
      ${isManager ? '<th style="padding:6px 10px;text-align:left;">ENGAGEMENT</th>' : ''}
    </tr></thead><tbody>`;
    participants.forEach((p, i) => {
      const bg = i % 2 === 0 ? '#F3F4F6' : 'white';
      const score = p.engagement_score || 0;
      const scoreColor = score >= 70 ? '#10B981' : score >= 40 ? '#FBBf24' : '#EF4444';
      html += `<tr style="background:${bg};">
        <td style="padding:5px 10px;">${p.name}</td>
        <td style="padding:5px 10px;">${p.role.charAt(0).toUpperCase() + p.role.slice(1)}</td>
        ${isManager ? `<td style="padding:5px 10px;"><span style="color:${scoreColor};font-weight:bold;">${score}%</span>
          <div style="background:#DDD;height:4px;width:50px;border-radius:2px;display:inline-block;vertical-align:middle;margin-left:6px;">
            <div style="background:${scoreColor};height:4px;width:${score * 0.5}px;border-radius:2px;"></div>
          </div></td>` : ''}
      </tr>`;
    });
    html += `</tbody></table>`;
  }

  // Action Items
  if (options.includeActionItems && actionItems.length > 0) {
    html += sectionHeader('Action Items');
    actionItems.forEach((item, index) => {
      const priorityColors: Record<string, string> = { high: '#EF4444', medium: '#FBBf24', low: '#10B981' };
      const pColor = priorityColors[item.priority?.toLowerCase() || 'medium'] || '#FBBf24';
      const statusColor = item.status === 'completed' ? '#10B981' : '#6B7280';
      html += `
        <div style="border:1px solid #DDD;border-radius:6px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px;">
          <div style="background:#2563EB;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;flex-shrink:0;">${index + 1}</div>
          <div style="flex:1;">
            <div style="font-size:11px;font-weight:bold;margin-bottom:4px;">${item.task}</div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <span style="background:${pColor};color:white;padding:1px 6px;border-radius:3px;font-size:7px;font-weight:bold;">${(item.priority || 'MEDIUM').toUpperCase()}</span>
              <span style="background:${statusColor};color:white;padding:1px 6px;border-radius:3px;font-size:7px;font-weight:bold;">${(item.status || 'PENDING').toUpperCase()}</span>
              ${item.assignee ? `<span style="font-size:9px;color:#6B7280;">Assigned to: ${item.assignee}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    });
  }

  // Decisions, Pending & Blockers
  if (options.includeDecisions && decisions) {
    const hasContent = (decisions.decisions?.length > 0) || (decisions.pending?.length > 0) || (decisions.blockers?.length > 0);
    if (hasContent) {
      html += sectionHeader('Decisions & Commitments');

      // Decisions (green)
      if (decisions.decisions?.length > 0) {
        html += `<div style="margin-bottom:12px;padding:0 8px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#10B981;"></span>
            <span style="font-size:11px;font-weight:bold;color:#10B981;">DECISIONS (${decisions.decisions.length})</span>
          </div>`;
        decisions.decisions.forEach(d => {
          html += `<div style="border-left:3px solid #10B981;padding:6px 12px;margin-bottom:6px;background:#ECFDF5;border-radius:0 4px 4px 0;">
            <div style="font-size:11px;font-weight:bold;color:#065F46;">✅ ${d.text}</div>
            ${d.speaker ? `<div style="font-size:9px;color:#6B7280;margin-top:2px;">Speaker: ${d.speaker}</div>` : ''}
          </div>`;
        });
        html += `</div>`;
      }

      // Pending (yellow/amber)
      if (decisions.pending?.length > 0) {
        html += `<div style="margin-bottom:12px;padding:0 8px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#F59E0B;"></span>
            <span style="font-size:11px;font-weight:bold;color:#F59E0B;">PENDING (${decisions.pending.length})</span>
          </div>`;
        decisions.pending.forEach(p => {
          html += `<div style="border-left:3px solid #F59E0B;padding:6px 12px;margin-bottom:6px;background:#FFFBEB;border-radius:0 4px 4px 0;">
            <div style="font-size:11px;font-weight:bold;color:#92400E;">⏳ ${p.text}</div>
            ${p.reason ? `<div style="font-size:9px;color:#6B7280;margin-top:2px;">Reason: ${p.reason}</div>` : ''}
          </div>`;
        });
        html += `</div>`;
      }

      // Blockers (red)
      if (decisions.blockers?.length > 0) {
        html += `<div style="margin-bottom:12px;padding:0 8px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#EF4444;"></span>
            <span style="font-size:11px;font-weight:bold;color:#EF4444;">BLOCKERS (${decisions.blockers.length})</span>
          </div>`;
        decisions.blockers.forEach(b => {
          html += `<div style="border-left:3px solid #EF4444;padding:6px 12px;margin-bottom:6px;background:#FEF2F2;border-radius:0 4px 4px 0;">
            <div style="font-size:11px;font-weight:bold;color:#991B1B;">🚫 ${b.text}</div>
            ${b.impact ? `<div style="font-size:9px;color:#6B7280;margin-top:2px;">Impact: ${b.impact}</div>` : ''}
          </div>`;
        });
        html += `</div>`;
      }
    }
  }

  // Speaker Influence Section
  if (options.includeInfluence && influence && influence.speakers?.length > 0) {
    html += sectionHeader('Speaker Influence Analysis');
    
    // Summary badges
    html += `<div style="display:flex;gap:8px;margin-bottom:12px;padding:0 8px;flex-wrap:wrap;">
      <span style="background:#F59E0B20;color:#D97706;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:bold;">👑 Leader: ${influence.meeting_leader}</span>
      <span style="background:${influence.participation_balance === 'balanced' ? '#10B98120' : influence.participation_balance === 'moderate' ? '#F59E0B20' : '#EF444420'};color:${influence.participation_balance === 'balanced' ? '#059669' : influence.participation_balance === 'moderate' ? '#D97706' : '#DC2626'};padding:3px 10px;border-radius:12px;font-size:10px;font-weight:bold;">${influence.participation_balance === 'balanced' ? 'Well Balanced' : influence.participation_balance === 'moderate' ? 'Moderately Balanced' : 'One-Sided'}</span>
    </div>`;

    // Speaker cards
    const sorted = [...influence.speakers].sort((a, b) => b.influence_score - a.influence_score);
    sorted.forEach(speaker => {
      const roleColor = speaker.role_alignment === 'Leader' ? '#D97706' : speaker.role_alignment === 'Contributor' ? '#2563EB' : '#6B7280';
      const roleBg = speaker.role_alignment === 'Leader' ? '#FEF3C7' : speaker.role_alignment === 'Contributor' ? '#DBEAFE' : '#F3F4F6';
      html += `
        <div style="border:1px solid #E5E7EB;border-radius:6px;padding:10px 14px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:12px;font-weight:bold;color:#374151;">${speaker.name}</span>
              <span style="background:${roleBg};color:${roleColor};padding:1px 8px;border-radius:10px;font-size:8px;font-weight:bold;">${speaker.role_alignment}</span>
            </div>
            <span style="font-size:16px;font-weight:bold;color:${roleColor};">${Math.round(speaker.influence_score)}</span>
          </div>
          <div style="background:#E5E7EB;height:4px;border-radius:2px;margin-bottom:8px;">
            <div style="background:${roleColor};height:4px;border-radius:2px;width:${speaker.influence_score}%;"></div>
          </div>
          <div style="display:flex;gap:16px;font-size:9px;color:#6B7280;margin-bottom:4px;">
            <span><strong>${Math.round(speaker.talk_time_percent)}%</strong> Talk Time</span>
            <span><strong>${speaker.decision_words}</strong> Decisions</span>
            <span><strong>${speaker.question_count}</strong> Questions</span>
          </div>
          <div style="font-size:9px;color:#6B7280;font-style:italic;">${speaker.key_contributions}</div>
        </div>`;
    });
  }
  // ACCOUNTABILITY SECTION
  if (data.options.includeAccountability && data.accountability && data.accountability.tasks?.length > 0) {
    html += `<div style="margin-top:20px;">
      <div style="background:#F3F4F6;padding:5px 10px;border-radius:4px;margin-bottom:10px;">
        <span style="font-size:12px;font-weight:bold;color:#374151;">🛡️ TASK OWNERSHIP & ACCOUNTABILITY</span>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div style="flex:1;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:9px;color:#6B7280;">Avg Score</div>
          <div style="font-size:18px;font-weight:bold;color:${data.accountability.average_score >= 70 ? '#10B981' : data.accountability.average_score >= 50 ? '#F59E0B' : '#EF4444'};">${data.accountability.average_score}%</div>
        </div>
        <div style="flex:1;background:${data.accountability.unassigned_count > 0 ? '#FEF2F2' : '#F0FDF4'};border:1px solid ${data.accountability.unassigned_count > 0 ? '#FECACA' : '#BBF7D0'};border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:9px;color:#6B7280;">Unassigned Tasks</div>
          <div style="font-size:18px;font-weight:bold;color:${data.accountability.unassigned_count > 0 ? '#EF4444' : '#10B981'};">${data.accountability.unassigned_count}</div>
        </div>
      </div>`;
    if (data.accountability.risk_summary) {
      html += `<div style="background:#FFFBEB;border-left:3px solid #F59E0B;padding:6px 10px;margin-bottom:10px;border-radius:0 4px 4px 0;">
        <span style="font-size:8px;font-weight:bold;color:#92400E;">⚠️ RISK ASSESSMENT:</span>
        <span style="font-size:9px;color:#374151;"> ${data.accountability.risk_summary}</span>
      </div>`;
    }
    data.accountability.tasks.forEach(task => {
      const clarityColor = task.ownership_clarity === 'clear' ? '#10B981' : task.ownership_clarity === 'ambiguous' ? '#F59E0B' : '#EF4444';
      const scoreColor = task.accountability_score >= 80 ? '#10B981' : task.accountability_score >= 50 ? '#F59E0B' : '#EF4444';
      html += `<div style="border:1px solid #E5E7EB;border-radius:6px;padding:8px;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:10px;font-weight:bold;color:#374151;">${task.task}</span>
          <span style="font-size:12px;font-weight:bold;color:${scoreColor};">${task.accountability_score}%</span>
        </div>
        <div style="display:flex;gap:8px;font-size:8px;align-items:center;">
          <span style="background:${clarityColor};color:white;padding:1px 6px;border-radius:8px;">${task.ownership_clarity}</span>
          ${task.owner ? `<span style="color:#6B7280;">👤 ${task.owner}</span>` : ''}
          ${task.deadline ? `<span style="color:#6B7280;">📅 ${task.deadline}</span>` : ''}
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  html += `
    <div style="margin-top:30px;border-top:1px solid #6B7280;padding-top:8px;display:flex;justify-content:space-between;font-size:8px;color:#6B7280;">
      <span>Generated by AI Meeting Assistant</span>
      <span>Confidential</span>
    </div>
  `;

  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 4, // Higher scale for better quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      imageTimeout: 0,
      allowTaint: false,
    });

    // Use higher quality JPEG for smaller file size with good quality
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });
    
    const pdfWidth = 210;
    const pdfHeight = 297;
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;
    }

    pdf.save(`meeting-report-${meetingId.slice(0, 8)}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
