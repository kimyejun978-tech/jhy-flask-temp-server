import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { getUserDisplayId } from '@/api/client';
import { usePreferences, useSavePreferences, type Preferences } from '@/api/hooks';
import { Button, Card, Loading, Page, ui } from '@/components/Ui';
import { colors } from '@/theme';
import { currentAppVersion, downloadAndInstallUpdate, getAvailableUpdate, type UpdateInfo } from '@/updater';

function Row({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#2A313D', true: '#536EB8' }}
        thumbColor={value ? '#DCE4FF' : '#A0A8B4'}
      />
    </View>
  );
}

const defaults: Preferences = {
  eventsEnabled: true,
  trendsEnabled: true,
  newsEnabled: true,
  freePriority: true,
  highSchoolOnly: false,
  deadline3Enabled: true,
  deadline1Enabled: true,
  eventDayBeforeEnabled: true,
  interests: ['AI','로봇','임베디드','IoT','SW','해커톤'],
};

export default function Settings() {
  const q = usePreferences();
  const save = useSavePreferences();
  const [p, setP] = useState<Preferences>(defaults);
  const [permission, setPermission] = useState<string>('확인 중');
  const [profileId, setProfileId] = useState('불러오는 중');
  const [updateStatus, setUpdateStatus] = useState('확인 안 함');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => { if (q.data) setP(q.data); }, [q.data]);
  useEffect(() => {
    Notifications.getPermissionsAsync().then((v) => setPermission(v.status === 'granted' ? '허용됨' : '허용 필요')).catch(() => setPermission('확인 필요'));
    getUserDisplayId().then(setProfileId).catch(() => setProfileId('확인 필요'));
  }, []);

  const set = (k: keyof Preferences, v: boolean | string[]) => setP((prev) => ({ ...prev, [k]: v }));
  const toggleInterest = (x: string) => set('interests', p.interests.includes(x) ? p.interests.filter((v) => v !== x) : [...p.interests, x]);
  const persist = async () => {
    try {
      await save.mutateAsync(p);
      Alert.alert('저장 완료', '이 기기 프로필에 설정을 저장했습니다.');
    } catch (e) {
      Alert.alert('저장 실패', e instanceof Error ? e.message : '오류');
    }
  };
  const enableNotifications = async () => {
    try {
      const perm = await Notifications.requestPermissionsAsync();
      const granted = perm.status === 'granted';
      setPermission(granted ? '허용됨' : '허용 필요');
      Alert.alert(granted ? '알림 준비 완료' : '알림 권한 필요', granted ? '이 기기의 개인 설정을 기준으로 알림을 확인합니다.' : '휴대폰 설정에서 DevFeed 알림을 허용해주세요.');
    } catch (e) {
      Alert.alert('알림 설정', e instanceof Error ? e.message : '권한 요청에 실패했습니다.');
    }
  };
  const checkUpdate = async () => {
    try {
      setUpdateStatus('확인 중...');
      setUpdateInfo(null);
      const info = await getAvailableUpdate();
      if (info) {
        setUpdateInfo(info);
        setUpdateStatus(`v${info.latestVersion} 사용 가능`);
      } else setUpdateStatus('최신 버전입니다');
    } catch (e) {
      setUpdateStatus('확인 실패');
      Alert.alert('업데이트 확인 실패', e instanceof Error ? e.message : '업데이트 정보를 불러오지 못했습니다.');
    }
  };
  const installUpdate = async () => {
    if (!updateInfo) return;
    try {
      setInstalling(true);
      setUpdateStatus('APK 다운로드 중...');
      await downloadAndInstallUpdate(updateInfo);
      setUpdateStatus('설치 화면을 확인해주세요');
    } catch (e) {
      setUpdateStatus('업데이트 실패');
      Alert.alert('업데이트 실패', e instanceof Error ? e.message : '업데이트를 설치하지 못했습니다.');
    } finally {
      setInstalling(false);
    }
  };

  if (q.isLoading) return <Page><Loading /></Page>;

  return (
    <Page>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>PERSONALIZE</Text>
        <Text style={styles.title}>내 DevFeed 설정</Text>
        <Text style={styles.subtitle}>알림과 관심 분야를 이 기기 프로필에 맞춰 관리합니다.</Text>
      </View>

      <Card style={styles.profileCard}>
        <View style={styles.profileIcon}><Text style={styles.profileIconText}>D</Text></View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.profileTitle}>이 기기 프로필</Text>
          <Text style={styles.profileId}>{profileId}</Text>
          <Text style={styles.profileHint}>다른 사람이 같은 APK를 설치해도 개인 설정은 섞이지 않아요.</Text>
        </View>
      </Card>

      <Text style={styles.sectionLabel}>행사 추천</Text>
      <Card>
        <Row label="행사 알림" value={p.eventsEnabled} onChange={(v) => set('eventsEnabled', v)} />
        <View style={styles.divider} />
        <Row label="고등학생 참가 가능만" value={p.highSchoolOnly} onChange={(v) => set('highSchoolOnly', v)} />
        <View style={styles.divider} />
        <Row label="무료 행사 우선" value={p.freePriority} onChange={(v) => set('freePriority', v)} />
      </Card>

      <Text style={styles.sectionLabel}>관심 분야</Text>
      <Card>
        {['AI','로봇','임베디드','IoT','SW','해커톤'].map((x, i, arr) => (
          <View key={x}>
            <Row label={x} value={p.interests.includes(x)} onChange={() => toggleInterest(x)} />
            {i < arr.length - 1 ? <View style={styles.divider} /> : null}
          </View>
        ))}
      </Card>

      <Text style={styles.sectionLabel}>마감과 콘텐츠</Text>
      <Card>
        <Row label="신청 마감 3일 전" value={p.deadline3Enabled} onChange={(v) => set('deadline3Enabled', v)} />
        <View style={styles.divider} />
        <Row label="신청 마감 1일 전" value={p.deadline1Enabled} onChange={(v) => set('deadline1Enabled', v)} />
        <View style={styles.divider} />
        <Row label="행사 하루 전" value={p.eventDayBeforeEnabled} onChange={(v) => set('eventDayBeforeEnabled', v)} />
        <View style={styles.divider} />
        <Row label="주요 트렌드 알림" value={p.trendsEnabled} onChange={(v) => set('trendsEnabled', v)} />
        <View style={styles.divider} />
        <Row label="조코딩 새 영상 알림" value={p.newsEnabled} onChange={(v) => set('newsEnabled', v)} />
      </Card>

      <Button label={save.isPending ? '저장 중...' : '설정 저장'} disabled={save.isPending} onPress={() => void persist()} />

      <Text style={styles.sectionLabel}>앱 관리</Text>
      <Card>
        <View style={styles.infoHead}>
          <View>
            <Text style={styles.infoTitle}>앱 업데이트</Text>
            <Text style={styles.infoSub}>현재 v{currentAppVersion()}</Text>
          </View>
          <View style={styles.statusPill}><Text style={styles.statusPillText}>{updateStatus}</Text></View>
        </View>
        <Text style={ui.muted}>새 버전이 있으면 앱 안에서 APK를 받아 Android 설치 화면을 바로 엽니다.</Text>
        <Button label="업데이트 확인" variant="ghost" onPress={() => void checkUpdate()} />
        {updateInfo ? <Button label={installing ? '다운로드 중...' : `v${updateInfo.latestVersion} 다운로드 및 설치`} disabled={installing} onPress={() => void installUpdate()} /> : null}
      </Card>

      <Card>
        <View style={styles.infoHead}>
          <View>
            <Text style={styles.infoTitle}>백그라운드 알림</Text>
            <Text style={styles.infoSub}>Android 주기 확인</Text>
          </View>
          <View style={[styles.statusPill, permission === '허용됨' && styles.statusGood]}>
            <Text style={[styles.statusPillText, permission === '허용됨' && { color: '#A7F0CC' }]}>{permission}</Text>
          </View>
        </View>
        <Text style={ui.muted}>이 기기 프로필의 관심 분야와 마감 설정을 기준으로 새 소식을 확인합니다.</Text>
        <Button label={permission === '허용됨' ? '알림 권한 다시 확인' : '알림 권한 허용'} variant="ghost" onPress={() => void enableNotifications()} />
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 4, paddingBottom: 3 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.7, marginBottom: 6 },
  title: { color: colors.text, fontSize: 30, lineHeight: 37, fontWeight: '900', letterSpacing: -0.9 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: '600', marginTop: 5 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#111A2A', borderColor: '#263A63' },
  profileIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  profileIconText: { color: colors.bg, fontSize: 20, fontWeight: '900' },
  profileTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  profileId: { color: '#AAB9E6', fontSize: 12, fontWeight: '800' },
  profileHint: { color: colors.muted, fontSize: 11, lineHeight: 17, fontWeight: '600' },
  sectionLabel: { color: '#7E8999', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 6, marginLeft: 3 },
  row: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  rowLabel: { color: '#E9ECF1', fontSize: 14, fontWeight: '750' as any },
  rowHint: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#222A35' },
  infoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  infoTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  infoSub: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  statusPill: { maxWidth: 150, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: '#242B36' },
  statusGood: { backgroundColor: '#183126' },
  statusPillText: { color: '#AEB7C4', fontSize: 10, fontWeight: '900' },
});
