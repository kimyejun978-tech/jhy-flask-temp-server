import { Alert, Platform, ToastAndroid } from 'react-native';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

const RELEASE_API = 'https://api.github.com/repos/kimyejun978-tech/jhy-flask-temp-server/releases/latest';

type GithubRelease = {
  tag_name?: string;
  name?: string;
  body?: string | null;
  assets?: Array<{ name?: string; browser_download_url?: string; size?: number }>;
};

export type UpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  assetName: string;
  notes: string;
  size?: number;
};

export type UpdateDownloadProgress = {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
};

export const currentAppVersion = () => Application.nativeApplicationVersion ?? '0.0.0';

function versionParts(version: string) {
  return version.replace(/^v/i, '').split(/[.-]/).slice(0, 3).map((v) => Number.parseInt(v, 10) || 0);
}

function isNewerVersion(latest: string, current: string) {
  const a = versionParts(latest);
  const b = versionParts(current);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

export async function getAvailableUpdate(): Promise<UpdateInfo | null> {
  if (Platform.OS !== 'android') return null;
  const response = await fetch(RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`업데이트 서버 응답 오류 (${response.status})`);

  const release = (await response.json()) as GithubRelease;
  const latestVersion = (release.tag_name ?? release.name ?? '').replace(/^v/i, '').trim();
  if (!latestVersion) throw new Error('최신 버전 정보를 확인할 수 없습니다.');

  const apk = release.assets?.find((asset) => asset.name?.toLowerCase().endsWith('.apk') && asset.browser_download_url);
  if (!apk?.browser_download_url) throw new Error('최신 Release에 APK 파일이 없습니다.');

  const currentVersion = currentAppVersion();
  if (!isNewerVersion(latestVersion, currentVersion)) return null;

  return {
    currentVersion,
    latestVersion,
    downloadUrl: apk.browser_download_url,
    assetName: apk.name ?? `DevFeed-v${latestVersion}.apk`,
    notes: (release.body ?? '').trim(),
    size: apk.size,
  };
}

export async function downloadAndInstallUpdate(
  info: UpdateInfo,
  onProgress?: (progress: UpdateDownloadProgress) => void,
) {
  if (Platform.OS !== 'android') throw new Error('Android에서만 인앱 APK 업데이트를 지원합니다.');
  const cache = FileSystem.cacheDirectory;
  if (!cache) throw new Error('업데이트 파일 저장소를 사용할 수 없습니다.');

  const destination = `${cache}DevFeed-update-${info.latestVersion}.apk`;
  await FileSystem.deleteAsync(destination, { idempotent: true });

  const download = FileSystem.createDownloadResumable(
    info.downloadUrl,
    destination,
    {},
    (data) => {
      const downloadedBytes = Math.max(0, data.totalBytesWritten ?? 0);
      const totalBytes = Math.max(0, data.totalBytesExpectedToWrite || info.size || 0);
      const percent = totalBytes > 0
        ? Math.max(0, Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)))
        : 0;
      onProgress?.({ percent, downloadedBytes, totalBytes });
    },
  );

  const result = await download.downloadAsync();
  if (!result) throw new Error('APK 다운로드 결과를 확인할 수 없습니다.');
  if (result.status < 200 || result.status >= 300) throw new Error(`APK 다운로드 실패 (${result.status})`);

  const finalTotal = info.size ?? 0;
  onProgress?.({ percent: 100, downloadedBytes: finalTotal, totalBytes: finalTotal });

  const contentUri = await FileSystem.getContentUriAsync(result.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1,
    type: 'application/vnd.android.package-archive',
  });
}

export async function promptForUpdateIfAvailable() {
  try {
    const info = await getAvailableUpdate();
    if (!info) return;
    const notes = info.notes ? `\n\n${info.notes.slice(0, 450)}` : '';
    Alert.alert(
      `DevFeed v${info.latestVersion} 업데이트`,
      `새 버전이 있어요. 앱에서 APK를 내려받은 뒤 Android 설치 화면을 열어줍니다.${notes}`,
      [
        { text: '나중에', style: 'cancel' },
        {
          text: '업데이트',
          onPress: () => {
            let lastBucket = -25;
            void downloadAndInstallUpdate(info, (progress) => {
              const bucket = Math.floor(progress.percent / 25) * 25;
              if (bucket > lastBucket && bucket <= 100) {
                lastBucket = bucket;
                ToastAndroid.show(`DevFeed 업데이트 다운로드 ${bucket}%`, ToastAndroid.SHORT);
              }
            }).catch((error) => {
              Alert.alert('업데이트 실패', error instanceof Error ? error.message : '업데이트를 설치하지 못했습니다.');
            });
          },
        },
      ],
    );
  } catch {
    // 자동 확인은 조용히 실패하고, 설정 화면에서 수동 확인할 수 있게 둔다.
  }
}
