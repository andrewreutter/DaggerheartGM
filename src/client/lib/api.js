import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

let firebaseConfig;
try {
  const res = await fetch('/api/config');
  const json = await res.json();
  firebaseConfig = json.firebaseConfig;
} catch(e) {
  console.error('Failed to fetch /api/config:', e);
}

let app, auth;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (e) {
  console.error('Firebase initialization failed:', e);
}

export { auth };

export const getAuthToken = async () => {
  const currentUser = auth?.currentUser;
  if (!currentUser) return null;
  return currentUser.getIdToken();
};

export const loadData = async (currentUser, { includeSrd = false, includePublic = false } = {}) => {
  const token = await currentUser.getIdToken();
  const params = new URLSearchParams();
  if (includeSrd) params.set('includeSrd', '1');
  if (includePublic) params.set('includePublic', '1');
  const query = params.toString() ? `?${params}` : '';
  const res = await fetch(`/api/data${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const saveItem = async (collectionName, item) => {
  const token = await getAuthToken();
  if (!token) return null;
  const res = await fetch(`/api/data/${collectionName}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const deleteItem = async (collectionName, id) => {
  const token = await getAuthToken();
  if (!token) return;
  const res = await fetch(`/api/data/${collectionName}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
};

export const fetchFCG = async (url) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/fetch-fcg?url=${encodeURIComponent(url)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};
