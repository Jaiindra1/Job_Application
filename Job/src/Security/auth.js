const API = import.meta.env.VITE_API_URL || 'http://localhost:7000/api';

export async function request(path, body) {
  const response = await fetch(`${API}/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export function save(data) {
  localStorage.setItem('jobpilot_token', data.token);
  localStorage.setItem('jobpilot_user', JSON.stringify(data.user));
}
export const loggedIn = () => Boolean(localStorage.getItem('jobpilot_token'));
export function logout() {
  localStorage.removeItem('jobpilot_token');
  localStorage.removeItem('jobpilot_user');
}
