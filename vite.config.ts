import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// بنقرا عنوان Supabase ومفتاحه العام من نفس أسماء المتغيرات اللي البرنامج القديم كان بيستخدمها على Vercel.
// ممنوع نقرا SUPABASE_SERVICE_ROLE_KEY هنا: المفتاح ده سري وما ينفعش يوصل للمتصفح.
function supabaseEnv(mode: string) {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env } as Record<string, string | undefined>;
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key =
    env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  return { url, key };
}

export default defineConfig(({ mode }) => {
  const sb = supabaseEnv(mode);
  return {
  define: {
    __SUPABASE_URL__: JSON.stringify(sb.url),
    __SUPABASE_KEY__: JSON.stringify(sb.key),
  },
  plugins: [react(), tailwindcss()],
  server: { port: 3000, host: '0.0.0.0' },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/xlsx')) return 'xlsx';
          if (id.includes('node_modules/@supabase')) return 'supabase';
          if (id.includes('node_modules/react')) return 'react';
        },
      },
    },
  },
};
});
