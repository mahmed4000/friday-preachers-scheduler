import { useStore } from './data/store.tsx';
import { usePath } from './lib/router.ts';
import { Shell, Toasts } from './layout/Shell.tsx';
import { Setup } from './pages/Setup.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { SchedulePage } from './pages/Schedule.tsx';
import { MosquesPage } from './pages/Mosques.tsx';
import { PreachersPage } from './pages/Preachers.tsx';
import { MessagesPage } from './pages/Messages.tsx';
import { ReportPage } from './pages/Report.tsx';
import { SettingsPage } from './pages/Settings.tsx';
import { Star8 } from './ui/kit.tsx';

function Loading({ text = 'جاري تحميل البيانات…' }: { text?: string }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3 text-brown-700">
      <Star8 className="w-8 h-8 text-gold-500 animate-spin [animation-duration:3s]" />
      {text}
    </div>
  );
}

export default function App() {
  const { status, error, reload } = useStore();
  const path = usePath();

  if (status === 'loading') return <Loading />;
  if (status === 'setup') return <Setup />;
  if (status === 'error')
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <Star8 className="w-8 h-8 text-bad mx-auto" />
          <h1 className="text-2xl text-brown-900">تعذر الاتصال بقاعدة البيانات</h1>
          <p className="text-muted text-sm max-w-md">{error}</p>
          <button className="underline text-brown-700 cursor-pointer" onClick={() => reload()}>حاول تاني</button>
        </div>
      </div>
    );

  let page;
  if (path.startsWith('/schedule')) page = <SchedulePage />;
  else if (path.startsWith('/mosques')) page = <MosquesPage />;
  else if (path.startsWith('/preachers')) page = <PreachersPage />;
  else if (path.startsWith('/messages')) page = <MessagesPage />;
  else if (path.startsWith('/report')) page = <ReportPage />;
  else if (path.startsWith('/settings')) page = <SettingsPage />;
  else page = <Dashboard />;

  return (
    <>
      <Shell>{page}</Shell>
      <Toasts />
    </>
  );
}
