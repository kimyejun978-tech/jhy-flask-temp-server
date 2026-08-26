import { useLocalSearchParams } from 'expo-router';
import { Linking, Text, View } from 'react-native';
import { useTrend } from '@/api/hooks';
import { Badge, Button, Card, ErrorBox, Loading, Page, ui } from '@/components/Ui';

export default function Trend(){
 const {id}=useLocalSearchParams<{id:string}>();
 const q=useTrend(id);
 if(q.isLoading)return <Page><Loading/></Page>;
 if(q.error||!q.data)return <Page><ErrorBox message={q.error?.message??'글을 찾을 수 없습니다.'}/></Page>;
 const x=q.data;
 const categories=Array.isArray(x.categories)?x.categories:[];
 return <Page>
  <Text style={[ui.h2,{fontSize:27}]}>{x.title}</Text>
  <Text style={ui.muted}>Velog · {x.author??'작성자 확인 중'}</Text>
  {categories.length>0&&<View style={ui.row}>{categories.map(c=><Badge key={c}>{c}</Badge>)}</View>}
  {x.tags.length>0&&<Text style={ui.muted}>원문 태그 · {x.tags.slice(0,8).join(' · ')}</Text>}
  <Card><Text style={ui.h2}>한 줄 요약</Text><Text style={ui.body}>{x.summary??'요약 생성 대기 중'}</Text></Card>
  <Card><Text style={ui.h2}>왜 알아두면 좋은가</Text><Text style={ui.body}>{x.whyRead??'평가 중'}</Text></Card>
  <Card><Text style={ui.h2}>💡 직접 해볼 것</Text><Text style={ui.body}>{x.tryNext??'실습 제안 생성 대기 중'}</Text></Card>
  <Button label="원문 읽기" onPress={()=>Linking.openURL(x.url)}/>
 </Page>;
}
