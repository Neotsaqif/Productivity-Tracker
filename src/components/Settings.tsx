import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, HelpCircle, HardDrive, RefreshCw, Layers, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

interface DBConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  uri?: string;
}

interface SettingsProps {
  onRefresh?: () => void;
}

export function Settings({ onRefresh }: SettingsProps) {
  const [engine, setEngine] = useState<'sqlite' | 'mysql' | 'json'>('sqlite');
  const [config, setConfig] = useState<DBConfig>({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'productivity',
    uri: ''
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Email System State
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [failedEmails, setFailedEmails] = useState<any[]>([]);
  const [emailStatusMessage, setEmailStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSavingRecipients, setIsSavingRecipients] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Date Override State
  const [dateOverride, setDateOverride] = useState<string | null>(null);
  const [tempOverride, setTempOverride] = useState<string>('');

  // Resend API Configuration State
  const [resendApiKey, setResendApiKey] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  const [isSavingResend, setIsSavingResend] = useState(false);
  const [resendSuccessMsg, setResendSuccessMsg] = useState<string | null>(null);
  const [resendErrorMsg, setResendErrorMsg] = useState<string | null>(null);

  // Load current database configurations & email settings on mount
  useEffect(() => {
    fetchConfig();
    fetchEmailSettings();
    fetchFailedEmails();
    fetchResendConfig();
    fetchDateOverride();
  }, []);

  const fetchResendConfig = async () => {
    try {
      const res = await fetch('/api/email/resend-config');
      if (res.ok) {
        const data = await res.json();
        setResendApiKey(data.resend_api_key || '');
        setEmailFrom(data.email_from || '');
      }
    } catch (err: any) {
      console.error('Failed to fetch Resend config:', err);
    }
  };

  const fetchDateOverride = async () => {
    try {
      const res = await fetch('/api/settings/date-override');
      if (res.ok) {
        const data = await res.json();
        setDateOverride(data.date);
      }
    } catch (err: any) {
      console.error('Failed to fetch date override:', err);
    }
  };

  const handleSetOverride = async (date: string) => {
    if (!date) return;
    try {
        const res = await fetch('/api/settings/date-override', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ date })
        });
        if (res.ok) {
            const data = await res.json();
            setDateOverride(data.date);
            alert('Date override set to ' + data.date);
        } else {
          throw new Error('Failed to set');
        }
    } catch (e: any) {
        alert('Error: ' + e.message);
    }
  }

  const handleClearOverride = async () => {
    try {
        const res = await fetch('/api/settings/date-override', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ date: null })
        });
        if (res.ok) {
            setDateOverride(null);
            alert('Date override cleared');
        } else {
          throw new Error('Failed to clear');
        }
    } catch (e: any) {
        alert('Error: ' + e.message);
    }
  }

  const handleSaveResendConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingResend(true);
    setResendSuccessMsg(null);
    setResendErrorMsg(null);
    try {
      const res = await fetch('/api/email/resend-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resend_api_key: resendApiKey,
          email_from: emailFrom,
        }),
      });
      if (res.ok) {
        setResendSuccessMsg('Resend configuration saved successfully!');
        await fetchResendConfig();
      } else {
        const data = await res.json();
        setResendErrorMsg(data.error || 'Failed to save Resend configuration.');
      }
    } catch (err: any) {
      setResendErrorMsg('Network error saving Resend: ' + err.message);
    } finally {
      setIsSavingResend(false);
    }
  };

  const fetchEmailSettings = async () => {
    try {
      const res = await fetch('/api/settings/email-recipients');
      if (res.ok) {
        const data = await res.json();
        setRecipients(data.recipients || []);
      }
    } catch (err) {
      console.error('Failed to fetch email settings:', err);
    }
  };

  const fetchFailedEmails = async () => {
    try {
      const res = await fetch('/api/email/failed');
      if (res.ok) {
        const data = await res.json();
        setFailedEmails(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch failed emails:', err);
    }
  };

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailStatusMessage({ type: 'error', text: 'Invalid email address format.' });
      return;
    }

    if (recipients.includes(email)) {
      setEmailStatusMessage({ type: 'error', text: 'This recipient email is already in the list.' });
      return;
    }

    if (recipients.length >= 10) {
      setEmailStatusMessage({ type: 'error', text: 'You can have a maximum of 10 recipients.' });
      return;
    }

    const updated = [...recipients, email];
    await saveRecipientsList(updated);
  };

  const handleRemoveEmail = async (emailToRemove: string) => {
    const updated = recipients.filter(r => r !== emailToRemove);
    await saveRecipientsList(updated);
  };

  const saveRecipientsList = async (list: string[]) => {
    setIsSavingRecipients(true);
    setEmailStatusMessage(null);
    try {
      const res = await fetch('/api/settings/email-recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: list })
      });
      if (res.ok) {
        const data = await res.json();
        setRecipients(data.recipients || []);
        setNewEmail('');
        setEmailStatusMessage({ type: 'success', text: 'Recipient list updated successfully!' });
      } else {
        const data = await res.json();
        setEmailStatusMessage({ type: 'error', text: data.error || 'Failed to update recipient list.' });
      }
    } catch (err: any) {
      setEmailStatusMessage({ type: 'error', text: 'Network error saving recipients: ' + err.message });
    } finally {
      setIsSavingRecipients(false);
    }
  };

  const handleRetryEmails = async () => {
    setIsRetrying(true);
    setEmailStatusMessage(null);
    try {
      const res = await fetch('/api/email/retry', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        await fetchFailedEmails();
        setEmailStatusMessage({
          type: 'success',
          text: `Retry completed. Processed: ${data.processed}, Sent successfully: ${data.successCount}, Remained failed: ${data.failedCount}.`
        });
      } else {
        setEmailStatusMessage({ type: 'error', text: 'Failed to process email retries.' });
      }
    } catch (err: any) {
      setEmailStatusMessage({ type: 'error', text: 'Error executing retry loop: ' + err.message });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTesting(true);
    setEmailStatusMessage(null);
    try {
      const res = await fetch('/api/email/test', { method: 'POST' });
      const data = await res.json();
      await fetchFailedEmails();
        if (res.ok) {
          setEmailStatusMessage({
            type: 'success',
            text: data.message || 'Diagnostic Resend API test email dispatched successfully!'
          });
        } else {
          setEmailStatusMessage({
            type: 'error',
            text: data.error || 'Failed to dispatch diagnostic Resend API test email.'
          });
        }
    } catch (err: any) {
      await fetchFailedEmails();
      setEmailStatusMessage({
        type: 'error',
        text: 'Error calling test endpoint: ' + err.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  const fetchConfig = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/db/config');
      if (res.ok) {
        const data = await res.json();
        setEngine(data.engine || 'sqlite');
        if (data.config) {
          setConfig((prev) => ({
            ...prev,
            ...data.config,
            // If they are empty, provide fallback hints
            host: data.config.host || '127.0.0.1',
            port: data.config.port || 3306,
            user: data.config.user || 'root',
            database: data.config.database || 'productivity',
          }));
        }
      }
    } catch (err: any) {
      console.error('Failed to load DB settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      // Cast port to number
      const payloadConfig = {
        ...config,
        port: Number(config.port) || 3306
      };

      const res = await fetch('/api/db/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          engine,
          config: engine === 'mysql' ? payloadConfig : {}
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setStatusMessage({
          type: 'success',
          text: `Database engine successfully switched to [${engine.toUpperCase()}]! Dynamic hot-swap applied without restarts.`
        });
        onRefresh?.();
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Failed to establish database handshake with specified credentials.'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Network connection failure triggering hot-swap: ' + err.message
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-4">
        <RefreshCw className="w-10 h-10 text-slate-900 animate-spin mx-auto stroke-[3]" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Database Engine Status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Settings Header Block */}
      <div className="border-4 border-slate-900 bg-indigo-50 p-6 md:p-8 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-indigo-200/40 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-6 h-6 text-indigo-900 stroke-[2.5]" />
              <span className="text-[10px] uppercase font-black tracking-[0.2em] text-indigo-800">
                Workspace Infrastructure
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">
              Database Configurations
            </h1>
            <p className="text-xs md:text-sm font-semibold text-slate-700 max-w-2xl mt-1 leading-relaxed">
              Switch database architectures dynamically on the fly! Toggle between lightweight standalone engines or high-throughput external databases without rebooting the server.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-3 bg-white border-2 border-slate-900 px-4 py-2.5 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
            <Layers className="w-5 h-5 text-emerald-600 stroke-[2.5] shrink-0" />
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Active Storage Engine</p>
              <p className="text-sm font-extrabold uppercase text-slate-900">{engine}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Handshake Responses */}
      {statusMessage && (
        <div
          className={`border-3 p-5 flex gap-4 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-900 text-emerald-950 shadow-[4px_4px_0px_0px_rgba(16,185,129,1)]'
              : 'bg-rose-50 border-rose-900 text-rose-950 shadow-[4px_4px_0px_0px_rgba(244,63,94,1)]'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 stroke-[2.5]" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-rose-700 shrink-0 stroke-[2.5]" />
          )}
          <div className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wider block">
              {statusMessage.type === 'success' ? 'Engine Update Complete' : 'Handshake Rejected'}
            </span>
            <p className="text-xs font-bold leading-relaxed">{statusMessage.text}</p>
          </div>
        </div>
      )}

      {/* Main Configurations Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Connection Setup Form */}
        <form onSubmit={handleApplyConfig} className="lg:col-span-8 bg-white border-4 border-slate-900 p-6 md:p-8 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-6">
          
          <div className="border-b-2 border-slate-100 pb-4">
            <h2 className="text-base font-black uppercase tracking-tight text-slate-900 mb-1">
              Select Storage Architecture
            </h2>
            <p className="text-xs font-bold text-slate-400">
              Choose the primary driver used to execute transaction queries and persist application status:
            </p>
          </div>

          {/* Engine Selector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 1. SQLite */}
            <label
              className={`p-4 border-2 border-slate-900 flex flex-col justify-between gap-4 cursor-pointer relative transition-all ${
                engine === 'sqlite'
                  ? 'bg-amber-50/70 border-amber-900 shadow-[3px_3px_0px_0px_rgba(120,53,4,1)] translate-y-[-2px]'
                  : 'bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="engine-select"
                checked={engine === 'sqlite'}
                onChange={() => {
                  setEngine('sqlite');
                  setStatusMessage(null);
                }}
                className="absolute right-3 top-3 accent-amber-700"
              />
              <div>
                <span className="text-sm font-black uppercase tracking-tight text-slate-900 block mb-1">
                  SQLite
                </span>
                <p className="text-[10px] font-semibold text-slate-500 leading-normal">
                  Highly efficient, local embedded database stored in a single binary file on disk. Perfect for single instances and zero setup.
                </p>
              </div>
              <span className="text-[9px] font-black uppercase border border-slate-900 bg-white px-2 py-0.5 self-start text-amber-900">
                Recommended
              </span>
            </label>

            {/* 2. MySQL */}
            <label
              className={`p-4 border-2 border-slate-900 flex flex-col justify-between gap-4 cursor-pointer relative transition-all ${
                engine === 'mysql'
                  ? 'bg-blue-50/70 border-blue-900 shadow-[3px_3px_0px_0px_rgba(30,58,138,1)] translate-y-[-2px]'
                  : 'bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="engine-select"
                checked={engine === 'mysql'}
                onChange={() => {
                  setEngine('mysql');
                  setStatusMessage(null);
                }}
                className="absolute right-3 top-3 accent-blue-700"
              />
              <div>
                <span className="text-sm font-black uppercase tracking-tight text-slate-900 block mb-1">
                  MySQL Network
                </span>
                <p className="text-[10px] font-semibold text-slate-500 leading-normal">
                  Connect to a centralized remote MySQL Server or high-productivity Cloud SQL database. Supports external client pools.
                </p>
              </div>
              <span className="text-[9px] font-black uppercase border border-slate-900 bg-white px-2 py-0.5 self-start text-blue-900">
                Distributed
              </span>
            </label>

            {/* 3. JSON Backup */}
            <label
              className={`p-4 border-2 border-slate-900 flex flex-col justify-between gap-4 cursor-pointer relative transition-all ${
                engine === 'json'
                  ? 'bg-rose-50/70 border-rose-900 shadow-[3px_3px_0px_0px_rgba(159,18,57,1)] translate-y-[-2px]'
                  : 'bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="engine-select"
                checked={engine === 'json'}
                onChange={() => {
                  setEngine('json');
                  setStatusMessage(null);
                }}
                className="absolute right-3 top-3 accent-rose-700"
              />
              <div>
                <span className="text-sm font-black uppercase tracking-tight text-slate-900 block mb-1">
                  JSON Store
                </span>
                <p className="text-[10px] font-semibold text-slate-500 leading-normal">
                  Simple JSON key-value database that stores snapshots inside the local file workspace. Highly portable fallback.
                </p>
              </div>
              <span className="text-[9px] font-black uppercase border border-slate-900 bg-white px-2 py-0.5 self-start text-rose-900">
                Fallback
              </span>
            </label>

          </div>

          {/* Conditional MySQL Configuration Params */}
          {engine === 'mysql' && (
            <div className="border-t-2 border-dashed border-slate-200 pt-6 space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-blue-900 bg-blue-50 border border-blue-900/10 p-3 mb-4">
                <HardDrive className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wide">
                  Specify MySQL Credentials Below
                </span>
              </div>

              {/* URL/URI Option */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Unified DB URI (MySQL URL / Database URL)
                </label>
                <input
                  type="text"
                  placeholder="mysql://user:password@host:port/database"
                  value={config.uri || ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, uri: e.target.value }))}
                  className="w-full px-3.5 py-2 border-2 border-slate-900 text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none placeholder-slate-400"
                />
                <p className="text-[9px] font-bold text-slate-400">
                  If provided, this URI string takes absolute priority and overrides individual parameters.
                </p>
              </div>

              {/* OR Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-0.5 bg-slate-100" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">OR INDIVIDUAL FIELDS</span>
                <div className="flex-1 h-0.5 bg-slate-100" />
              </div>

              {/* Individual Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Host Address (IP or Domain)
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(config.uri?.trim())}
                    placeholder="127.0.0.1"
                    value={config.host}
                    onChange={(e) => setConfig((prev) => ({ ...prev, host: e.target.value }))}
                    className="w-full px-3.5 py-2 border-2 border-slate-900 text-xs font-bold disabled:bg-slate-100 bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="md:col-span-4 space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Port Number
                  </label>
                  <input
                    type="number"
                    disabled={Boolean(config.uri?.trim())}
                    placeholder="3306"
                    value={config.port}
                    onChange={(e) => setConfig((prev) => ({ ...prev, port: parseInt(e.target.value, 10) || 3306 }))}
                    className="w-full px-3.5 py-2 border-2 border-slate-900 text-xs font-bold disabled:bg-slate-100 bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="md:col-span-6 space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Database Authenticated Username
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(config.uri?.trim())}
                    placeholder="root"
                    value={config.user}
                    onChange={(e) => setConfig((prev) => ({ ...prev, user: e.target.value }))}
                    className="w-full px-3.5 py-2 border-2 border-slate-900 text-xs font-bold disabled:bg-slate-100 bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="md:col-span-6 space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Database Password
                  </label>
                  <input
                    type="password"
                    disabled={Boolean(config.uri?.trim())}
                    placeholder="None / Empty"
                    value={config.password || ''}
                    onChange={(e) => setConfig((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3.5 py-2 border-2 border-slate-900 text-xs font-bold disabled:bg-slate-100 bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="md:col-span-12 space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Target Schema/Database Name
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(config.uri?.trim())}
                    placeholder="productivity"
                    value={config.database}
                    onChange={(e) => setConfig((prev) => ({ ...prev, database: e.target.value }))}
                    className="w-full px-3.5 py-2 border-2 border-slate-900 text-xs font-bold disabled:bg-slate-100 bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="border-t-2 border-slate-100 pt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-slate-900 text-white text-xs font-black uppercase tracking-wider rounded-none border-2 border-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  Testing Handshake...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  Apply & Swapping Active Engine
                </>
              )}
            </button>
          </div>

        </form>

        {/* Informational sidebar segment */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 text-white border-4 border-slate-900 p-6 shadow-[6px_6px_0px_0px_rgba(14,116,144,1)]">
            <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
              <HelpCircle className="w-5 h-5 text-cyan-400 shrink-0" />
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Database FAQ</h3>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-slate-300">
              
              {/* FAQ 1 */}
              <div>
                <p className="font-extrabold text-white uppercase tracking-tight mb-1">
                  1. Can I run without database URL and MySQL URL?
                </p>
                <p className="font-medium text-slate-300">
                  Yes, absolutely! Out-of-the-box, the app runs using <strong className="text-amber-300">SQLite</strong> (or fallback to an embedded local JSON file). This works seamlessly on any server, requiring no credentials or external database setups whatsoever.
                </p>
              </div>

              {/* FAQ 2 */}
              <div className="pt-2 border-t border-white/5">
                <p className="font-extrabold text-white uppercase tracking-tight mb-1">
                  2. How do I get MySQL URL / Database URL?
                </p>
                <p className="font-medium text-slate-300">
                  If you deploy a MySQL / Cloud SQL server in Google Cloud, PlanetScale, or standard hosting, you'll receive a URL connection string in the format of: <code className="text-indigo-200">mysql://user:pass@host:port/dbname</code>.
                </p>
              </div>

              {/* FAQ 3 */}
              <div className="pt-2 border-t border-white/5">
                <p className="font-extrabold text-white uppercase tracking-tight mb-1">
                  3. Are connection changes permanent?
                </p>
                <p className="font-medium text-slate-300">
                  Yes! Swapping database configurations will instantly save the active settings in progress within the workspace under <code className="text-emerald-200">db_config.json</code>, keeping them completely persistent across reboots or server redeployments.
                </p>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* ----------------------------------------------------------------- */}
      {/* DATE OVERRIDE MANAGEMENT PANEL */}
      {/* ----------------------------------------------------------------- */}
      <div className="border-4 border-slate-900 bg-white p-6 md:p-8 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              Date Override Management
            </h2>
            <p className="text-xs md:text-sm font-semibold text-slate-600 max-w-xl mt-1 leading-relaxed">
              Simulate a different current date for task system logic.
            </p>
          </div>
          {dateOverride && (
             <span className="text-rose-700 font-black uppercase text-xs bg-rose-50 border-2 border-rose-900 px-3 py-1">
               Active: {dateOverride}
             </span>
           )}
        </div>
        
        <div className="flex items-center gap-4">
           <input 
              type="date"
              className="px-4 py-2 border-2 border-slate-900 text-xs font-bold bg-slate-50 focus:outline-none"
              onChange={(e) => setTempOverride(e.target.value)}
           />
           <button 
              onClick={() => handleSetOverride(tempOverride)}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-black uppercase tracking-wider border-2 border-slate-900 hover:bg-indigo-500 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
           >
              Set Override
           </button>
           {dateOverride && (
             <button
               onClick={handleClearOverride}
               className="px-4 py-2 bg-rose-600 text-white text-xs font-black uppercase tracking-wider border-2 border-slate-900 hover:bg-rose-500 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
             >
                Clear Override
             </button>
           )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* TASK CYCLE MANAGEMENT PANEL */}
      {/* ----------------------------------------------------------------- */}
      <div className="border-4 border-slate-900 bg-white p-6 md:p-8 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              Task Cycle Management
            </h2>
            <p className="text-xs md:text-sm font-semibold text-slate-600 max-w-xl mt-1 leading-relaxed">
              Manually force a reset of task cycles if tasks are stuck or require an immediate update.
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {(['daily', 'weekly', 'monthly', 'yearly', 'all'] as const).map((type) => (
            <button
              key={type}
              onClick={async () => {
                if (!confirm(`Are you sure you want to force reset all ${type} cycles? This will mark current tasks as expired and regenerate new ones.`)) return;
                try {
                  const res = await fetch('/api/tasks/cycle/reset', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ type })
                  });
                  if (res.ok) alert(`Successfully reset ${type} cycle tasks`);
                  else throw new Error('Reset failed');
                } catch (e: any) {
                  alert('Error: ' + e.message);
                }
              }}
              className="px-4 py-3 bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider border-2 border-slate-900 hover:bg-amber-400 transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none"
            >
              Reset {type}
            </button>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* AI DAILY CHECK-IN EMAIL SYSTEM PANEL */}
      {/* ----------------------------------------------------------------- */}
      <div className="border-4 border-slate-900 bg-white p-6 md:p-8 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase font-black tracking-[0.2em] text-indigo-800">
                Automated Operations
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              AI Progress Email Reports
            </h2>
            <p className="text-xs md:text-sm font-semibold text-slate-600 max-w-xl mt-1 leading-relaxed">
              Automatically compile and dispatch daily AI productivity audit reports right to your recipients' inboxes using Resend immediately following each of your check-ins.
            </p>
          </div>
          <div className="flex-shrink-0">
            <button
               type="button"
               onClick={handleTestEmail}
               disabled={isTesting || recipients.length === 0}
               className="px-4 py-2.5 bg-indigo-600 text-white border-2 border-slate-900 text-xs font-black uppercase tracking-wider hover:bg-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 transition-all cursor-pointer shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none flex items-center gap-2"
               title={recipients.length === 0 ? "Please add at least one recipient email below first" : "Trigger diagnostic Resend API delivery check"}
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Testing Resend...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Test Email (Resend)
                </>
              )}
            </button>
          </div>
        </div>

        {emailStatusMessage && (
          <div
            className={`border-3 p-4 flex gap-4 ${
              emailStatusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-950 border-emerald-900 text-emerald-950 shadow-[4px_4px_0px_0px_rgba(16,185,129,1)]'
                : 'bg-rose-50 border-rose-950 border-rose-900 text-rose-950 shadow-[4px_4px_0px_0px_rgba(244,63,94,1)]'
            }`}
          >
            <div className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider block">
                {emailStatusMessage.type === 'success' ? 'Email system notification' : 'Email system alert'}
              </span>
              <p className="text-xs font-bold">{emailStatusMessage.text}</p>
            </div>
          </div>
        )}

        {/* Dynamic Resend Server Connection configuration form */}
        <div className="border-4 border-slate-900 p-5 bg-slate-50/50 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b-2 border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-indigo-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Resend API & Sender Settings
              </h3>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 mt-0.5 leading-relaxed">
                Configure your custom Resend API credentials and verified sender domain address directly.
              </p>
            </div>
            <span className="text-indigo-800 font-extrabold uppercase tracking-wide bg-indigo-50 px-2 py-1 border-2 border-indigo-900 rounded text-[9px] sm:text-[10px] shadow-[2px_2px_0px_0px_rgba(79,70,229,1)] self-start md:self-auto">
              💡 Tip: Resend requires a verified domain to send from, or use 'onboarding@resend.dev' for your own address.
            </span>
          </div>

          <form onSubmit={handleSaveResendConfig} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">Resend API Key</label>
                <input
                  type="password"
                  placeholder={resendApiKey === '********' ? '••••••••••••••••' : 're_123456...'}
                  value={resendApiKey === '********' ? '' : resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-900 text-xs font-bold bg-white focus:outline-none focus:bg-indigo-50/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">Verified Sender Email (From)</label>
                <input
                  type="text"
                  placeholder="Productivity App <onboarding@resend.dev>"
                  value={emailFrom}
                  onChange={(e) => setEmailFrom(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-900 text-xs font-bold bg-white focus:outline-none focus:bg-indigo-50/20"
                />
              </div>

            </div>

            {resendSuccessMsg && (
              <div className="bg-emerald-50 border-2 border-emerald-900 text-emerald-950 p-2.5 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(16,185,129,1)] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>{resendSuccessMsg}</span>
              </div>
            )}

            {resendErrorMsg && (
              <div className="bg-rose-50 border-2 border-rose-900 text-rose-950 p-2.5 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(244,63,94,1)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 flex-shrink-0" />
                <span>{resendErrorMsg}</span>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSavingResend}
                className="px-4 py-2 bg-indigo-600 text-white border-2 border-slate-900 text-xs font-black uppercase hover:bg-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none flex items-center gap-1.5"
              >
                {isSavingResend ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Apply Resend Configuration
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Recipient manager */}
          <div className="space-y-4">
            <div className="border-b-2 border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">
                  Recipient Subscription List
                </h3>
                <p className="text-[10px] font-bold text-slate-400">
                  Add up to 10 verified recipient emails for automatic reporting:
                </p>
              </div>
              <span className="bg-indigo-100 text-indigo-900 text-[10px] font-black border-2 border-indigo-900 px-2 py-0.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                {recipients.length} / 10
              </span>
            </div>

            {/* Email form */}
            <form onSubmit={handleAddEmail} className="flex gap-2">
              <input
                type="email"
                placeholder="coachee@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={isSavingRecipients || recipients.length >= 10}
                className="flex-1 px-3 py-2 border-2 border-slate-900 text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none placeholder-slate-400 disabled:bg-slate-100"
              />
              <button
                type="submit"
                disabled={isSavingRecipients || recipients.length >= 10 || !newEmail.trim()}
                className="px-4 py-2 bg-indigo-600 text-white border-2 border-slate-900 text-xs font-black uppercase hover:bg-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none"
              >
                Add
              </button>
            </form>

            {/* Recipients list */}
            {recipients.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-slate-200">
                <p className="text-xs font-bold text-slate-400">No recipients configured. Periodic email reports will be skipped.</p>
              </div>
            ) : (
              <div className="border-2 border-slate-900 divide-y-2 divide-slate-200 h-64 overflow-y-auto">
                {recipients.map((email) => (
                  <div key={email} className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-50">
                    <span className="text-xs font-bold text-slate-800">{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(email)}
                      disabled={isSavingRecipients}
                      className="px-2 py-1 border-2 border-slate-900 hover:bg-rose-50 text-[10px] font-black uppercase tracking-tight text-rose-700 hover:text-rose-950 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Failed email queue inspector & retrier */}
          <div className="space-y-4">
            <div className="border-b-2 border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">
                  Failed Email Delivery Queue
                </h3>
                <p className="text-[10px] font-bold text-slate-400">
                  Transmissions stored for manual retry / automatic storage check:
                </p>
              </div>
              <button
                type="button"
                onClick={handleRetryEmails}
                disabled={isRetrying || failedEmails.filter(e => e.status === 'pending').length === 0}
                className="px-3 py-1 bg-amber-500 text-slate-950 border-2 border-slate-900 text-[10px] font-black uppercase hover:bg-amber-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none flex items-center gap-1"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    Retry Pending ({failedEmails.filter(e => e.status === 'pending').length})
                  </>
                )}
              </button>
            </div>

            {failedEmails.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200">
                <p className="text-xs font-bold text-slate-400">Pristine storage. No unsent emails currently in the queue.</p>
              </div>
            ) : (
              <div className="border-2 border-slate-900 divide-y-2 divide-slate-200 h-72 overflow-y-auto">
                {failedEmails.map((mail) => (
                  <div key={mail.id} className="p-3 bg-slate-50/30 hover:bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 block truncate max-w-[70%]">
                        To: {mail.to.join(', ')}
                      </span>
                      <span className={`text-[9px] font-black uppercase border border-slate-900 px-1.5 py-0.5 ${
                        mail.status === 'failed' 
                          ? 'bg-rose-100 text-rose-800' 
                          : mail.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {mail.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900 truncate">{mail.subject}</p>
                      {mail.error && (
                        <p className="text-[10px] font-semibold text-rose-600 bg-rose-50/50 p-1.5 border border-rose-200 rounded mt-1 overflow-x-auto whitespace-pre-wrap font-mono">
                          Error: {mail.error}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-black text-slate-400">
                      <span>Retries: {mail.retryCount} / 3</span>
                      <span>{new Date(mail.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
