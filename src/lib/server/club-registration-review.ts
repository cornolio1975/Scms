import nodemailer from 'nodemailer';
import type { SupabaseClient } from '@supabase/supabase-js';

const sender = 'noreply_scms@spaportdatasolution.org';
const loginUrl = 'https://scms.spsportdatasolution.org/login';
const forgotPasswordUrl = 'https://scms.spsportdatasolution.org/forgot-password';

export async function reviewClubRegistration(
  supabaseAdmin: SupabaseClient,
  requestId: string,
  reviewerId: string,
  action: 'APPROVE' | 'REJECT' | 'SEND_EMAIL',
): Promise<{ success: true; emailSent: boolean } | { error: string; status: number }> {
  const { data: result, error: reviewError } = await supabaseAdmin.rpc('review_club_registration', {
    registration_id: requestId,
    reviewer_id: reviewerId,
    decision: action,
  });
  if (reviewError) throw reviewError;
  if (result === 'FORBIDDEN') {
    return { error: 'You do not have permission to review this registration.', status: 403 };
  }
  if (result === 'NOT_FOUND') {
    return { error: 'Registration not found.', status: 404 };
  }
  if (result === 'CONFLICT') {
    return { error: 'This registration is no longer eligible for this action.', status: 409 };
  }
  if (result === 'REJECTED' || result === 'SENT') {
    return { success: true, emailSent: result === 'SENT' };
  }
  if (result !== 'PENDING') throw new Error('Unexpected registration review result.');

  const smtpPassword = process.env.SCMS_SMTP_PASSWORD;
  const smtpPort = Number(process.env.SCMS_SMTP_PORT || 465);
  if (!smtpPassword || ![465, 587].includes(smtpPort)) {
    console.error('Club approval SMTP is not configured.');
    return { success: true, emailSent: false };
  }

  const claimedAt = new Date().toISOString();
  const expiredClaim = new Date(Date.now() - 120_000).toISOString();

  let recipientId: string;
  try {
    const { data: registration, error } = await supabaseAdmin
      .from('approval_requests')
      .update({ approval_email_claimed_at: claimedAt })
      .eq('id', requestId)
      .eq('approval_email_status', 'PENDING')
      .or(`approval_email_claimed_at.is.null,approval_email_claimed_at.lt.${expiredClaim}`)
      .select('user_id').maybeSingle();
    if (error) throw error;
    if (!registration) return { success: true, emailSent: false };
    recipientId = registration.user_id;
  } catch {
    console.error('Unable to claim club approval email:', requestId);
    return { success: true, emailSent: false };
  }

  try {
    const { data: account, error: accountError } = await supabaseAdmin.auth.admin.getUserById(recipientId);
    if (accountError || !account.user?.email) throw new Error('Registration account has no email address.');

    const mailer = nodemailer.createTransport({
      host: process.env.SCMS_SMTP_HOST || 'smtp.hostinger.com',
      port: smtpPort,
      secure: smtpPort === 465,
      requireTLS: true,
      auth: { user: sender, pass: smtpPassword },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    const delivery = await mailer.sendMail({
      from: { name: 'SCMS', address: sender },
      to: account.user.email,
      messageId: `<club-approval-${requestId}@spaportdatasolution.org>`,
      subject: 'Your SCMS club registration has been approved',
      text: [
        'Your club registration has been approved. Your SCMS club administrator account is ready.',
        `Sign in with your registered email and password: ${loginUrl}`,
        `If you did not choose a password or need a new one, use Forgot Password: ${forgotPasswordUrl}`,
      ].join('\n\n'),
    });
    if (!delivery.accepted.length) throw new Error('SMTP did not accept the approval email.');
  } catch (error) {
    console.error('Club approval email pending:', requestId, error instanceof Error && 'code' in error ? error.code : 'Delivery failed');
    const { error: releaseError } = await supabaseAdmin.from('approval_requests')
      .update({ approval_email_claimed_at: null }).eq('id', requestId)
      .eq('approval_email_claimed_at', claimedAt);
    if (releaseError) console.error('Unable to release club approval email claim:', requestId, releaseError.code);
    return { success: true, emailSent: false };
  }

  const { error: markError } = await supabaseAdmin.from('approval_requests')
    .update({ approval_email_status: 'SENT', approval_email_claimed_at: null }).eq('id', requestId)
    .eq('approval_email_claimed_at', claimedAt);
  if (markError) {
    console.error('Unable to record club approval email delivery:', requestId, markError.code);
    return { success: true, emailSent: false };
  }
  return { success: true, emailSent: true };
}
