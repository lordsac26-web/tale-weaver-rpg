import React, { useState } from 'react';
import { Upload, Loader2, X, Box } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// ─── GLB Model Upload Widget ──────────────────────────────────────────────────
// Allows uploading .glb files and returns the hosted URL

export default function ModelUploader({ label, currentUrl, onUrlChange, accentColor = '#c9a96e' }) {
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['.glb', '.gltf'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!validTypes.includes(ext)) {
      alert('Please upload a .glb or .gltf file');
      return;
    }

    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onUrlChange(file_url);
    setUploading(false);
  };

  const handleClear = () => {
    onUrlChange(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.45)', letterSpacing: '0.08em' }}>
        {label}
      </div>

      {currentUrl ? (
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
          style={{ background: 'rgba(18,10,3,0.8)', border: `1px solid ${accentColor}44` }}>
          <Box className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentColor }} />
          <span className="text-xs truncate flex-1" style={{ color: '#e8d5b7', fontFamily: 'EB Garamond, serif' }}>
            Custom model loaded
          </span>
          <button onClick={handleClear}
            className="p-0.5 rounded hover:opacity-80 transition-opacity flex-shrink-0"
            style={{ color: 'rgba(201,169,110,0.4)' }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all hover:border-opacity-60"
          style={{
            background: 'rgba(18,10,3,0.6)',
            border: '1px dashed rgba(180,140,90,0.25)',
          }}>
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: accentColor }} />
          ) : (
            <Upload className="w-3.5 h-3.5" style={{ color: 'rgba(201,169,110,0.35)' }} />
          )}
          <span className="text-xs" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
            {uploading ? 'Uploading…' : 'Upload .glb file'}
          </span>
          <input type="file" accept=".glb,.gltf" onChange={handleFileSelect} className="hidden" disabled={uploading} />
        </label>
      )}
    </div>
  );
}