import React from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {IntlProvider} from 'react-intl-redux';
import {prewarmPaperSandbox} from '@scratch/scratch-paint';

import App from './App.jsx';
import {createAppStore} from './store.js';
import './styles/theme.global.css';

// react-intl-redux defaults the IntlProvider's React key to the locale.
// That remounts the entire editor subtree when switching languages and loses
// the in-memory Paper.js project. Keep a stable key while updating messages.
const intlSelector = state => ({...state.intl, key: 'costume-studio-intl'});

const store = createAppStore();
const root = createRoot(document.getElementById('root'));

root.render(
    <Provider store={store}>
        <IntlProvider intlSelector={intlSelector}>
            <App/>
        </IntlProvider>
    </Provider>
);

// Warming up the sandboxed Paper.js importer makes the first SVG paste or file
// open feel instant. Failure is harmless: the importer retries on demand.
prewarmPaperSandbox();
