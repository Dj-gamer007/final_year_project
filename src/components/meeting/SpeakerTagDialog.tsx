import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserCog, Save, X } from "lucide-react";
import { Speaker } from "@/hooks/useSpeakerIdentification";

interface SpeakerTagDialogProps {
  speakers: Speaker[];
  onUpdateSpeaker: (speakerId: string, newName: string) => void;
}

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const SpeakerTagDialog = ({ speakers, onUpdateSpeaker }: SpeakerTagDialogProps) => {
  const [open, setOpen] = useState(false);
  const [editingNames, setEditingNames] = useState<Map<string, string>>(new Map());

  const handleNameChange = (speakerId: string, value: string) => {
    setEditingNames(prev => {
      const newMap = new Map(prev);
      newMap.set(speakerId, value);
      return newMap;
    });
  };

  const handleSave = (speakerId: string, originalName: string) => {
    const newName = editingNames.get(speakerId);
    if (newName !== undefined && newName !== originalName) {
      onUpdateSpeaker(speakerId, newName);
    }
    setEditingNames(prev => {
      const newMap = new Map(prev);
      newMap.delete(speakerId);
      return newMap;
    });
  };

  const handleCancel = (speakerId: string) => {
    setEditingNames(prev => {
      const newMap = new Map(prev);
      newMap.delete(speakerId);
      return newMap;
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserCog className="w-4 h-4" />
          Tag Speakers
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Speaker Identification</DialogTitle>
          <DialogDescription>
            Manually tag or rename speakers to improve transcript accuracy.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {speakers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No speakers detected yet. Start speaking to see participants.
              </p>
            ) : (
              speakers.map((speaker) => {
                const isEditing = editingNames.has(speaker.id);
                const displayName = isEditing 
                  ? editingNames.get(speaker.id) 
                  : speaker.name;
                
                return (
                  <div 
                    key={speaker.id} 
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className={`w-10 h-10 rounded-full ${speaker.color} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-sm font-medium">
                        {getInitials(speaker.name)}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <Input
                            value={displayName}
                            onChange={(e) => handleNameChange(speaker.id, e.target.value)}
                            className="h-8"
                            placeholder="Enter speaker name"
                            autoFocus
                          />
                        ) : (
                          <div 
                            className="flex-1 cursor-pointer hover:bg-muted rounded px-2 py-1 -mx-2"
                            onClick={() => handleNameChange(speaker.id, speaker.name)}
                          >
                            <span className="font-medium">{speaker.name}</span>
                            {speaker.isLocal && (
                              <span className="ml-2 text-xs text-primary">(You)</span>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        ID: {speaker.id.slice(0, 8)}...
                      </p>
                    </div>

                    {isEditing && (
                      <div className="flex gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8"
                          onClick={() => handleSave(speaker.id, speaker.name)}
                        >
                          <Save className="w-4 h-4 text-green-500" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8"
                          onClick={() => handleCancel(speaker.id)}
                        >
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="text-xs text-muted-foreground mt-2">
          Click on a speaker name to edit it. Changes are saved per session.
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SpeakerTagDialog;
