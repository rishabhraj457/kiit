const getApiUrl = () => {
  // If no environment variable, use production fallback
  if (!import.meta.env.VITE_BACKEND_URL) {
    return 'https://confique.onrender.com/api';
  }
  
  let baseUrl = import.meta.env.VITE_BACKEND_URL;
  
  // Remove trailing slashes
  baseUrl = baseUrl.replace(/\/+$/, '');
  
  // Check if the URL already ends with /api
  if (baseUrl.endsWith('/api')) {
    return baseUrl;
  }
  
  // Otherwise add /api
  return baseUrl + '/api';
};

const API_URL = getApiUrl();

console.log('🔧 API_URL configured:', API_URL);

export default API_URL;