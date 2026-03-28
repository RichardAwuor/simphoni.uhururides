import { useProfile } from '@/contexts/ProfileContext';
import { translations, Language, TranslationKey, countryToLanguage } from '@/constants/translations';

/**
 * Returns translated strings.
 * - If `langOverride` is provided (e.g. from route params on pre-auth screens), it is used directly.
 * - Otherwise falls back to the language stored in the user's profile.
 * - Final fallback is English.
 */
export function useTranslation(langOverride?: string | null) {
  const { profile } = useProfile();

  let lang: Language = 'en';

  if (langOverride) {
    // Accept both short codes ('sw', 'rw', 'am', 'en') and country names
    const lower = langOverride.toLowerCase();
    if (lower in translations) {
      lang = lower as Language;
    } else {
      // Treat it as a country name and derive the language
      lang = countryToLanguage(lower);
    }
  } else if (profile?.language) {
    const profileLang = profile.language as string;
    if (profileLang in translations) {
      lang = profileLang as Language;
    }
  }

  const t = translations[lang] ?? translations.en;

  return {
    t: (key: TranslationKey): string => t[key] ?? translations.en[key] ?? key,
    language: lang,
  };
}
