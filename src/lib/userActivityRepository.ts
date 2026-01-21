import type { UserActivity } from "../models/userActivity";

const STORAGE_KEY = "userActivities";

type ActivityStore = Record<string, UserActivity>;

const loadStore = (): ActivityStore => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    return (JSON.parse(raw) as ActivityStore) ?? {};
  } catch {
    return {};
  }
};

const saveStore = (store: ActivityStore) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

export const getUserActivity = (routeId: string): UserActivity | undefined => {
  const store = loadStore();
  return store[routeId];
};

export const saveUserActivity = (activity: UserActivity): void => {
  const store = loadStore();
  store[activity.routeId] = activity;
  saveStore(store);
};

export const clearUserActivity = (routeId: string): void => {
  const store = loadStore();
  delete store[routeId];
  saveStore(store);
};
