import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { apiFetch } from '@/api/client';
import { useAuth } from '@/auth/auth-context';

Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});
export function PushBridge(){const{user}=useAuth();useEffect(()=>{if(!user||!Device.isDevice)return;let token:string|undefined;let disposed=false;void(async()=>{try{if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('deal-events',{name:'Події угод',importance:Notifications.AndroidImportance.HIGH});const current=await Notifications.getPermissionsAsync();let status=current.status;if(status!=='granted')status=(await Notifications.requestPermissionsAsync()).status;if(status!=='granted'||disposed)return;const projectId=process.env.EXPO_PUBLIC_EAS_PROJECT_ID??Constants.easConfig?.projectId??Constants.expoConfig?.extra?.eas?.projectId;if(!projectId){console.warn('CargoGo push: EAS projectId is not configured; live in-app updates remain enabled.');return}token=(await Notifications.getExpoPushTokenAsync({projectId})).data;if(disposed)return;await apiFetch('/notifications/push-token',{method:'POST',body:JSON.stringify({token,platform:Platform.OS})})}catch(e){console.warn('CargoGo push registration failed',e)}})();const sub=Notifications.addNotificationResponseReceivedListener(response=>{const data=response.notification.request.content.data as any;if(data?.entityType==='deal'&&data?.entityId)router.push({pathname:'/deal/[id]',params:{id:String(data.entityId)}});else router.push('/notifications')});return()=>{disposed=true;sub.remove();if(token)void apiFetch('/notifications/push-token/revoke',{method:'POST',body:JSON.stringify({token})}).catch(()=>{})}},[user?.id]);return null}
