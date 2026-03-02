import React from 'react';

export default function Layout({ children, currentPageName }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Cinzel:wght@400;600;700&display=swap');
        
        body { background: #0a0a0f; }
        
        .font-serif { font-family: 'IM Fell English', Georgia, serif; }
        
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1a1a2e; }
        ::-webkit-scrollbar-thumb { background: #4a3728; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #6b5240; }

        * { scrollbar-width: thin; scrollbar-color: #4a3728 #1a1a2e; }
      `}</style>
      {children}
    </div>
  );
}