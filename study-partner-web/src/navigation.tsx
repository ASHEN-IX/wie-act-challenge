'use client';
import React, { useCallback, useEffect, useMemo } from 'react';
import NextLink, { type LinkProps as NextLinkProps } from 'next/link';
import {
  usePathname,
  useRouter,
  useParams as nextParams,
  useSearchParams as nextSearchParams,
  type ReadonlyURLSearchParams
} from 'next/navigation';

export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof NextLinkProps | 'href'>, Partial<NextLinkProps> {
  to?: string;
  href?: string | any;
  children?: React.ReactNode;
}

export function Link({ to, href, ...props }: LinkProps) {
  const destination = href ?? to ?? '#';
  return <NextLink href={destination} {...props} />;
}

export interface NavigateOptions {
  replace?: boolean;
  state?: Record<string, unknown>;
}

export function useNavigate() {
  const router = useRouter();
  return useCallback((target: string | number, options: NavigateOptions = {}) => {
    if (typeof target === 'number') {
      if (target === -1) router.back();
      else if (target === 1) router.forward();
      else window.history.go(target);
      return;
    }
    const url = new URL(target, window.location.origin);
    if (url.origin !== window.location.origin) throw new Error('Navigation must stay on this site');
    if (options.state) {
      for (const [key, value] of Object.entries(options.state)) {
        url.searchParams.set(key, String(value));
      }
    }
    const destination = url.pathname + url.search + url.hash;
    if (options.replace) router.replace(destination);
    else router.push(destination);
  }, [router]);
}

export interface LocationState {
  pathname: string;
  search: string;
  state: Record<string, string>;
}

export function useLocation(): LocationState {
  const pathname = usePathname();
  const params = nextSearchParams();
  const search = params ? params.toString() : '';
  return useMemo(() => ({
    pathname,
    search: search ? '?' + search : '',
    state: Object.fromEntries(new URLSearchParams(search))
  }), [pathname, search]);
}

export const useParams = nextParams;

export function useSearchParams(): [
  ReadonlyURLSearchParams | null,
  (value: string | URLSearchParams | ((prev: URLSearchParams) => URLSearchParams), options?: { replace?: boolean }) => void
] {
  const params = nextSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const update = useCallback((value: string | URLSearchParams | ((prev: URLSearchParams) => URLSearchParams), options: { replace?: boolean } = {}) => {
    const current = new URLSearchParams(params ? params.toString() : '');
    const next = new URLSearchParams(typeof value === 'function' ? (value as any)(current) : (value as any));
    const destination = pathname + (next.size ? '?' + next.toString() : '');
    if (options.replace) router.replace(destination);
    else router.push(destination);
  }, [params, pathname, router]);
  return [params, update];
}

export function Navigate({ to, replace = false }: { to: string; replace?: boolean }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, to, replace]);
  return null;
}
