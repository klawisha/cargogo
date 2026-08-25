import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

export type ThemeMode = 'dark' | 'light' | 'badger';
export type ThemeColors = {
  background:string; backgroundAlt:string; surface:string; surfaceRaised:string; surfaceMuted:string;
  border:string; borderStrong:string; text:string; textSecondary:string; muted:string;
  accent:string; accentStrong:string; accentSoft:string; accentText:string;
  success:string; successSoft:string; warning:string; warningSoft:string; danger:string; dangerSoft:string;
  overlay:string; shadow:string; nav:string;
};

export const palettes: Record<ThemeMode, ThemeColors> = {
  dark: {
    background:'#090B10', backgroundAlt:'#0E1219', surface:'#121720', surfaceRaised:'#19202B', surfaceMuted:'#0C1017',
    border:'#242D3B', borderStrong:'#3B4860', text:'#F7F8FA', textSecondary:'#AAB3C0', muted:'#687383',
    accent:'#8797C8', accentStrong:'#A5B2D9', accentSoft:'#171D2D', accentText:'#090C14',
    success:'#53D39A', successSoft:'#10251C', warning:'#F1BE62', warningSoft:'#2A2111', danger:'#FF6E79', dangerSoft:'#2A1216',
    overlay:'rgba(1,4,8,.78)', shadow:'#000000', nav:'#0D1117',
  },
  light: {
    background:'#F3F5F8', backgroundAlt:'#E9EDF3', surface:'#FFFFFF', surfaceRaised:'#F8F9FC', surfaceMuted:'#EEF1F6',
    border:'#DCE2EA', borderStrong:'#BCC6D3', text:'#151A22', textSecondary:'#556171', muted:'#7C8797',
    accent:'#586D9E', accentStrong:'#445985', accentSoft:'#E6EAF4', accentText:'#FFFFFF',
    success:'#178C5B', successSoft:'#DDF4E9', warning:'#9A6812', warningSoft:'#F8ECCF', danger:'#C63C4C', dangerSoft:'#FAE2E5',
    overlay:'rgba(12,20,30,.42)', shadow:'#263447', nav:'#FFFFFF',
  },
  badger: {
    background:'#061016', backgroundAlt:'#0A1820', surface:'#0D1B24', surfaceRaised:'#132632', surfaceMuted:'#08151C',
    border:'#1E3440', borderStrong:'#35566A', text:'#F7F4EC', textSecondary:'#B7C6CC', muted:'#718690',
    accent:'#F28A3D', accentStrong:'#FFC56D', accentSoft:'#2A1A12', accentText:'#0C1115',
    success:'#55C6A0', successSoft:'#0D2A25', warning:'#E7B85A', warningSoft:'#2C2312', danger:'#F07178', dangerSoft:'#2C1518',
    overlay:'rgba(2,8,12,.82)', shadow:'#000000', nav:'#07131A',
  },
};

let activeMode: ThemeMode = 'dark';
export function setActiveThemeMode(mode: ThemeMode){ activeMode = mode; }
export function getActiveThemeMode(){ return activeMode; }
export const colors = new Proxy({} as ThemeColors, { get(_target, key:keyof ThemeColors){ return palettes[activeMode][key]; } });

type Style = ViewStyle | TextStyle | ImageStyle;
export function themedStyleSheet<T extends Record<string, Style>>(factory:()=>T):T {
  return new Proxy({} as T, { get(_target,key:string|symbol){ return factory()[key as keyof T]; } });
}

export const radii = { sm:8, md:12, lg:18, xl:24, pill:999 } as const;
export const spacing = { xs:6, sm:10, md:16, lg:24, xl:32 } as const;
export const typography = { display:32, title:24, section:18, body:14, small:12, micro:10 } as const;
