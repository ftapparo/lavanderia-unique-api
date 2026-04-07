import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';

const LOGO_PATH = path.resolve(__dirname, '../../../FRONT/public/logo_unique.png');
const logoAttachment = fs.existsSync(LOGO_PATH)
  ? [{ filename: 'logo_unique.png', path: LOGO_PATH, cid: 'logo_unique' }]
  : [];

const hasEmailConfiguration = (): boolean => {
  return Boolean(process.env.EMAIL_HOST && process.env.EMAIL_PORT && process.env.EMAIL_USER && process.env.EMAIL_PASS);
};

const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: String(process.env.EMAIL_PORT) === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

const appUrl = (): string => process.env.APP_URL || '';

export const notificationEmailService = {
  isConfigured(): boolean {
    return hasEmailConfiguration();
  },

  async sendWelcomeEmail(user: { name: string; email: string }, pin: string): Promise<void> {
    if (!hasEmailConfiguration()) return;

    const transporter = createTransporter();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: 'Bem-vindo à Lavanderia Unique — seu PIN de acesso',
      attachments: logoAttachment,
      html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f8; margin:0; padding:0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb;">
          <!-- Header -->
          <tr>
            <td style="background-color:#111827; padding:24px 32px; text-align:center;">
              <img src="cid:logo_unique" alt="Logo Lavanderia Unique" style="height:48px; display:inline-block; vertical-align:middle; margin-right:12px;" />
              <div style="display:inline-block; vertical-align:middle; text-align:left;">
                <div style="font-size:22px; font-weight:bold; color:#ffffff; line-height:1.2;">Lavanderia Unique</div>
                <div style="font-size:13px; color:#d1d5db; margin-top:6px;">Sua conta foi criada com sucesso</div>
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 24px 32px;">
              <div style="font-size:24px; font-weight:bold; color:#111827; margin-bottom:16px;">Bem-vindo ao sistema</div>
              <div style="font-size:15px; line-height:1.7; color:#374151; margin-bottom:18px;">
                Olá, <strong>${user.name}</strong>,
              </div>
              <div style="font-size:15px; line-height:1.7; color:#374151; margin-bottom:24px;">
                Sua conta foi criada e já está pronta para uso.
                Utilize o PIN temporário abaixo para fazer seu primeiro acesso ao sistema.
              </div>
              <!-- PIN Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center" style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:14px; padding:24px;">
                    <div style="font-size:13px; color:#6b7280; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Seu PIN de acesso</div>
                    <div style="font-size:40px; line-height:1; font-weight:bold; letter-spacing:8px; color:#0058b1;">${pin}</div>
                  </td>
                </tr>
              </table>
              <!-- Info -->
              <div style="font-size:15px; line-height:1.7; color:#374151; margin-bottom:14px;">
                Ao entrar com o PIN, você será solicitado(a) a criar uma senha pessoal para os próximos acessos.
              </div>
              <!-- Security box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px; margin-bottom:24px;">
                <tr>
                  <td style="background-color:#fff7ed; border:1px solid #fdba74; border-radius:12px; padding:16px 18px;">
                    <div style="font-size:14px; font-weight:bold; color:#9a3412; margin-bottom:8px;">Aviso de segurança</div>
                    <div style="font-size:14px; line-height:1.6; color:#7c2d12;">
                      Não compartilhe este PIN com ninguém.
                      Se você não esperava este e-mail, entre em contato com a administração.
                    </div>
                  </td>
                </tr>
              </table>
              <div style="font-size:14px; line-height:1.7; color:#6b7280;">
                Em caso de dúvidas, entre em contato com a administração ou suporte responsável pelo sistema.
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; background-color:#f9fafb; border-top:1px solid #e5e7eb;">
              <div style="font-size:12px; line-height:1.6; color:#9ca3af; text-align:center;">Este é um e-mail automático. Por favor, não responda esta mensagem.</div>
              <div style="font-size:12px; line-height:1.6; color:#9ca3af; text-align:center; margin-top:4px;">© 2026 Lavanderia Unique. Todos os direitos reservados.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
  },

  async sendPasswordResetEmail(user: { name: string; email: string }, pin: string): Promise<void> {
    if (!hasEmailConfiguration()) return;

    const transporter = createTransporter();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: 'Redefinição de acesso — Lavanderia Unique',
      attachments: logoAttachment,
      html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redefinição de acesso</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f8; margin:0; padding:0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb;">
          <!-- Header -->
          <tr>
            <td style="background-color:#0058b1; padding:24px 32px; text-align:center;">
              <img src="cid:logo_unique" alt="Logo Lavanderia Unique" style="height:48px; display:inline-block; vertical-align:middle; margin-right:12px;" />
              <div style="display:inline-block; vertical-align:middle; text-align:left;">
                <div style="font-size:22px; font-weight:bold; color:#ffffff; line-height:1.2;">Lavanderia Unique</div>
                <div style="font-size:13px; color:#d1d5db; margin-top:6px;">Redefinição segura de acesso</div>
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 24px 32px;">
              <div style="font-size:24px; font-weight:bold; color:#111827; margin-bottom:16px;">Redefinição de acesso solicitada</div>
              <div style="font-size:15px; line-height:1.7; color:#374151; margin-bottom:18px;">
                Olá, <strong>${user.name}</strong>,
              </div>
              <div style="font-size:15px; line-height:1.7; color:#374151; margin-bottom:24px;">
                Recebemos uma solicitação de redefinição de acesso para sua conta.
                Utilize o PIN temporário abaixo para entrar no sistema.
              </div>
              <!-- PIN Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center" style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:14px; padding:24px;">
                    <div style="font-size:13px; color:#6b7280; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Seu PIN temporário</div>
                    <div style="font-size:40px; line-height:1; font-weight:bold; letter-spacing:8px; color:#111827;">${pin}</div>
                  </td>
                </tr>
              </table>
              <!-- Info -->
              <div style="font-size:15px; line-height:1.7; color:#374151; margin-bottom:14px;">
                Você poderá continuar usando sua senha atual, caso ainda se lembre dela.
                Este PIN será descartado automaticamente após o uso ou expiração.
              </div>
              <!-- Security box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px; margin-bottom:24px;">
                <tr>
                  <td style="background-color:#fff7ed; border:1px solid #fdba74; border-radius:12px; padding:16px 18px;">
                    <div style="font-size:14px; font-weight:bold; color:#9a3412; margin-bottom:8px;">Aviso de segurança</div>
                    <div style="font-size:14px; line-height:1.6; color:#7c2d12;">
                      Se você não solicitou esta redefinição, ignore este e-mail.
                      Nenhuma alteração permanente será feita sem sua ação.
                    </div>
                  </td>
                </tr>
              </table>
              <div style="font-size:14px; line-height:1.7; color:#6b7280;">
                Em caso de dúvidas, entre em contato com a administração ou suporte responsável pelo sistema.
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; background-color:#f9fafb; border-top:1px solid #e5e7eb;">
              <div style="font-size:12px; line-height:1.6; color:#9ca3af; text-align:center;">Este é um e-mail automático. Por favor, não responda esta mensagem.</div>
              <div style="font-size:12px; line-height:1.6; color:#9ca3af; text-align:center; margin-top:4px;">© 2026 Lavanderia Unique. Todos os direitos reservados.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
  },

  async sendBillingReport(input: {
    to: string;
    competence: string;
    csvContent: string;
    xlsxContentBase64: string;
  }): Promise<void> {
    if (!hasEmailConfiguration()) {
      return;
    }

    const transporter = createTransporter();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: input.to,
      subject: `Lavanderia Unique - Faturamento ${input.competence}`,
      text: `Segue fechamento de faturamento da competencia ${input.competence}.`,
      attachments: [
        {
          filename: `billing-${input.competence}.csv`,
          content: input.csvContent,
          contentType: 'text/csv; charset=utf-8',
        },
        {
          filename: `billing-${input.competence}.xlsx`,
          content: Buffer.from(input.xlsxContentBase64, 'base64'),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    });
  },
};
