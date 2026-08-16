// Auto-detect API URL: use local backend in development, tunnel URL on Vercel
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal
    ? 'http://localhost:3000/api'
    : 'https://companion-marathon-academy-buying.trycloudflare.com/api';

const fetchApi = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || data.errors?.[0]?.msg || 'API Request Failed');
        }
        
        return data;
    } catch (error) {
        throw error;
    }
};

// Determine the root-relative path to login page based on current location
function getLoginPath() {
    const depth = window.location.pathname.split('/').filter(Boolean).length;
    // If we are in a subdirectory (teacher/, student/, admin/), go up one level
    if (depth >= 2) {
        return '../login.html';
    }
    return 'login.html';
}

const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    window.location.href = getLoginPath();
};

const checkAuth = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = getLoginPath();
    }
};
