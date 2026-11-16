// تصدير إكسل (المكتبة بتتحمل وقت الحاجة بس)
export async function downloadWorkbook(filename: string, sheets: { name: string; rows: (string | number)[][] }[]) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    ws['!cols'] = s.rows[0]?.map((_, i) => ({ wch: Math.max(10, ...s.rows.map((r) => String(r[i] ?? '').length + 2)) }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}
