import paintMessages from 'scratch-l10n/locales/paint-editor-msgs';
import appMessages from './locales.js';

export const SUPPORTED_LOCALES = ['ja', 'en'];
export const DEFAULT_LOCALE = 'en';
export const LOCALE_STORAGE_KEY = 'costume-studio.locale.v1';

const getPaintMessages = locale => {
    const pack = paintMessages[locale] || paintMessages[DEFAULT_LOCALE];
    if (!pack) return {};
    // scratch-l10n exposes each locale as a flat messages object, but accept the
    // nested {messages} shape too so this keeps working across versions.
    return pack.messages || pack;
};

export const getMessages = locale => ({
    ...getPaintMessages(DEFAULT_LOCALE),
    ...getPaintMessages(locale),
    ...appMessages[DEFAULT_LOCALE],
    ...(appMessages[locale] || {})
});

export const detectLocale = () => {
    try {
        const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (SUPPORTED_LOCALES.includes(saved)) return saved;
    } catch (error) {
        // Local storage can be unavailable in private or restricted contexts.
    }

    const languages = navigator.languages && navigator.languages.length ?
        navigator.languages :
        [navigator.language || DEFAULT_LOCALE];
    const preferred = String(languages[0] || DEFAULT_LOCALE).toLowerCase();
    return preferred.startsWith('ja') ? 'ja' : DEFAULT_LOCALE;
};

export const createIntlState = locale => ({
    intl: {
        defaultLocale: DEFAULT_LOCALE,
        locale,
        messages: getMessages(locale)
    }
});

export const rememberLocale = locale => {
    try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch (error) {
        // Saving the preference is best-effort.
    }
};
