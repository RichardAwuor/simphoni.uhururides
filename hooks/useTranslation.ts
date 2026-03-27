import { useProfile } from '@/contexts/ProfileContext';
import { translations, Language, TranslationKey } from '@/constants/translations';

export function useTranslation() {
  const { profile } = useProfile();
  const lang: Language = (profile?.language as Language) || 'english';
  const t = translations[lang] || translations.english;

  return {
    t: (key: TranslationKey): string => t[key] || translations.english[key] || key,
    language: lang,
  };
}
