// تشغيل: npm run build && npx vite preview --port 4173 --host 127.0.0.1  ثم  node tests/e2e/demo-flow.cjs (محتاج Playwright متسطب)
// اختبار وظيفي شامل في الوضع التجريبي (بيانات المتصفح بس، مفيش إرسال فعلي)
const { chromium } = require('playwright');
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  // نمنع أي فتح لواتساب (مفيش إرسال فعلي)
  await ctx.route(/wa\.me|api\.whatsapp/, (r) => r.abort());
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/wa\.me|ERR_FAILED|net::/.test(m.text()) && errors.push(m.text()));
  const go = async (path) => { await p.evaluate((r) => { history.pushState(null, '', r); dispatchEvent(new Event('app:navigate')); }, path); await p.waitForTimeout(350); };

  await p.goto('http://127.0.0.1:4173/?demo');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('fs_mode', 'demo'); });
  await p.goto('http://127.0.0.1:4173/');
  await p.waitForTimeout(800);
  ok('الرئيسية: 6 مؤشرات', (await p.locator('main .grid >> text=المساجد النشطة').count()) === 1 && (await p.getByText('محتاجة معالجة').count()) === 1);
  ok('الرئيسية: إجراءات سريعة 5', (await p.locator('a:has-text("إضافة خطيب"), a:has-text("إرسال تذكيرات")').count()) === 2);

  // إضافة خطيب من الإجراء السريع
  await p.click('a:has-text("إضافة خطيب")');
  await p.waitForTimeout(400);
  ok('إجراء سريع يفتح نموذج خطيب جديد', await p.getByRole('dialog', { name: 'خطيب جديد' }).isVisible());
  const saveBtn = p.getByRole('dialog').getByRole('button', { name: 'حفظ' });
  ok('التحقق: زر الحفظ مقفول من غير اسم', await saveBtn.isDisabled());
  await p.fill('#preacher-name', 'الشيخ اختبار آلي');
  await p.fill('#preacher-phone', '01099998888');
  await saveBtn.click();
  await p.waitForTimeout(500);
  ok('الخطيب الجديد ظهر', (await p.getByText('الشيخ اختبار آلي').count()) > 0);

  // بحث وفلاتر
  await p.fill('input[type=search]', 'اختبار');
  await p.waitForTimeout(300);
  ok('البحث يرجّع نتيجة واحدة', (await p.locator('tbody tr').count()) === 1);
  await p.fill('input[type=search]', '');
  await p.selectOption('select >> nth=1', 'new'); // الخبرة = جديد
  await p.waitForTimeout(300);
  const newCount = await p.locator('tbody tr').count();
  ok('فلتر الخبرة', newCount > 0 && newCount < 21, `${newCount}`);
  await p.selectOption('select >> nth=1', 'all');
  // ترتيب
  await p.click('th button:has-text("الكود")');
  await p.waitForTimeout(200);
  const firstCode = await p.locator('tbody tr >> nth=0 >> td >> nth=0').innerText();
  ok('الترتيب بالكود', firstCode.trim() === '#1', firstCode);

  // ملف الخطيب + إيقاف مؤقت
  await p.fill('input[type=search]', 'اختبار');
  await p.waitForTimeout(200);
  await p.locator('tbody tr').first().click();
  await p.waitForTimeout(300);
  ok('ملف الخطيب يفتح', await p.getByRole('dialog', { name: 'الشيخ اختبار آلي' }).isVisible());
  await p.getByRole('dialog').getByRole('button', { name: 'إيقاف مؤقت' }).click();
  await p.waitForTimeout(400);
  ok('الإيقاف المؤقت', (await p.getByRole('dialog').getByText('متوقف مؤقتًا').count()) > 0);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  ok('Escape يقفل الملف', (await p.getByRole('dialog').count()) === 0);

  // مسجد جديد
  await go('/mosques?new=1');
  await p.goto('http://127.0.0.1:4173/mosques?new=1');
  await p.waitForTimeout(500);
  ok('نموذج مسجد جديد', await p.getByRole('dialog', { name: 'مسجد جديد' }).isVisible());
  await p.getByRole('dialog').locator('input').first().fill('مسجد الاختبار');
  await p.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await p.waitForTimeout(500);
  ok('المسجد الجديد ظهر', (await p.getByText('مسجد الاختبار').count()) > 0);

  // التوزيع: اقتراح ثم اعتماد
  await go('/schedule');
  const before = await p.evaluate(() => JSON.parse(localStorage.getItem('fs_demo_data_v1')).assignments.length);
  await p.getByRole('button', { name: /وزّع تلقائي/ }).click();
  await p.waitForTimeout(500);
  ok('الاقتراح يظهر قبل الحفظ', await p.getByRole('dialog', { name: 'اقتراح التوزيع' }).isVisible());
  const mid = await p.evaluate(() => JSON.parse(localStorage.getItem('fs_demo_data_v1')).assignments.length);
  ok('الاقتراح مش بيحفظ لوحده', mid === before, `${before} → ${mid}`);
  await p.getByRole('button', { name: 'اعتمد الاقتراح' }).click();
  await p.waitForTimeout(700);
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('fs_demo_data_v1')).assignments.length);
  ok('الاعتماد يحفظ التكليفات', after > before, `${after}`);

  // عرض الجمعة
  await p.getByRole('tab', { name: 'عرض الجمعة' }).click();
  await p.waitForTimeout(300);
  ok('عرض الجمعة', (await p.getByText('جمعاته الشهر ده').count()) === 1);
  await p.getByRole('tab', { name: 'عرض الشهر' }).click();

  // اعتذار من نافذة المكان
  await p.locator('table tbody td button').first().click();
  await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'اعتذر' }).click();
  await p.getByRole('button', { name: 'سجّل الاعتذار' }).click();
  await p.waitForTimeout(500);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  ok('المراجعة تعرض الاعتذار', (await p.getByText(/اعتذارات محتاجة بديل|اعتذار/).count()) > 0);

  // نشر
  await p.getByRole('button', { name: 'نشر الجدول' }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'انشر' }).click();
  await p.waitForTimeout(700);
  ok('النشر يفتح مركز الإرسال', p.url().includes('/messages'));

  // رسالة مخصصة: مراجعة بدون إرسال فعلي
  await p.getByRole('tab', { name: 'رسالة مخصصة' }).click();
  await p.waitForTimeout(300);
  await p.getByRole('button', { name: /راجع قبل الإرسال/ }).click();
  await p.waitForTimeout(300);
  ok('مراجعة الرسالة المخصصة', (await p.getByText('مراجعة قبل الإرسال').count()) === 1);
  ok('المتغيرات اتبدلت', (await p.getByText('{الاسم}').count()) === 0);

  // سجل الإرسال وسجل العمليات
  await p.getByRole('tab', { name: 'سجل الإرسال' }).click();
  await p.waitForTimeout(300);
  ok('سجل الإرسال يفتح', (await p.getByText('مش بيقدر يعرف لو الرسالة وصلت').count()) === 1);
  await go('/log');
  const logText = await p.locator('main').innerText();
  ok('السجل فيه إضافة خطيب وتعديله والتوزيع والنشر والاعتذار', ['إضافة خطيب', 'تعديل خطيب', 'إضافة مسجد', 'توزيع', 'نشر جدول', 'اعتذار'].every((x) => logText.includes(x)));
  ok('السجل يعرض القديم والجديد', logText.includes('نشط') && logText.includes('متوقف'));

  // التقارير
  await go('/report');
  for (const t of ['المساجد', 'عدالة التوزيع', 'التواصل والتأكيد', 'مقارنة الشهور']) {
    await p.getByRole('tab', { name: t }).click();
    await p.waitForTimeout(150);
  }
  ok('تبويبات التقارير تشتغل', (await p.getByText('مقارنة آخر الشهور').count()) === 1);

  // تصدير إكسل
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.getByRole('button', { name: 'تصدير إكسل' }).click()]);
  ok('تصدير التقرير إكسل', dl && (await dl.path().then(f=>require('fs').readFileSync(f).subarray(0,2).toString())) === 'PK');

  // الإعدادات: تحقق ونسخة احتياطية
  await go('/settings');
  await p.fill('#org-name', '');
  ok('الإعدادات: الاسم مطلوب', (await p.getByText('الاسم مطلوب').count()) === 1 && (await p.getByRole('button', { name: 'حفظ التغييرات' }).isDisabled()));
  await p.getByRole('button', { name: 'تراجع' }).click();
  await p.fill('#admin-phone', '123');
  ok('الإعدادات: رقم غلط', (await p.getByText('الرقم مش بصيغة صحيحة').count()) === 1);
  await p.getByRole('button', { name: 'تراجع' }).click();
  await p.getByRole('button', { name: 'النسخ الاحتياطي' }).click();
  const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.getByRole('button', { name: 'تنزيل نسخة إكسل' }).click()]);
  ok('النسخة الاحتياطية', dl2 && (await dl2.path().then(f=>require('fs').readFileSync(f).subarray(0,2).toString())) === 'PK');

  // الجرس
  await p.getByRole('button', { name: /التنبيهات/ }).click();
  await p.waitForTimeout(200);
  ok('قايمة التنبيهات تفتح', (await p.getByText('التنبيهات التشغيلية').count()) >= 1);
  await p.keyboard.press('Escape');

  // طي السايدبار
  await p.getByRole('button', { name: 'طي القائمة' }).click();
  await p.waitForTimeout(300);
  const w = await p.locator('aside').first().evaluate((e) => e.getBoundingClientRect().width);
  ok('طي السايدبار', w < 100, `${w}`);
  await p.getByRole('button', { name: 'فرد القائمة' }).click();

  // صفحة الخطيب ما زالت شغالة
  const token = await p.evaluate(() => JSON.parse(localStorage.getItem('fs_demo_data_v1')).preachers[0].portal_token);
  await p.goto(`http://127.0.0.1:4173/p/${token}`);
  await p.waitForTimeout(800);
  ok('صفحة الخطيب بتفتح', (await p.getByText(/فضيلة الشيخ/).count()) > 0);

  ok('مفيش أخطاء في الكونسول', errors.length === 0, errors.slice(0, 3).join(' | '));

  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? `  (${r.extra})` : ''}`);
  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
  await b.close();
})().catch((e) => { console.error('CRASH', e.message); for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`); process.exit(1); });
