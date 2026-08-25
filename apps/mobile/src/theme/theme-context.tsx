import * as SecureStore from 'expo-secure-store';
import { NavigationBar } from 'expo-navigation-bar';
import { Platform } from 'react-native';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { palettes, setActiveThemeMode, type ThemeMode } from './tokens';

const STORAGE_KEY='cargogo.ui.theme.v3';
type ThemeContextValue={mode:ThemeMode;colors:(typeof palettes)[ThemeMode];ready:boolean;setMode:(mode:ThemeMode)=>Promise<void>;toggleMode:()=>Promise<void>};
const ThemeContext=createContext<ThemeContextValue|null>(null);

export function ThemeProvider({children}:PropsWithChildren){
  const[mode,setModeState]=useState<ThemeMode>('dark');
  const[ready,setReady]=useState(false);

  useEffect(()=>{let mounted=true;void SecureStore.getItemAsync(STORAGE_KEY).then(value=>{
    if(!mounted)return;const next:ThemeMode=value==='light'?'light':value==='badger'?'badger':'dark';setActiveThemeMode(next);setModeState(next);setReady(true);
  }).catch(()=>{if(mounted)setReady(true)});return()=>{mounted=false}},[]);

  useEffect(()=>{setActiveThemeMode(mode)},[mode]);

  const setMode=useCallback(async(next:ThemeMode)=>{setActiveThemeMode(next);setModeState(next);await SecureStore.setItemAsync(STORAGE_KEY,next)},[]);
  const toggleMode=useCallback(()=>setMode(mode==='dark'?'light':mode==='light'?'badger':'dark'),[mode,setMode]);
  const value=useMemo(()=>({mode,colors:palettes[mode],ready,setMode,toggleMode}),[mode,ready,setMode,toggleMode]);
  return <ThemeContext.Provider value={value}>{Platform.OS==='android'?<NavigationBar hidden style={mode==='light'?'light':'dark'}/>:null}{children}</ThemeContext.Provider>;
}
export function useAppTheme(){const value=useContext(ThemeContext);if(!value)throw new Error('useAppTheme must be used inside ThemeProvider');return value}
