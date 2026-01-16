import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: 'legacy/fetch',
  input: 'https://cjdquick-api-vr4w.onrender.com/openapi.json',
  output: {
    path: './src/lib/api/generated',
    format: 'prettier',
  },
  services: {
    asClass: false, // Use functions instead of classes
  },
  types: {
    enums: 'javascript', // Generate JS enums
  },
});
