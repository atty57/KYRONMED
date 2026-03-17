import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Look for .env in server/ first, fall back to project root
dotenv.config({ path: path.join(__dirname, '.env') });
if (!process.env.GROQ_API_KEY) {
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
}

import app from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🏥 KyronMed server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
