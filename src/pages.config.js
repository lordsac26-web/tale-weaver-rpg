/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import CharacterCreation from './pages/CharacterCreation';
import CharacterSheetPage from './pages/CharacterSheetPage';
import CombatHistory from './pages/CombatHistory';
import Encyclopedia from './pages/Encyclopedia';
import Game from './pages/Game';
import Home from './pages/Home';
import ImageForge from './pages/ImageForge';
import Inventory from './pages/Inventory';
import Market from './pages/Market';
import NewGame from './pages/NewGame';
import SpellManagement from './pages/SpellManagement';
import WorldMap from './pages/WorldMap';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CharacterCreation": CharacterCreation,
    "CharacterSheetPage": CharacterSheetPage,
    "CombatHistory": CombatHistory,
    "Encyclopedia": Encyclopedia,
    "Game": Game,
    "Home": Home,
    "ImageForge": ImageForge,
    "Inventory": Inventory,
    "Market": Market,
    "NewGame": NewGame,
    "SpellManagement": SpellManagement,
    "WorldMap": WorldMap,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};