/**
 * Script de emergência: redefine a senha do usuário SUPER para "102030".
 *
 * Uso:
 *   node scripts/reset-super-password.mjs
 *
 * Variáveis de ambiente (lidas do .env ou do ambiente):
 *   DATABASE_URL  — ex: postgres://user:pass@host:5432/db
 *
 * O script imprime o SQL gerado antes de executar. Ctrl+C cancela.
 */

import { createHash, pbkdf2Sync } from 'crypto';
import { createInterface } from 'readline';

// ── Mesma lógica de hashPassword da API ───────────────────────────────────────
function hashPassword(password) {
  const ITERATIONS = 120000;
  const KEY_LENGTH = 64;
  const DIGEST = 'sha512';
  const salt = createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${ITERATIONS}:${salt}:${hash}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const PASSWORD = '102030';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Erro: DATABASE_URL não definida.');
  process.exit(1);
}

const passwordHash = hashPassword(PASSWORD);

const sql = `
UPDATE users
SET    password_hash       = '${passwordHash}',
       must_change_password = false,
       updated_at           = NOW()
WHERE  role = 'SUPER'
RETURNING id, name, email, role;
`.trim();

console.log('\n=== SQL que será executado ===');
console.log(sql);
console.log('==============================\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question('Confirmar? (s/N): ', async (answer) => {
  rl.close();
  if (answer.trim().toLowerCase() !== 's') {
    console.log('Cancelado.');
    process.exit(0);
  }

  // Importação dinâmica de pg (deve estar instalado como dep da API)
  let pg;
  try {
    pg = await import('pg');
  } catch {
    console.error('Erro: pacote "pg" não encontrado. Execute: npm install pg');
    process.exit(1);
  }

  const client = new pg.default.Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(sql);
    if (result.rows.length === 0) {
      console.log('Nenhum usuário SUPER encontrado.');
    } else {
      console.log('\nSenha redefinida com sucesso:');
      for (const row of result.rows) {
        console.log(`  • ${row.name} (${row.email}) — role: ${row.role}`);
      }
      console.log(`\nNova senha: ${PASSWORD}`);
      console.log('must_change_password = false\n');
    }
  } catch (err) {
    console.error('Erro ao executar SQL:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
});
