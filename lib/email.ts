import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const FROM = `"Polla Mundial 2026" <${process.env.GMAIL_USER}>`

export async function sendResetRequestNotification({
  adminEmails,
  requesterEmail,
  requesterName,
  message,
}: {
  adminEmails: string[]
  requesterEmail: string
  requesterName: string | null
  message: string
}) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return
  if (adminEmails.length === 0) return

  await transporter.sendMail({
    from: FROM,
    to: adminEmails.join(', '),
    subject: `Solicitud de recuperación de contraseña — ${requesterName ?? requesterEmail}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#c9a227">Polla Mundial 2026</h2>
        <p>Un usuario solicita recuperar su contraseña.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr>
            <td style="padding:8px;color:#888;width:120px">Nombre</td>
            <td style="padding:8px;font-weight:bold">${requesterName ?? '—'}</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#888">Email</td>
            <td style="padding:8px;font-weight:bold">${requesterEmail}</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#888;vertical-align:top">Mensaje</td>
            <td style="padding:8px;white-space:pre-wrap">${message}</td>
          </tr>
        </table>
        <p style="color:#888;font-size:12px">
          Revisa las solicitudes en <strong>/superadmin/reset-requests</strong>.
        </p>
      </div>
    `,
  })
}

export async function sendTempPassword({
  toEmail,
  toName,
  tempPassword,
}: {
  toEmail: string
  toName: string
  tempPassword: string
}) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: 'Tu contraseña ha sido restablecida — Polla Mundial 2026',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#c9a227">Polla Mundial 2026</h2>
        <p>Hola <strong>${toName}</strong>,</p>
        <p>El administrador restableció tu contraseña. Tu contraseña temporal es:</p>
        <div style="background:#1a1a2e;border:1px solid #c9a227;border-radius:8px;padding:16px;text-align:center;margin:16px 0">
          <span style="font-family:monospace;font-size:24px;font-weight:bold;color:#c9a227;letter-spacing:4px">${tempPassword}</span>
        </div>
        <p>Al iniciar sesión con esta contraseña, se te pedirá crear una nueva.</p>
        ${appUrl ? `<p><a href="${appUrl}/login" style="color:#c9a227">Ir al inicio de sesión →</a></p>` : ''}
        <p style="color:#888;font-size:12px">Si no solicitaste este cambio, ignora este mensaje.</p>
      </div>
    `,
  })
}
