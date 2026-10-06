import https from 'https';

function fetchUrl(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function verify() {
  console.log('Testing live Vercel deployment...');
  try {
    const mosques = await fetchUrl('https://friday-preachers-scheduler.vercel.app/api/mosques');
    if (Array.isArray(mosques)) {
      console.log(`Live Vercel Mosques Count: ${mosques.length}`);
      const m12 = mosques.find((m: any) => m.code === 'MSQ-12' || m.name?.includes('الحرمين'));
      console.log('Al-Haramain mosque live data:', m12);
    } else {
      console.log('Response:', mosques);
    }

    const imams = await fetchUrl('https://friday-preachers-scheduler.vercel.app/api/imams');
    if (Array.isArray(imams)) {
      console.log(`Live Vercel Imams Count: ${imams.length}`);
      console.log('First 3 imams:', imams.slice(0, 3).map((i: any) => ({ id: i.id, name: i.name, type: i.type })));
    }
  } catch (err: any) {
    console.error('Error fetching live vercel:', err.message);
  }
}

verify();
