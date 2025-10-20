import { API_BASE_URL } from './config.js';

async function getAccessToken() {
  return localStorage.getItem("access_token");
}

async function refreshAccessToken() {
  const refresh_token = localStorage.getItem("refresh_token");
  if (!refresh_token) return null;

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token })
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem("access_token", data.access_token);
    return data.access_token;
  }
  return null;
}

async function apiFetch(url, options = {}) {
  let token = await getAccessToken();
  options.headers = options.headers || {};
  options.headers["Authorization"] = `Bearer ${token}`;

  let res = await fetch(`${url}`, options);

  // If unauthorized, try refresh
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      options.headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${url}`, options);
    }
  }

  return res;
}

export { apiFetch };
