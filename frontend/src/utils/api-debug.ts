// API Debug Helper - Logs all fetch requests
export function setupApiDebugger() {
  // Store original fetch
  const originalFetch = window.fetch;
  
  // Override fetch to log requests
  window.fetch = async function(...args) {
    const [url, options] = args;
    
    console.group(`🌐 API Request: ${options?.method || 'GET'} ${url}`);
    console.log('URL:', url);
    console.log('Options:', options);
    console.groupEnd();
    
    try {
      const response = await originalFetch.apply(this, args);
      
      console.group(`✅ API Response: ${response.status} ${url}`);
      console.log('Status:', response.status, response.statusText);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));
      console.groupEnd();
      
      return response;
    } catch (error) {
      console.group(`❌ API Error: ${url}`);
      console.error('Error:', error);
      console.groupEnd();
      throw error;
    }
  };
}