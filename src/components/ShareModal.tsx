import React, { useState } from 'react';
import { 
  X, 
  Globe, 
  HardDrive, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  Info, 
  FolderUp, 
  ShieldCheck,
  Share2
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sharedUrl: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  sharedUrl,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(sharedUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleDownloadStandalone = () => {
    const link = document.createElement('a');
    link.href = '/CPWD_DSR_2025_Standalone_App.html';
    link.download = 'CPWD_DSR_EM_2025_Rate_Finder.html';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 border border-blue-300 dark:border-blue-500/30 flex items-center justify-center text-blue-700 dark:text-blue-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="share-modal-title" className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                Web App Hosting &amp; Google Drive Guide
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Access your live hosted link or save the standalone web app directly to Google Drive.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm flex-1">
          {/* Section 1: Live Cloud URL (Already Hosted) */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-xs sm:text-sm">
                <Globe className="w-4 h-4" />
                <span>1. Live Hosted URL (Recommended - Already Live!)</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Live &amp; Accessible 24/7
              </span>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              This web app is <strong>already hosted live on Google Cloud</strong> with HTTPS. You do not need any hosting setup; anyone with this link can open and use the application on mobile, tablet, or desktop:
            </p>

            {/* URL bar with Copy button */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-lg p-2">
              <input
                type="text"
                readOnly
                value={sharedUrl}
                className="bg-transparent text-xs text-slate-900 dark:text-slate-200 font-mono flex-1 outline-none truncate"
              />
              <button
                onClick={handleCopyUrl}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
              <a
                href={sharedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Section 2: Google Drive Notice & Standalone File */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-semibold text-xs sm:text-sm">
              <HardDrive className="w-4 h-4" />
              <span>2. Storing &amp; Running the App from Google Drive</span>
            </div>

            {/* Info note about Google Drive web hosting deprecation */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/50 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200/90 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-950 dark:text-white block font-semibold mb-0.5">
                  About Google Drive Web Hosting:
                </strong>
                Google deprecated direct website hosting from Google Drive in 2016 (drive web server links like <code className="text-amber-800 dark:text-amber-300 font-mono text-[11px]">googledrive.com/host/...</code> were sunset). Drive does not execute web server backends.
              </div>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              However, you can store the <strong>complete standalone offline web app</strong> as a single self-contained HTML file in your Google Drive:
            </p>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-mono text-xs font-bold text-slate-950 dark:text-white block">
                  CPWD_DSR_EM_2025_Rate_Finder.html
                </span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  Single-file bundle • All 2,674 items, variants, tags &amp; BOQ engine embedded • Runs offline
                </span>
              </div>
              <button
                onClick={handleDownloadStandalone}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shrink-0 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download for GDrive</span>
              </button>
            </div>

            {/* How to use with Google Drive */}
            <div className="space-y-1.5 pt-1 text-xs text-slate-700 dark:text-slate-300">
              <span className="font-semibold text-slate-950 dark:text-white block">
                How to use with your Google Drive:
              </span>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400 pl-1 text-[11px] sm:text-xs">
                <li>Click <strong>Download for GDrive</strong> above to get the single-file <code className="text-slate-900 dark:text-slate-300 font-mono">.html</code> app.</li>
                <li>Open <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-700 dark:text-blue-400 hover:underline">Google Drive</a> and drag &amp; drop the file into your preferred folder.</li>
                <li>Right-click the file in Google Drive &gt; <em>Share</em> to share it with your team.</li>
                <li>Anyone with the file can open it in any browser (Chrome, Edge, Safari) and use the full Rate Finder &amp; BOQ estimator completely offline!</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-900 dark:text-white bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-300 dark:border-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
