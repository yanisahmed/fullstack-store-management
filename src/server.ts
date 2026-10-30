import { app } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

connectDB()
  .then(() => app.listen(env.PORT, () => console.log(`API running on :${env.PORT}`)))
  .catch((e) => {
    console.error('Startup failed', e);
    process.exit(1);
  });
