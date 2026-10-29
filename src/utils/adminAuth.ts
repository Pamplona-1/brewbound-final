const ADMIN_PASSWORD_STORAGE_KEY = 'brewbound_admin_password';
export const DEFAULT_ADMIN_PASSWORD = 'admin2026';

export const authenticateAdminPassword = (password: string): boolean => {
  const savedPassword = localStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY);
  return password === (savedPassword ?? DEFAULT_ADMIN_PASSWORD);
};

export const updateAdminPassword = (password: string): void => {
  localStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, password);
};
