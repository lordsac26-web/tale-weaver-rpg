import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Upload, Wand2, Loader2, Play, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const SETTINGS = ['High Fantasy', 'Dark Fantasy', 'Sci-Fi', 'Cyberpunk', 'Historical', 'Anime', 'Real World'];
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const TIMES = ['Dawn', 'Morning', 'Midday', 'Afternoon', 'Dusk', 'Evening', 'Night', 'Midnight'];

export default function NewGame() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedCharId = urlParams.get('character_id');

  const [characters, setCharacters] = useState([]);
  const [selectedChar, setSelectedChar] = useState(preselectedCharId || '');
  const [title, setTitle] = useState('');
  const [setting, setSetting] = useState('High Fantasy');
  const [adultMode, setAdultMode] = useState(false);
  const [storySeed, setStorySeed] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [storySeedFileUrl, setStorySeedFileUrl] = useState('');
  const [season, setSeason] = useState('Spring');
  const [timeOfDay, setTimeOfDay] = useState('Morning');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    base44.entities.Character.list('-updated_date', 20).then(chars => {
      setCharacters(chars.filter(c => c.is_active));
    });
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingFile(true);
    const result = await base44.integrations.Core.UploadFile({ file });
    setStorySeedFileUrl(result.file_url);
    setStorySeed(prev => prev + `\n[Story file uploaded: ${file.name}]`);
    setUploadingFile(false);
  };

  const handleStart = async () => {
    if (!selectedChar) return;
    setStarting(true);
    const char = characters.find(c => c.id === selectedChar);
    const session = await base44.entities.GameSession.create({
      character_id: selectedChar,
      title: title || `${char?.name || 'Hero'}'s Adventure`,
      setting, adult_mode: adultMode, story_seed: storySeed,
      story_seed_file_url: storySeedFileUrl,
      season, time_of_day: timeOfDay,
      current_location: 'The Crossroads Inn',
      world_state: {}, active_quests: [], completed_quests: [],
      story_log: [], npc_relations: {}, reputation: 0,
      alignment_tracker: {}, in_combat: false, combat_state: {},
      chapter: 1, plot_flags: {}, environmental_modifiers: [],
      is_active: true
    });
    navigate(createPageUrl('Game') + `?session_id=${session.id}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-amber-100">
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0d0a1a] to-[#0a0a0f] pointer-events-none" />
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(createPageUrl('Home'))} className="text-amber-400/60 hover:text-amber-400">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold text-amber-300 flex items-center gap-3">
            <BookOpen className="w-7 h-7" /> Begin Your Adventure
          </h1>
        </div>

        <div className="space-y-6">
          {/* Character Selection */}
          <Section title="Choose Your Hero" icon="⚔️">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {characters.map(char => (
                <button key={char.id} onClick={() => setSelectedChar(char.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedChar === char.id
                      ? 'border-amber-500 bg-amber-900/30'
                      : 'border-slate-700/50 bg-slate-800/30 hover:border-amber-700/50'
                  }`}>
                  <div className="font-bold text-amber-200">{char.name}</div>
                  <div className="text-amber-400/60 text-sm">Lv.{char.level} {char.race} {char.class}</div>
                  <div className="text-slate-400 text-xs mt-1">HP: {char.hp_current}/{char.hp_max} · AC: {char.armor_class}</div>
                </button>
              ))}
              {characters.length === 0 && (
                <div className="text-slate-500 col-span-2 text-center py-4">
                  No characters yet. <button className="text-amber-400 underline" onClick={() => navigate(createPageUrl('CharacterCreation'))}>Create one first.</button>
                </div>
              )}
            </div>
          </Section>

          {/* Campaign Title */}
          <Section title="Campaign Title" icon="📜">
            <Input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Give your adventure a name (or leave blank for auto-generated)..."
              className="bg-slate-800/60 border-slate-600 text-amber-100 placeholder-slate-500" />
          </Section>

          {/* Setting */}
          <Section title="World Setting" icon="🌍">
            <div className="flex flex-wrap gap-2">
              {SETTINGS.map(s => (
                <button key={s} onClick={() => setSetting(s)}
                  className={`px-4 py-2 rounded-lg text-sm border transition-all ${setting === s ? 'border-purple-500 bg-purple-900/30 text-purple-200' : 'border-slate-700/50 text-slate-400 hover:border-purple-700/50'}`}>
                  {s}
                </button>
              ))}
            </div>
          </Section>

          {/* World State */}
          <Section title="World State" icon="🌤️">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-amber-400/60 text-xs mb-2 block">Season</label>
                <div className="flex flex-wrap gap-2">
                  {SEASONS.map(s => (
                    <button key={s} onClick={() => setSeason(s)}
                      className={`px-3 py-1 rounded-lg text-xs border transition-all ${season === s ? 'border-amber-500 bg-amber-900/30 text-amber-200' : 'border-slate-700/50 text-slate-400'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-amber-400/60 text-xs mb-2 block">Time of Day</label>
                <div className="flex flex-wrap gap-2">
                  {TIMES.map(t => (
                    <button key={t} onClick={() => setTimeOfDay(t)}
                      className={`px-3 py-1 rounded-lg text-xs border transition-all ${timeOfDay === t ? 'border-blue-500 bg-blue-900/30 text-blue-200' : 'border-slate-700/50 text-slate-400'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Story Seed */}
          <Section title="Story Seed (Optional)" icon="🌱">
            <Textarea value={storySeed} onChange={e => setStorySeed(e.target.value)}
              placeholder="Give the AI a story direction... e.g. 'A mysterious plague is spreading through the kingdom. The king has gone silent. Dark forces stir in the eastern woods...'"
              className="bg-slate-800/60 border-slate-600 text-amber-100 placeholder-slate-500 h-28 mb-3" />
            <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${uploadingFile ? 'border-amber-700/50 bg-amber-900/20' : 'border-slate-700/50 bg-slate-800/30 hover:border-amber-700/50'}`}>
              <Upload className="w-5 h-5 text-amber-400" />
              <span className="text-amber-300 text-sm">{uploadingFile ? 'Uploading...' : storySeedFileUrl ? 'File uploaded ✓' : 'Upload a story file (.txt, .pdf, .docx)'}</span>
              <input type="file" accept=".txt,.pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
            </label>
          </Section>

          {/* Adult Mode */}
          <Section title="Content Settings" icon="⚠️">
            <button onClick={() => setAdultMode(prev => !prev)}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all w-full text-left ${adultMode ? 'border-red-500/60 bg-red-900/20' : 'border-slate-700/50 bg-slate-800/30 hover:border-red-700/30'}`}>
              <div className={`w-10 h-6 rounded-full transition-colors relative ${adultMode ? 'bg-red-600' : 'bg-slate-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${adultMode ? 'left-5' : 'left-1'}`} />
              </div>
              <div>
                <div className="font-medium text-amber-200">18+ Mature Mode</div>
                <div className="text-slate-400 text-xs">Enables stronger language, graphic violence, and adult themes</div>
              </div>
            </button>
          </Section>

          {/* Start */}
          <Button onClick={handleStart} disabled={!selectedChar || starting}
            className="w-full py-4 text-lg bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-bold rounded-xl">
            {starting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2" />}
            {starting ? 'Weaving your world...' : 'Begin Adventure'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6">
      <h2 className="text-lg font-bold text-amber-300 mb-4 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h2>
      {children}
    </div>
  );
}