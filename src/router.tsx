import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { ApiError } from "@/lib/api-error";
import { routeTree } from "./routeTree.gen";

const CONTEXT_ERROR_CODES = new Set([
  "TENANT_CONTEXT_REQUIRED",
  "TENANT_NOT_FOUND",
  "TENANT_ACCESS_DENIED",
  "PLATFORM_CONTEXT_REQUIRED",
  "SUPER_ADMIN_REQUIRED",
]);

function shouldRetry(failureCount: number, error: unknown): boolean {
  // Never retry context errors — they need user action / redirect.
  if (error instanceof ApiError && CONTEXT_ERROR_CODES.has(error.code)) return false;
  if (error instanceof ApiError && (error.status === 400 || error.status === 403)) return false;
  return failureCount < 1;
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  // Expose for global context-error handler (see src/lib/context-errors.ts).
  if (typeof window !== "undefined") {
    (window as unknown as { __queryClient?: QueryClient }).__queryClient = queryClient;
  }


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
