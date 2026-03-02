export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: ['/dashboard', '/create', '/join', '/group/:path*'],
};
