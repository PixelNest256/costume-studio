import {combineReducers, createStore} from 'redux';
import {intlReducer} from 'react-intl-redux';
import {ScratchPaintReducer} from '@scratch/scratch-paint';
import {createIntlState, detectLocale} from './i18n.js';

const rootReducer = combineReducers({
    intl: intlReducer,
    scratchPaint: ScratchPaintReducer
});

export const createAppStore = () => {
    const locale = detectLocale();
    const devTools = typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION__ ?
        window.__REDUX_DEVTOOLS_EXTENSION__() :
        undefined;

    return createStore(rootReducer, createIntlState(locale), devTools);
};
