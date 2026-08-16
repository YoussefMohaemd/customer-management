import { startServer } from './server.js';
import { loadToken } from './upstream.js';

try {
  loadToken();
} catch (error) {
  console.error(`[bff] ${error.message}`);
  console.error('[bff] Starting anyway — upstream calls will fail until the token is configured.');
}

startServer();