const API_BASE_URL = 'http://localhost:3000/api';

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

const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
};

const checkAuth = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
    }
};
