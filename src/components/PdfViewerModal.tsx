import React from 'react';
import { X, ExternalLink, Download, BookOpen, ChevronRight, FileText } from 'lucide-react';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPage?: number;
}

const CHAPTER_PAGES = [
  { name: 'Chapter 1: Wiring in Steel & PVC Conduit', page: 20 },
  { name: 'Chapter 2: MCCB, MCB & DBs', page: 32 },
  { name: 'Chapter 3: Rising Mains & Bus Trunking', page: 38 },
  { name: 'Chapter 4: Cable Trays', page: 44 },
  { name: 'Chapter 5: Earthing', page: 50 },
  { name: 'Chapter 6: Lightning Conductor', page: 54 },
  { name: 'Chapter 7: Lighting Controls', page: 56 },
  { name: 'Chapter 8: LED Light', page: 58 },
  { name: 'Chapter 9: BLDC Fan', page: 84 },
  { name: 'Chapter 10: MV Cable Laying', page: 86 },
  { name: 'Chapter 11: MV Cable Jointing', page: 90 },
  { name: 'Chapter 12: Pole Erection', page: 94 },
  { name: 'Chapter 13: MV Overhead Line', page: 96 },
  { name: 'Chapter 16: Solar Water Heating', page: 110 },
  { name: 'Chapter 17: Solar PV Power Generation', page: 114 },
  { name: 'Chapter 18: EV Charger', page: 118 },
  { name: 'Chapter 19: Façade Lighting', page: 122 },
  { name: 'Chapter 20: Fountain', page: 130 },
  { name: 'Chapter 21: Passenger Lifts', page: 136 },
  { name: 'Chapter 22: HT Cable Laying', page: 142 },
  { name: 'Chapter 24: Transformer', page: 148 },
  { name: 'Chapter 25: APFC Panel', page: 214 },
  { name: 'Chapter 26: UPS', page: 220 },
  { name: 'Chapter 27: Wet Riser & Sprinkler', page: 224 },
  { name: 'Chapter 28: Fire Detection & Alarm', page: 240 },
  { name: 'Chapter 29: DG Set', page: 248 },
  { name: 'Chapter 30: HVAC Piping & Ducting', page: 254 },
  { name: 'Chapter 31: VRV / VRF', page: 266 },
  { name: 'Chapter 33: Chillers', page: 282 },
  { name: 'Chapter 39: LAN / Networking', page: 306 },
  { name: 'Chapter 40: CCTV Camera System', page: 318 },
  { name: 'Appendix I: Basic Labour Rates (1001-1087)', page: 354 },
  { name: 'Appendix II: Basic Material Rates (1101-5347)', page: 356 },
];

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  targetPage = 20,
}) => {
  const [activePage, setActivePage] = React.useState<number>(targetPage);

  React.useEffect(() => {
    if (targetPage) setActivePage(targetPage);
  }, [targetPage]);

  if (!isOpen) return null;

  const pdfUrl = `/assets/aistudio/DSR_EM_2025_ada23f2c.pdf#page=${activePage}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/65 dark:bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden"
        role="dialog"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/10 border border-purple-300 dark:border-purple-500/30 flex items-center justify-center text-purple-700 dark:text-purple-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                CPWD Delhi Schedule of Rates (E&amp;M) 2025
                <span className="text-xs font-normal text-slate-600 dark:text-slate-400">
                  (Official Source PDF)
                </span>
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Data extraction commences strictly from Chapter 1 (Page 20). Pages 1–19 are introductory.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/assets/aistudio/DSR_EM_2025_ada23f2c.pdf"
              download="CPWD_DSR_EM_2025.pdf"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white text-xs border border-slate-300 dark:border-slate-700 transition-colors font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content with sidebar chapter quick jump + iframe */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Quick Chapter Navigation Sidebar */}
          <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-3 overflow-y-auto space-y-1 text-xs shrink-0 max-h-48 md:max-h-none">
            <span className="text-[10px] uppercase font-bold text-slate-500 block px-2 mb-2">
              Jump to Chapter / Appendix
            </span>
            {CHAPTER_PAGES.map((ch) => (
              <button
                key={ch.page}
                onClick={() => setActivePage(ch.page)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between text-xs ${
                  activePage === ch.page
                    ? 'bg-emerald-100 dark:bg-emerald-600/20 text-emerald-900 dark:text-emerald-300 font-semibold border border-emerald-400 dark:border-emerald-500/30'
                    : 'text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-900'
                }`}
              >
                <span className="truncate mr-2">{ch.name}</span>
                <span className="font-mono text-[10px] text-slate-500 shrink-0">p.{ch.page}</span>
              </button>
            ))}
          </div>

          {/* PDF Preview Frame */}
          <div className="flex-1 bg-slate-200 dark:bg-slate-950 relative flex flex-col">
            <iframe
              src={pdfUrl}
              title="CPWD DSR EM 2025 PDF"
              className="w-full h-full border-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
