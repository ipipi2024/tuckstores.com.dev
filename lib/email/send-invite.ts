import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'TuckStores <noreply@tuckstores.com>'

const ROLE_LABELS: Record<string, string> = {
  owner:           'Owner',
  admin:           'Admin',
  manager:         'Manager',
  cashier:         'Cashier',
  inventory_clerk: 'Inventory Clerk',
  staff:           'Staff',
}

export async function sendInviteEmail({
  to,
  businessName,
  role,
  inviteLink,
}: {
  to: string
  businessName: string
  role: string
  inviteLink: string
}) {
  const roleLabel = ROLE_LABELS[role] ?? role

  await resend.emails.send({
    from: FROM,
    to,
    subject: `You've been invited to join ${businessName} on TuckStores`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h1 style="font-size:20px;font-weight:700;margin-bottom:8px">You're invited!</h1>
        <p style="color:#555;margin-bottom:24px">
          You've been invited to join <strong>${businessName}</strong> as <strong>${roleLabel}</strong> on TuckStores.
        </p>
        <a href="${inviteLink}"
           style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
          Accept invitation
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">
          This link expires in 7 days and can only be used once. If you weren't expecting this, you can ignore this email.
        </p>
      </div>
    `,
  })
}
