import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';

try {
  await connectDB();
  createApp().listen(env.port, () => {
    console.log(`✔ API escuchando en http://localhost:${env.port}`);
    console.log(`✔ Swagger UI en  http://localhost:${env.port}/api-docs`);
  });
} catch (err) {
  console.error('✖ No se pudo iniciar el servidor:', err.message);
  process.exit(1);
}
