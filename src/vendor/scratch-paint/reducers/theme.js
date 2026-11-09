const SET_THEME = 'scratch-paint/theme/SET_THEME';
const THEME_STORAGE_KEY = 'costume-studio.theme';
const getInitialTheme = () => {
    try {
        const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'dark' || saved === 'light') return saved;
    } catch (error) {
        // ignore
    }
    return 'default';
};
const initialState = getInitialTheme();

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SET_THEME:
        return action.theme || 'default';
    default:
        return state;
    }
};

const setTheme = function (theme) {
    return {
        type: SET_THEME,
        theme
    };
};

export {
    reducer as default,
    setTheme
};
