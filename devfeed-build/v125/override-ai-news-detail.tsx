import { useLocalSearchParams, router } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';
import { Button, Card, ErrorBox, Loading, Page, ui } from '@/components/Ui';
import { useNewsItem } from '@/api/hooks';
import { colors } from '@/theme';

function formatDate(value:string|null){
  if(!value)return null;
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return null;
  return d.toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});
}

export default function AiNewsDetail(){
  const {id}=useLocalSearchParams<{id:string}>();
  const q=useNewsItem(id);

  if(q.isLoading)return <Page><Loading/></Page>;
  if(q.error||!q.data)return <Page><ErrorBox message={q.error?.message??'AI 뉴스를 찾을 수 없습니다.'}/></Page>;

  const item=q.data;
  const ready=Boolean(item.summary);
  const published=formatDate(item.publishedAt);

  return <Page>
    <View style={{flexDirection:'row',alignItems:'center',gap:18}}>
      <Pressable onPress={()=>router.back()} hitSlop={12}><Text style={{color:colors.text,fontSize:34,fontWeight:'300'}}>‹</Text></Pressable>
      <Text style={{color:colors.text,fontSize:25,fontWeight:'900'}}>AI 뉴스</Text>
    </View>

    <Text style={{color:colors.text,fontSize:32,lineHeight:43,fontWeight:'900'}}>{item.title}</Text>
    <Text style={[ui.muted,{fontSize:16}]}>{item.channel}{published?` · ${published}`:''}{ready?' · 약 3분 읽기':' · 요약 준비 중'}</Text>

    {ready ? <>
      <Card>
        <Text style={ui.h2}>이번 영상 한눈에 보기</Text>
        <Text style={[ui.body,{lineHeight:28}]}>{item.summary}</Text>
      </Card>

      {item.highlights.length>0&&<Card>
        <Text style={ui.h2}>핵심 포인트</Text>
        <View style={{gap:12,paddingTop:4}}>
          {item.highlights.map((x,i)=><Text key={`${i}-${x}`} style={[ui.body,{lineHeight:25}]}>• {x}</Text>)}
        </View>
      </Card>}
    </> : <Card>
      <View style={{gap:10}}>
        <Text style={ui.h2}>요약을 준비하고 있어요</Text>
        <Text style={[ui.body,{lineHeight:26}]}>영상은 정상적으로 수집됐습니다. 서버가 자막을 먼저 확인하고, 자막을 읽을 수 없으면 영상 설명과 챕터를 바탕으로 요약을 생성합니다.</Text>
        <Text style={ui.muted}>이 화면은 10초마다 자동으로 다시 확인합니다. 완료되면 별도 조작 없이 요약으로 바뀝니다.</Text>
        <Button label={q.isFetching?'확인 중…':'지금 다시 확인'} variant="ghost" onPress={()=>void q.refetch()} />
      </View>
    </Card>}

    <Button label="YouTube에서 보기" onPress={()=>void Linking.openURL(item.url)} />
  </Page>;
}
