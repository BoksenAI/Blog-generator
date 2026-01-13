
// Use the environment variable if defined (Production), otherwise fallback to localhost (Development)
// Note: VITE_API_URL should not have a trailing slash
export const API_Base = import.meta.env.VITE_API_URL || "http://localhost:3001";
