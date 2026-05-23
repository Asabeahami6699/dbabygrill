import toast from 'react-hot-toast';
import { Copy, Share2, X } from 'lucide-react';
import { SITE_NAME, SITE_URL } from '../../config/site';

export interface AdminCredentialsPayload {
  companyName: string;
  adminEmail: string;
  adminPassword: string;
  adminName?: string;
}

export function buildAdminCredentialsText({
  companyName,
  adminEmail,
  adminPassword,
  adminName,
}: AdminCredentialsPayload): string {
  const loginUrl = `${SITE_URL}/login`;
  return [
    `${SITE_NAME} — Restaurant admin login`,
    '',
    `Company: ${companyName}`,
    adminName ? `Name: ${adminName}` : '',
    `Login page: ${loginUrl}`,
    `Email: ${adminEmail}`,
    `Password: ${adminPassword}`,
    '',
    'Share these credentials securely with the restaurant admin.',
  ]
    .filter(Boolean)
    .join('\n');
}

interface AdminCredentialsToastProps extends AdminCredentialsPayload {
  toastId: string;
  visible: boolean;
}

function AdminCredentialsToast({
  toastId,
  visible,
  companyName,
  adminEmail,
  adminPassword,
  adminName,
}: AdminCredentialsToastProps) {
  const loginUrl = `${SITE_URL}/login`;
  const shareText = buildAdminCredentialsText({
    companyName,
    adminEmail,
    adminPassword,
    adminName,
  });

  const copyCredentials = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success('Copied to clipboard', { id: 'admin-cred-copy' });
    } catch {
      toast.error('Could not copy');
    }
  };

  const shareCredentials = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${SITE_NAME} admin login — ${companyName}`,
          text: shareText,
        });
        return;
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    await copyCredentials();
    toast.success('Copied — paste into WhatsApp, email, etc.', { id: 'admin-cred-share-fallback' });
  };

  return (
    <div
      className={`${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      } max-w-md w-full bg-white shadow-xl rounded-xl pointer-events-auto ring-1 ring-black/5 overflow-hidden transition-all duration-200`}
    >
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 px-4 py-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-white text-sm">Company & admin created</p>
          <p className="text-orange-100 text-xs mt-0.5">Share login details with the restaurant</p>
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(toastId)}
          className="p-1 rounded-lg hover:bg-white/20 text-white shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3 space-y-2 text-sm text-gray-700">
        <p>
          <span className="font-medium text-gray-900">Company:</span> {companyName}
        </p>
        {adminName && (
          <p>
            <span className="font-medium text-gray-900">Admin:</span> {adminName}
          </p>
        )}
        <p>
          <span className="font-medium text-gray-900">Email:</span>{' '}
          <span className="font-mono text-xs break-all">{adminEmail}</span>
        </p>
        <p>
          <span className="font-medium text-gray-900">Password:</span>{' '}
          <span className="font-mono text-xs break-all">{adminPassword}</span>
        </p>
        <p className="text-xs text-gray-500 pt-1">
          Login at{' '}
          <a href={loginUrl} className="text-orange-600 hover:underline break-all">
            {loginUrl}
          </a>
        </p>
      </div>

      <div className="flex border-t border-gray-100">
        <button
          type="button"
          onClick={copyCredentials}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Copy className="w-4 h-4" />
          Copy
        </button>
        <div className="w-px bg-gray-100" />
        <button
          type="button"
          onClick={shareCredentials}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>
    </div>
  );
}

export function showAdminCredentialsToast(payload: AdminCredentialsPayload) {
  return toast.custom(
    (t) => (
      <AdminCredentialsToast
        toastId={t.id}
        visible={t.visible}
        companyName={payload.companyName}
        adminEmail={payload.adminEmail}
        adminPassword={payload.adminPassword}
        adminName={payload.adminName}
      />
    ),
    {
      duration: 20_000,
      position: 'top-center',
    }
  );
}
