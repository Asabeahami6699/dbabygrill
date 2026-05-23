/** Where to send the user after a successful sign-in. */
export function getPostAuthPath(role: string, returnTo?: string | null): string {
  if (role === 'delivery_guy') return '/delivery/dashboard';
  if (role === 'company_admin') return '/company/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  if (returnTo && returnTo !== '/' && !returnTo.startsWith('/login') && !returnTo.startsWith('/register')) {
    return returnTo;
  }
  return '/';
}
