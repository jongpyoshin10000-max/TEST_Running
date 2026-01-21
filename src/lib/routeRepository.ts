import type { Route } from "../models/route";

const STORAGE_KEY = "routes";

const loadRoutes = (): Route[] => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as Route[];
    return parsed ?? [];
  } catch {
    return [];
  }
};

const saveRoutes = (routes: Route[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
};

export const getRoutes = (): Route[] => loadRoutes();

export const getRouteById = (id: string): Route | undefined =>
  loadRoutes().find((route) => route.id === id);

export const upsertRoute = (route: Route): Route => {
  const routes = loadRoutes();
  const index = routes.findIndex((item) => item.id === route.id);
  if (index >= 0) {
    routes[index] = route;
  } else {
    routes.unshift(route);
  }
  saveRoutes(routes);
  return route;
};

export const deleteRoute = (id: string): void => {
  const routes = loadRoutes().filter((route) => route.id !== id);
  saveRoutes(routes);
};
