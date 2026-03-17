import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { sessionMiddleware } from './middleware/session.js';
import chatRouter from './routes/chat.js';
import bookingRouter from './routes/booking.js';
import vapiRouter from './routes/vapi.js';
import adminRouter from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// --------------- Middleware ---------------
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(sessionMiddleware);

// --------------- API Routes ---------------
app.use('/api/chat', chatRouter);
app.use('/api/booking', bookingRouter);
app.use('/api/vapi', vapiRouter);
app.use('/api/admin', adminRouter);

// --------------- Health Check ---------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'kyronmed', timestamp: new Date().toISOString() });
});

// --------------- Serve Frontend (production) ---------------
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

export default app;
