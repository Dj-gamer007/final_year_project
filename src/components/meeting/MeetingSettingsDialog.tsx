import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Languages } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { RECOGNITION_LANGUAGES } from "@/hooks/useSpeechRecognition";

interface MeetingSettingsDialogProps {
  noiseReductionEnabled: boolean;
  onNoiseReductionChange: (enabled: boolean) => void;
  recognitionLanguage: string;
  onRecognitionLanguageChange: (lang: string) => void;
}

const MeetingSettingsDialog = ({
  noiseReductionEnabled,
  onNoiseReductionChange,
  recognitionLanguage,
  onRecognitionLanguageChange,
}: MeetingSettingsDialogProps) => {
  const [open, setOpen] = useState(false);

  const selectedLang = RECOGNITION_LANGUAGES.find(l => l.code === recognitionLanguage);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          variant="outline"
          className="rounded-full w-14 h-14"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Meeting Settings</DialogTitle>
          <DialogDescription>
            Configure audio and transcription settings for this meeting.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Speech Recognition Language */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-base font-medium">
                <Languages className="w-4 h-4" />
                Transcription Language
              </Label>
              <p className="text-sm text-muted-foreground">
                Choose the language you'll be speaking in for live transcription
              </p>
              <Select value={recognitionLanguage} onValueChange={onRecognitionLanguageChange}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {selectedLang ? (
                      <span>{selectedLang.name} ({selectedLang.nativeName})</span>
                    ) : "Select language"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {RECOGNITION_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <div className="flex items-center gap-2">
                        <span>{lang.name}</span>
                        <span className="text-muted-foreground text-xs">({lang.nativeName})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Noise Reduction Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="noise-reduction" className="text-base font-medium">
                  Noise Reduction
                </Label>
                <p className="text-sm text-muted-foreground">
                  Filter background noise for clearer transcription
                </p>
              </div>
              <Switch
                id="noise-reduction"
                checked={noiseReductionEnabled}
                onCheckedChange={onNoiseReductionChange}
              />
            </div>
          </div>
          
          <Separator />
          
          {/* Info */}
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">How it works:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>High-pass filter removes low-frequency rumble</li>
              <li>Low-pass filter reduces high-frequency hiss</li>
              <li>Compression normalizes volume levels</li>
              <li>Notch filter removes electrical hum</li>
            </ul>
            <p className="mt-3 text-xs">
              Best for noisy environments. Disable if you're in a quiet room for faster processing.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingSettingsDialog;
