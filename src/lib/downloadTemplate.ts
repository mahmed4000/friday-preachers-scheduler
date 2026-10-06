import { getAuthToken } from './api.ts';

/**
 * Helper utility to trigger programmatic blob downloads for Excel templates.
 * Avoids direct anchor href navigation issues inside iframes or SPA routers.
 */
export async function downloadImportTemplate(
  type: 'mosques' | 'preachers' | 'full' | 'imams'
): Promise<void> {
  try {
    const rawType = type === 'imams' ? 'preachers' : type;
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/import-export/templates/${rawType}`, {
      credentials: 'same-origin',
      headers,
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || 'تعذر تحميل القالب المطلوب من الخادم');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    let fileName = 'template.xlsx';
    if (rawType === 'mosques') {
      fileName = 'mosques-import-template.xlsx';
    } else if (rawType === 'preachers') {
      fileName = 'preachers-import-template.xlsx';
    } else {
      fileName = 'mosques-preachers-import-template.xlsx';
    }

    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    console.error('Download template error:', err);
    alert(err.message || 'فشل تحميل القالب المنسق');
  }
}
