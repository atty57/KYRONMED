/**
 * Notification service — email (Nodemailer/Gmail) and SMS (stub).
 * Both gracefully degrade if credentials aren't configured.
 *
 * Gmail setup:
 *  1. Enable 2FA on the Gmail account.
 *  2. Go to Google Account → Security → App Passwords → generate one for "Mail".
 *  3. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env
 */

import nodemailer from 'nodemailer';

// ─── Nodemailer transporter singleton ─────────────────────────────
let transporter = null;

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
    console.log('📧 Nodemailer Gmail transporter initialized');
  }
  return transporter;
}

// ─── Date / time formatting ───────────────────────────────────────
function formatEmailDate(dateStr) {
  if (!dateStr) return dateStr;
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatEmailTime(timeStr) {
  if (!timeStr) return timeStr;
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch {
    return timeStr;
  }
}

// ─── Assessment HTML block ────────────────────────────────────────
function buildAssessmentHtml(assessment) {
  if (!assessment) return '';

  const rows = [];
  if (assessment.chiefComplaint) rows.push(['Reason for Visit', assessment.chiefComplaint]);
  if (assessment.location) rows.push(['Location', assessment.location]);
  if (assessment.severity) rows.push(['Severity', `${assessment.severity}/10`]);
  if (assessment.duration) rows.push(['Duration', assessment.duration]);
  if (assessment.onset) rows.push(['Onset', assessment.onset]);
  if (assessment.aggravatingFactors) rows.push(['Worsened by', assessment.aggravatingFactors]);
  if (assessment.relievingFactors) rows.push(['Relieved by', assessment.relievingFactors]);
  if (assessment.additionalSymptoms) rows.push(['Other Symptoms', assessment.additionalSymptoms]);

  if (rows.length === 0 && !assessment.summary) return '';

  const tableRows = rows.map(([label, value]) =>
    `<tr>
      <td style="padding: 6px 12px 6px 0; color: #718096; font-size: 13px; vertical-align: top; width: 130px;">${label}</td>
      <td style="padding: 6px 0; color: #1a202c; font-size: 13px;">${value}</td>
    </tr>`
  ).join('');

  return `
    <div style="background: #F0FFF4; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #38A169;">
      <p style="color: #276749; font-weight: 600; margin: 0 0 10px; font-size: 14px;">Pre-Visit Assessment Summary</p>
      ${assessment.summary ? `<p style="color: #2D3748; font-size: 13px; margin: 0 0 12px; line-height: 1.5; font-style: italic;">"${assessment.summary}"</p>` : ''}
      ${tableRows ? `<table style="width: 100%; border-collapse: collapse;">${tableRows}</table>` : ''}
      <p style="color: #A0AEC0; font-size: 11px; margin: 10px 0 0;">This summary was gathered during your intake and will be shared with your provider to help prepare for your visit.</p>
    </div>
  `;
}

// ─── Build full email HTML ────────────────────────────────────────
function buildConfirmationHtml({ patientName, doctorName, specialty, date, time, location, practicePhone, symptomAssessment }) {
  const prettyDate = formatEmailDate(date);
  const prettyTime = formatEmailTime(time);
  const assessmentBlock = buildAssessmentHtml(symptomAssessment);

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0066CC 0%, #0088FF 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: -0.5px;">KyronMed</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0; font-size: 14px;">Appointment Confirmation</p>
      </div>
      <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
        <p style="font-size: 16px; color: #1a202c; margin: 0 0 8px;">Hi ${patientName},</p>
        <p style="color: #4a5568; margin: 0 0 20px; line-height: 1.5;">Your appointment has been confirmed. Here are the details:</p>

        <div style="background: white; border-radius: 8px; padding: 20px; margin: 0 0 16px; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #718096; width: 110px; font-size: 14px;">Doctor</td>
              <td style="padding: 8px 0; color: #1a202c; font-weight: 600; font-size: 14px;">${doctorName}${specialty ? ` — ${specialty}` : ''}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #718096; font-size: 14px;">Date</td>
              <td style="padding: 8px 0; color: #1a202c; font-weight: 600; font-size: 14px;">${prettyDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #718096; font-size: 14px;">Time</td>
              <td style="padding: 8px 0; color: #1a202c; font-weight: 600; font-size: 14px;">${prettyTime}</td>
            </tr>
            ${location ? `<tr>
              <td style="padding: 8px 0; color: #718096; font-size: 14px;">Location</td>
              <td style="padding: 8px 0; color: #1a202c; font-size: 14px;">${location}</td>
            </tr>` : ''}
          </table>
        </div>

        ${assessmentBlock}

        <div style="background: #EBF5FF; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #0066CC;">
          <p style="color: #1a202c; font-weight: 600; margin: 0 0 8px; font-size: 14px;">Before your visit, please bring:</p>
          <ul style="color: #4a5568; margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.8;">
            <li>Photo ID (driver's license or passport)</li>
            <li>Insurance card(s)</li>
            <li>List of current medications</li>
            <li>Any relevant medical records or referral letters</li>
          </ul>
          <p style="color: #4a5568; margin: 10px 0 0; font-size: 13px;">Please arrive <strong>15 minutes early</strong> to complete check-in.</p>
        </div>

        <p style="color: #4a5568; font-size: 13px; line-height: 1.5;">Need to reschedule or cancel? Please give us at least 24 hours notice.${practicePhone ? ` Call us at <strong>${practicePhone}</strong> or use the KyronMed chat assistant.` : ''}</p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;">
        <p style="color: #a0aec0; font-size: 11px; text-align: center; margin: 0;">KyronMed Physician Group &middot; Comprehensive Care, Powered by Technology</p>
      </div>
    </div>
  `;
}

// ─── Send confirmation email ──────────────────────────────────────
export async function sendConfirmationEmail({ to, patientName, doctorName, specialty, date, time, location, practicePhone, symptomAssessment }) {
  const transport = getTransporter();

  const html = buildConfirmationHtml({ patientName, doctorName, specialty, date, time, location, practicePhone, symptomAssessment });
  const prettyDate = formatEmailDate(date);
  const subject = `Appointment Confirmed — ${doctorName} on ${prettyDate}`;

  if (!transport) {
    console.log('📧 [MOCK EMAIL — set GMAIL_USER and GMAIL_APP_PASSWORD to send real emails]');
    console.log(`   To: ${to}  |  Subject: ${subject}`);
    if (symptomAssessment?.summary) console.log(`   Assessment: ${symptomAssessment.summary}`);
    return { success: true, mock: true };
  }

  const fromEmail = process.env.GMAIL_USER;

  try {
    console.log(`📧 Sending confirmation email to ${to}...`);

    const info = await transport.sendMail({
      from: `KyronMed <${fromEmail}>`,
      to,
      subject,
      html,
    });

    console.log(`📧 ✅ Email sent successfully! Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('📧 ❌ Email send error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Send SMS confirmation (stub — no SMS provider configured) ───
export async function sendConfirmationSMS({ to, patientName, doctorName, date, time }) {
  console.log('📱 [SMS DISABLED] Confirmation to:', to);
  console.log(`   ${patientName}: ${doctorName} on ${date} at ${time}`);
  return { success: true, mock: true };
}
