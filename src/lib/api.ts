let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (inMemoryToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const controller = new AbortController();
  const timeoutMs = 6000;
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      credentials: options.credentials || 'same-origin',
      headers,
      signal: options.signal || controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`انتهت مهلة انتظار استجابة الخادم (${url}) - يرجى التحقق من اتصال الشبكة`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    let errorMsg = `خطأ في الاتصال بالخادم (${response.status})`;
    try {
      if (contentType.includes('application/json')) {
        const errJson = await response.json();
        if (errJson && errJson.error) {
          errorMsg = errJson.error;
        }
      }
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }

  if (!contentType.includes('application/json')) {
    throw new Error(`استجابة غير متوقعة من الخادم (${url}) - يرجى إعادة المحاولة`);
  }

  return response.json();
}
