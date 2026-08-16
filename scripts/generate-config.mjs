import fs from 'node:fs';
import path from 'node:path';

const configDir = path.join(process.cwd(), 'public', 'config');
const configFile = path.join(configDir, 'app-config.json');

const envToken =
  process.env.BFF_UPSTREAM_TOKEN ||
  process.env.AUTH_TOKEN ||
  process.env.CRM_JWT_TOKEN ||
  process.env.PUBLIC_AUTH_TOKEN ||
  '';

let existingToken = '';
if (fs.existsSync(configFile)) {
  try {
    const content = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    existingToken = content?.auth?.token ?? '';
  } catch {
    // Ignore read/parse error
  }
}

const finalToken = (envToken || existingToken).trim();

if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

const configData = {
  auth: {
    token: finalToken,
  },
  api: {
    bffBaseUrl: '',
  },
};

fs.writeFileSync(configFile, JSON.stringify(configData, null, 2), 'utf8');
console.log(`[generate-config] public/config/app-config.json generated (token present: ${Boolean(finalToken)})`);
