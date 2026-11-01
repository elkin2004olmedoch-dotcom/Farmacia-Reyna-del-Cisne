import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');

test('el contenedor carga contenido local sin HTTP plano ni navegación remota',()=>{
  const config=JSON.parse(read('../capacitor.config.json'));
  assert.equal(config.webDir,'www');assert.equal(config.server.url,undefined);assert.equal(config.server.cleartext,false);assert.deepEqual(config.server.allowNavigation,[]);
  assert.equal(config.android.useLegacyBridge,true);assert.equal(config.android.allowMixedContent,false);assert.equal(config.loggingBehavior,'none');
});
test('Android no exporta el servicio GPS ni respalda credenciales de la app',()=>{
  const manifest=read('../android/app/src/main/AndroidManifest.xml');
  assert.match(manifest,/android:allowBackup="false"/);assert.match(manifest,/android:usesCleartextTraffic="false"/);
  assert.match(manifest,/<service\s+android:name="com\.equimaps\.capacitor_background_geolocation\.BackgroundGeolocationService"[^>]+android:exported="false"/);
  const native=read('../node_modules/@capacitor-community/background-geolocation/android/src/main/AndroidManifest.xml');
  for(const permission of ['ACCESS_COARSE_LOCATION','ACCESS_FINE_LOCATION','FOREGROUND_SERVICE_LOCATION','POST_NOTIFICATIONS'])assert(native.includes('android.permission.'+permission));
});
test('iOS declara ubicación al bloquear pantalla y explica su uso durante la entrega',()=>{
  const plist=read('../ios/App/App/Info.plist');
  assert.match(plist,/<key>NSLocationWhenInUseUsageDescription<\/key>\s*<string>[^<]+entrega[^<]*<\/string>/);
  assert.match(plist,/<key>NSLocationAlwaysAndWhenInUseUsageDescription<\/key>\s*<string>[^<]+bloquead[^<]*<\/string>/);
  assert.match(plist,/<key>UIBackgroundModes<\/key>\s*<array>\s*<string>location<\/string>\s*<\/array>/);
  assert.match(plist,/<key>CFBundleDevelopmentRegion<\/key>\s*<string>es<\/string>/);
});
