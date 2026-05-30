import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, Trash2, Save, X, Loader2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const BIOME_OPTIONS = [
  'Plains', 'Forest', 'Mountain', 'Hill', 'Swamp', 'Desert', 
  'Coastal', 'Underground', 'Arctic', 'Urban', 'Aquatic', 'Sky'
];

const STAT_FIELDS = [
  { key: 'str', label: 'Strength' },
  { key: 'dex', label: 'Dexterity' },
  { key: 'con', label: 'Constitution' },
  { key: 'int', label: 'Intelligence' },
  { key: 'wis', label: 'Wisdom' },
  { key: 'cha', label: 'Charisma' }
];

export default function CustomBestiary() {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMonster, setEditingMonster] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedBiomes, setSelectedBiomes] = useState([]);
  
  const queryClient = useQueryClient();

  const { data: monsters, isLoading } = useQuery({
    queryKey: ['customMonsters'],
    queryFn: () => base44.entities.CustomMonster.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('createCustomMonster', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customMonsters'] });
      setShowForm(false);
      setEditingMonster(null);
      toast.success(editingMonster ? 'Monster updated' : 'Monster created');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save monster');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomMonster.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customMonsters'] });
      toast.success('Monster deleted');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Convert stats to numbers
    STAT_FIELDS.forEach(field => {
      data[field.key] = parseInt(data[field.key]) || 10;
    });
    
    data.biomes = selectedBiomes.join(', ');
    
    if (editingMonster) {
      data.id = editingMonster.id;
    }
    
    createMutation.mutate(data);
  };

  const handleEdit = (monster) => {
    setEditingMonster(monster);
    setShowForm(true);
    if (monster.biomes) {
      setSelectedBiomes(monster.biomes.split(', ').map(b => b.trim()));
    }
  };

  const handleDelete = (monster) => {
    if (confirm(`Delete ${monster.name}?`)) {
      deleteMutation.mutate(monster.id);
    }
  };

  const filteredMonsters = monsters?.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.meta && m.meta.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-fantasy font-bold text-foreground flex items-center gap-3">
              <BookOpen className="w-8 h-8" />
              Custom Bestiary
            </h1>
            <p className="text-muted-foreground mt-1">
              Create and manage your unique monster templates
            </p>
          </div>
          <Button
            onClick={() => {
              setShowForm(true);
              setEditingMonster(null);
              setSelectedBiomes([]);
            }}
            className="btn-fantasy"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Monster
          </Button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search monsters by name or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-fantasy"
            />
          </div>
        </div>

        {/* Monster List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMonsters.map((monster) => (
              <Card key={monster.id} className="fantasy-card glass-panel">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="font-fantasy text-lg">{monster.name}</CardTitle>
                      {monster.meta && (
                        <p className="text-xs text-muted-foreground mt-1">{monster.meta}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(monster)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(monster)}
                        className="h-8 w-8 p-0 text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AC:</span>
                      <span>{monster.armor_class}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">HP:</span>
                      <span>{monster.hit_points}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Challenge:</span>
                      <Badge variant="outline">{monster.challenge}</Badge>
                    </div>
                    {monster.biomes && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {monster.biomes.split(', ').slice(0, 3).map((biome, i) => (
                          <Badge key={i} className="badge-gold text-xs">{biome}</Badge>
                        ))}
                        {monster.biomes.split(', ').length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{monster.biomes.split(', ').length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filteredMonsters.length === 0 && !isLoading && (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? 'No monsters found' : 'No custom monsters yet. Create your first!'}
            </p>
          </div>
        )}

        {/* Create/Edit Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
              onClick={() => setShowForm(false)}
            >
              <motion.div
                initial={{ scale: 0.92 }}
                animate={{ scale: 1 }}
                className="relative w-full max-w-4xl rounded-2xl overflow-hidden"
                style={{ border: '1px solid rgba(201,169,110,0.3)', background: '#0d0a07', maxHeight: '92vh' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: '1px solid rgba(180,140,90,0.12)', background: 'rgba(15,10,4,0.9)' }}>
                  <h2 className="font-fantasy text-lg" style={{ color: '#c9a96e' }}>
                    {editingMonster ? 'Edit Custom Monster' : 'Create Custom Monster'}
                  </h2>
                  <button onClick={() => setShowForm(false)} style={{ color: 'rgba(201,169,110,0.4)' }}>
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 140px)' }}>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <Tabs defaultValue="basic">
                      <TabsList className="grid w-full grid-cols-4 mb-4">
                        <TabsTrigger value="basic">Basic Info</TabsTrigger>
                        <TabsTrigger value="stats">Ability Scores</TabsTrigger>
                        <TabsTrigger value="combat">Combat</TabsTrigger>
                        <TabsTrigger value="details">Details</TabsTrigger>
                      </TabsList>

                      <TabsContent value="basic" className="space-y-4">
                        <div>
                          <Label>Monster Name *</Label>
                          <Input
                            name="name"
                            defaultValue={editingMonster?.name}
                            placeholder="e.g., Shadow Dragon"
                            className="input-fantasy"
                            required
                          />
                        </div>
                        <div>
                          <Label>Meta Description</Label>
                          <Input
                            name="meta"
                            defaultValue={editingMonster?.meta}
                            placeholder="e.g., Large dragon, chaotic evil"
                            className="input-fantasy"
                          />
                        </div>
                        <div>
                          <Label>Description & Lore</Label>
                          <Textarea
                            name="description"
                            defaultValue={editingMonster?.description}
                            placeholder="Full monster description, behavior, habitat..."
                            rows={4}
                            className="input-fantasy"
                          />
                        </div>
                        <div>
                          <Label>Habitats (Biomes)</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {BIOME_OPTIONS.map((biome) => (
                              <Badge
                                key={biome}
                                role="button"
                                onClick={() => {
                                  setSelectedBiomes(prev =>
                                    prev.includes(biome)
                                      ? prev.filter(b => b !== biome)
                                      : [...prev, biome]
                                  );
                                }}
                                className={
                                  selectedBiomes.includes(biome)
                                    ? 'badge-gold cursor-pointer'
                                    : 'badge-green cursor-pointer opacity-50'
                                }
                              >
                                {biome}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="stats" className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          {STAT_FIELDS.map((field) => (
                            <div key={field.key}>
                              <Label>{field.label}</Label>
                              <Input
                                name={field.key}
                                type="number"
                                min="1"
                                max="30"
                                defaultValue={editingMonster?.[field.key] || 10}
                                className="input-fantasy"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Armor Class</Label>
                            <Input
                              name="armor_class"
                              defaultValue={editingMonster?.armor_class || '10'}
                              className="input-fantasy"
                            />
                          </div>
                          <div>
                            <Label>Hit Points</Label>
                            <Input
                              name="hit_points"
                              defaultValue={editingMonster?.hit_points || '10'}
                              placeholder="e.g., 52 (8d8 + 16)"
                              className="input-fantasy"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Speed</Label>
                          <Input
                            name="speed"
                            defaultValue={editingMonster?.speed || '30 ft.'}
                            placeholder="e.g., 30 ft., fly 60 ft."
                            className="input-fantasy"
                          />
                        </div>
                        <div>
                          <Label>Saving Throws</Label>
                          <Input
                            name="saving_throws"
                            defaultValue={editingMonster?.saving_throws}
                            placeholder="e.g., Dex +5, Wis +3"
                            className="input-fantasy"
                          />
                        </div>
                        <div>
                          <Label>Skills</Label>
                          <Input
                            name="skills"
                            defaultValue={editingMonster?.skills}
                            placeholder="e.g., Perception +6, Stealth +8"
                            className="input-fantasy"
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="combat" className="space-y-4">
                        <div>
                          <Label>Damage Resistances</Label>
                          <Input
                            name="damage_resistances"
                            defaultValue={editingMonster?.damage_resistances}
                            placeholder="e.g., fire, cold"
                            className="input-fantasy"
                          />
                        </div>
                        <div>
                          <Label>Damage Immunities</Label>
                          <Input
                            name="damage_immunities"
                            defaultValue={editingMonster?.damage_immunities}
                            className="input-fantasy"
                          />
                        </div>
                        <div>
                          <Label>Condition Immunities</Label>
                          <Input
                            name="condition_immunities"
                            defaultValue={editingMonster?.condition_immunities}
                            className="input-fantasy"
                          />
                        </div>
                        <div>
                          <Label>Senses</Label>
                          <Input
                            name="senses"
                            defaultValue={editingMonster?.senses}
                            placeholder="e.g., darkvision 60 ft."
                            className="input-fantasy"
                          />
                        </div>
                        <div>
                          <Label>Languages</Label>
                          <Input
                            name="languages"
                            defaultValue={editingMonster?.languages}
                            className="input-fantasy"
                          />
                        </div>
                        <div>
                          <Label>Challenge Rating</Label>
                          <Input
                            name="challenge"
                            defaultValue={editingMonster?.challenge}
                            placeholder="e.g., 5 (1,800 XP)"
                            className="input-fantasy"
                          />
                        </div>
                        <div>
                          <Label>Traits & Abilities</Label>
                          <Textarea
                            name="traits"
                            defaultValue={editingMonster?.traits}
                            rows={4}
                            className="input-fantasy"
                          />
                        </div>
                        <div>
                          <Label>Actions</Label>
                          <Textarea
                            name="actions"
                            defaultValue={editingMonster?.actions}
                            rows={4}
                            className="input-fantasy"
                          />
                        </div>
                        <div>
                          <Label>Legendary Actions</Label>
                          <Textarea
                            name="legendary_actions"
                            defaultValue={editingMonster?.legendary_actions}
                            rows={3}
                            className="input-fantasy"
                          />
                        </div>
                        <div>
                          <Label>Reactions</Label>
                          <Textarea
                            name="reactions"
                            defaultValue={editingMonster?.reactions}
                            rows={3}
                            className="input-fantasy"
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="details" className="space-y-4">
                        <div>
                          <Label>Loot</Label>
                          <Textarea
                            name="loot"
                            defaultValue={editingMonster?.loot}
                            placeholder="Typical treasure or items dropped"
                            rows={3}
                            className="input-fantasy"
                          />
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowForm(false)}
                        className="btn-fantasy"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="btn-fantasy"
                      >
                        {createMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            {editingMonster ? 'Update Monster' : 'Create Monster'}
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}