import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "none", name: "Original", nativeName: "No Translation" },
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "pl", name: "Polish", nativeName: "Polski" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "th", name: "Thai", nativeName: "ไทย" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "sv", name: "Swedish", nativeName: "Svenska" },
];

interface TranslationSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  isTranslating?: boolean;
  compact?: boolean;
}

const TranslationSelector = ({
  selectedLanguage,
  onLanguageChange,
  isTranslating = false,
  compact = false,
}: TranslationSelectorProps) => {
  const selectedLang = SUPPORTED_LANGUAGES.find(
    (l) => l.code === selectedLanguage
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {isTranslating ? (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        ) : (
          <Globe className="w-4 h-4 text-muted-foreground" />
        )}
        <Select value={selectedLanguage} onValueChange={onLanguageChange}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue>
              {selectedLang?.name || "Select language"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code} className="text-sm">
                <div className="flex items-center gap-2">
                  <span>{lang.name}</span>
                  {lang.code !== "none" && (
                    <span className="text-muted-foreground text-xs">
                      ({lang.nativeName})
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Globe className="w-4 h-4" />
        Translation
        {isTranslating && (
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
        )}
      </Label>
      <Select value={selectedLanguage} onValueChange={onLanguageChange}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {selectedLang ? (
              <div className="flex items-center gap-2">
                <span>{selectedLang.name}</span>
                {selectedLang.code !== "none" && (
                  <span className="text-muted-foreground text-xs">
                    ({selectedLang.nativeName})
                  </span>
                )}
              </div>
            ) : (
              "Select language"
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <div className="flex items-center gap-2">
                <span>{lang.name}</span>
                {lang.code !== "none" && (
                  <span className="text-muted-foreground text-xs">
                    ({lang.nativeName})
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default TranslationSelector;
