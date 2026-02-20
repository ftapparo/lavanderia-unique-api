import dotenv from 'dotenv';
import { StartWebServer } from './api/web-server.api';

const dotenvResult = dotenv.config();
if (dotenvResult.error) {
    console.error('[Server] Falha ao carregar .env:', dotenvResult.error);
} else {
    console.log('[Server] .env carregado com sucesso');
}

async function StartService(): Promise<void> {
    try {
        await StartWebServer();
        console.log('[Server] Servico web inicializado.');
    } catch (err) {
        console.error('[Server] Erro ao inicializar:', err);
        process.exit(1);
    }
}

void StartService();
