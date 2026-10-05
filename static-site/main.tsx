// Entry point for the static (GitHub Pages) edition: the same page as the full site, with /api/* answered in the
// browser by lib/browser-library.ts.
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {installBrowserLibrary} from '@/lib/browser-library';
import Home from '@/app/page';
import '@/app/globals.css';

installBrowserLibrary();
createRoot(document.getElementById('root')!).render(<StrictMode><Home/></StrictMode>);
