ALTER TABLE job_configs
ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

UPDATE job_configs
SET description = CASE name
    WHEN 'no-show-detector' THEN 'Encerra automaticamente reservas sem check-in dentro da janela permitida.'
    WHEN 'reservation-end-handler' THEN 'Avalia sessoes que passaram do horario reservado e finaliza quando nao ha mais consumo relevante.'
    WHEN 'overtime-monitor' THEN 'Monitora sessoes em overtime para desligar maquinas e encerrar a sessao quando o consumo cair.'
    WHEN 'monthly-billing-generator' THEN 'Gera o faturamento mensal com base nas regras e consumos registrados no sistema.'
    ELSE description
END
WHERE name IN (
    'no-show-detector',
    'reservation-end-handler',
    'overtime-monitor',
    'monthly-billing-generator'
);