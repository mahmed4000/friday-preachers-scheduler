async function checkStatus() {
  const res = await fetch('https://friday-preachers-scheduler.vercel.app/api/supabase/status');
  console.log('Status code:', res.status);
  const data = await res.json();
  console.log('Supabase status on Vercel:', data);
}

checkStatus();
