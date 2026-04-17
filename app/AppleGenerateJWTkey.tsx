import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Copy, Check, AlertCircle, Key } from 'lucide-react';

export default function AppleSecretGenerator() {
  const [teamId, setTeamId] = useState('');
  const [keyId, setKeyId] = useState('');
  const [clientId, setClientId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!teamId || !keyId || !clientId || !privateKey) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-apple-secret', {
        body: { teamId, keyId, clientId, privateKey }
      });

      if (error) throw error;

      if (data.success) {
        setClientSecret(data.clientSecret);
        setExpiresAt(data.expiresAt);
        toast.success('Apple client secret generated successfully!');
      } else {
        throw new Error(data.error || 'Failed to generate secret');
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to generate client secret');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(clientSecret);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black">
            <Key className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Apple Client Secret Generator</h1>
            <p className="text-gray-600">Generate JWT token for Apple Sign In with Supabase</p>
          </div>
        </div>

        {/* Alert Box */}
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-blue-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-600" />
          <div className="text-sm">
            <p className="font-semibold text-blue-900">Why do you need this?</p>
            <p className="text-blue-800">
              Supabase requires a <strong>client secret (JWT)</strong> for Apple OAuth, not the raw private key. 
              This tool generates a signed JWT token using your Apple credentials. The token is valid for 6 months.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold">Enter Your Apple Developer Credentials</h2>
          
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Team ID <span className="text-red-600">*</span>
              </label>
              <Input
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                placeholder="ABCD123456 (10 characters)"
                className="font-mono"
              />
              <p className="mt-1 text-xs text-gray-500">
                Find in: Apple Developer → Membership → Team ID
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Key ID <span className="text-red-600">*</span>
              </label>
              <Input
                value={keyId}
                onChange={(e) => setKeyId(e.target.value)}
                placeholder="XYZ789ABCD (10 characters)"
                className="font-mono"
              />
              <p className="mt-1 text-xs text-gray-500">
                Find in: Apple Developer → Keys → Sign In with Apple Key → Key ID
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Service ID (Client ID) <span className="text-red-600">*</span>
              </label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="com.yourdomain.signin"
                className="font-mono"
              />
              <p className="mt-1 text-xs text-gray-500">
                Find in: Apple Developer → Identifiers → Services IDs → Identifier
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Private Key (.p8 file content) <span className="text-red-600">*</span>
              </label>
              <Textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...&#10;-----END PRIVATE KEY-----"
                className="h-32 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Paste the entire content of your .p8 file (including BEGIN/END lines)
              </p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              {loading ? 'Generating...' : 'Generate Client Secret'}
            </Button>
          </div>
        </div>

        {/* Result */}
        {clientSecret && (
          <div className="mt-6 rounded-lg bg-green-50 p-6 shadow-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-green-900">✅ Client Secret Generated!</h2>
              <Button
                onClick={handleCopy}
                variant="outline"
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            <div className="mb-4 rounded bg-white p-4">
              <p className="mb-2 text-sm font-medium text-gray-700">Client Secret (JWT):</p>
              <code className="block break-all rounded bg-gray-100 p-3 text-xs font-mono">
                {clientSecret}
              </code>
            </div>

            <div className="mb-4 text-sm">
              <p className="font-medium text-gray-700">Expires: {new Date(expiresAt).toLocaleDateString()}</p>
              <p className="text-gray-600">Valid for 180 days (6 months)</p>
            </div>

            <div className="space-y-2 text-sm text-gray-700">
              <p className="font-semibold">📋 Next Steps:</p>
              <ol className="ml-4 list-decimal space-y-1">
                <li>Copy the client secret above</li>
                <li>Go to <strong>Supabase Dashboard</strong> → Authentication → Providers → Apple</li>
                <li>Paste the JWT into the <strong>"Secret Key (JWT)"</strong> field</li>
                <li>Fill in:
                  <ul className="ml-4 mt-1 list-disc">
                    <li>Service ID: <code className="rounded bg-white px-1 font-mono text-xs">{clientId}</code></li>
                    <li>Team ID: <code className="rounded bg-white px-1 font-mono text-xs">{teamId}</code></li>
                    <li>Key ID: <code className="rounded bg-white px-1 font-mono text-xs">{keyId}</code></li>
                  </ul>
                </li>
                <li>Toggle <strong>"Enable Apple provider"</strong> to ON</li>
                <li>Click <strong>Save</strong></li>
                <li>Test Apple Sign In on your login page</li>
              </ol>
            </div>

            <div className="mt-4 rounded bg-yellow-50 p-3 text-sm">
              <p className="font-semibold text-yellow-900">⚠️ Important:</p>
              <p className="text-yellow-800">
                This JWT expires in 6 months. You'll need to regenerate a new client secret before then.
                Save this page URL for easy access later.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

this is for jwt key supabase apple for sign make it better real for dawinix ai snd add its in settings
