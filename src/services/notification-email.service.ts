import nodemailer from 'nodemailer';

const hasEmailConfiguration = (): boolean => {
    return Boolean(process.env.EMAIL_HOST && process.env.EMAIL_PORT && process.env.EMAIL_USER && process.env.EMAIL_PASS);
};

export const notificationEmailService = {
    isConfigured(): boolean {
        return hasEmailConfiguration();
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

        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT),
            secure: String(process.env.EMAIL_PORT) === '465',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

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
