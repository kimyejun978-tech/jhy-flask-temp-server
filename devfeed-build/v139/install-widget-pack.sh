#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:?Android main source root is required}"
JAVA="$ROOT/java/app/devfeed/mobile"
LAYOUT="$ROOT/res/layout"
DRAWABLE="$ROOT/res/drawable"
XML="$ROOT/res/xml"
MANIFEST="$ROOT/AndroidManifest.xml"
mkdir -p "$JAVA" "$LAYOUT" "$DRAWABLE" "$XML"

cat > "$JAVA/DevFeedWidgetData.java" <<'JAVA'
package app.devfeed.mobile;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

final class DevFeedWidgetData {
    private static final String RUNTIME_URL = "https://raw.githubusercontent.com/kimyejun978-tech/jhy-flask-temp-server/devfeed-runtime/devfeed-runtime.json";
    private static volatile String apiBase;
    private DevFeedWidgetData() {}

    static String userId(Context context) {
        String id = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
        return "android-" + (id == null ? "unknown" : id);
    }

    private static String read(HttpURLConnection c) throws Exception {
        c.setConnectTimeout(6500); c.setReadTimeout(6500); c.setUseCaches(false);
        try (BufferedReader br = new BufferedReader(new InputStreamReader(c.getInputStream()))) {
            StringBuilder sb = new StringBuilder(); String line;
            while ((line = br.readLine()) != null) sb.append(line);
            return sb.toString();
        } finally { c.disconnect(); }
    }

    static String apiBase() throws Exception {
        if (apiBase != null) return apiBase;
        HttpURLConnection c = (HttpURLConnection) new URL(RUNTIME_URL + "?widget=" + System.currentTimeMillis()).openConnection();
        c.setRequestProperty("User-Agent", "DevFeed-Widget/1.3.9");
        JSONObject j = new JSONObject(read(c));
        String value = j.optString("apiUrl", "").replaceAll("/$", "");
        if (!value.startsWith("https://")) throw new IllegalStateException("Invalid DevFeed API URL");
        apiBase = value; return value;
    }

    static JSONObject get(Context context, String path) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(apiBase() + path).openConnection();
        c.setRequestProperty("Accept", "application/json");
        c.setRequestProperty("x-user-id", userId(context));
        c.setRequestProperty("User-Agent", "DevFeed-Widget/1.3.9");
        return new JSONObject(read(c));
    }

    static JSONArray items(Context context, String path) throws Exception {
        JSONArray a = get(context, path).optJSONArray("items");
        return a == null ? new JSONArray() : a;
    }

    static JSONObject first(JSONArray a) { return a.length() > 0 ? a.optJSONObject(0) : null; }
    static String text(JSONObject j, String key, String fallback) {
        if (j == null) return fallback;
        String s = j.optString(key, "").trim(); return s.isEmpty() ? fallback : s;
    }
    static String shorten(String s, int n) { if (s == null) return ""; s = s.trim(); return s.length() <= n ? s : s.substring(0, Math.max(0,n-1)).trim() + "…"; }
    static String dateLabel(JSONObject j) {
        String raw = text(j, "startDate", text(j, "publishedAt", ""));
        if (raw.length() >= 10) return raw.substring(5,10).replace('-', '.');
        return "날짜 확인 중";
    }
    static String dDay(JSONObject j) {
        String raw = text(j, "startDate", ""); if (raw.length() < 10) return "SOON";
        try {
            Date target = new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(raw.substring(0,10));
            Calendar t = Calendar.getInstance(); t.setTime(target); zero(t);
            Calendar n = Calendar.getInstance(); zero(n);
            long d = (t.getTimeInMillis()-n.getTimeInMillis())/86400000L;
            if (d == 0) return "D-DAY"; if (d > 0) return "D-"+d; return "D+"+Math.abs(d);
        } catch(Exception e){ return "SOON"; }
    }
    static void zero(Calendar c){ c.set(Calendar.HOUR_OF_DAY,0); c.set(Calendar.MINUTE,0); c.set(Calendar.SECOND,0); c.set(Calendar.MILLISECOND,0); }
    static String updated(){ return new SimpleDateFormat("HH:mm", Locale.KOREA).format(new Date()); }
    static PendingIntent openApp(Context context){
        Intent i = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if(i==null) i=new Intent();
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, 1390, i, PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    static void bindOpen(RemoteViews v, int rootId, Context c){ v.setOnClickPendingIntent(rootId, openApp(c)); }
}
JAVA

cat > "$JAVA/DevFeedWidgetProvider.java" <<'JAVA'
package app.devfeed.mobile;
import android.appwidget.AppWidgetManager; import android.appwidget.AppWidgetProvider; import android.content.Context; import android.widget.RemoteViews; import org.json.JSONArray; import org.json.JSONObject;
public class DevFeedWidgetProvider extends AppWidgetProvider {
 public void onUpdate(Context c, AppWidgetManager m, int[] ids){ for(int id:ids) new Thread(()->update(c,m,id)).start(); }
 private void update(Context c,AppWidgetManager m,int id){ RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.devfeed_widget); try{ JSONArray s=DevFeedWidgetData.items(c,"/v1/schedule"), e=DevFeedWidgetData.items(c,"/v1/events"); JSONObject next=DevFeedWidgetData.first(e); v.setTextViewText(R.id.widget_badge,"LIVE"); v.setTextViewText(R.id.widget_title,"오늘을 한눈에"); v.setTextViewText(R.id.widget_body,DevFeedWidgetData.shorten(DevFeedWidgetData.text(next,"title","새로운 행사를 확인해보세요"),44)); v.setTextViewText(R.id.widget_stat1,String.valueOf(s.length())); v.setTextViewText(R.id.widget_stat2,String.valueOf(e.length())); v.setTextViewText(R.id.widget_meta,"일정   ·   행사     업데이트 "+DevFeedWidgetData.updated()); }catch(Exception x){ v.setTextViewText(R.id.widget_body,"앱을 열어 최신 피드를 확인하세요"); v.setTextViewText(R.id.widget_meta,"동기화 대기 중"); } DevFeedWidgetData.bindOpen(v,R.id.widget_root,c); m.updateAppWidget(id,v); }
}
JAVA

cat > "$JAVA/TodayScheduleWidgetProvider.java" <<'JAVA'
package app.devfeed.mobile;
import android.appwidget.AppWidgetManager; import android.appwidget.AppWidgetProvider; import android.content.Context; import android.widget.RemoteViews; import org.json.JSONArray; import org.json.JSONObject;
public class TodayScheduleWidgetProvider extends AppWidgetProvider {
 public void onUpdate(Context c, AppWidgetManager m, int[] ids){for(int id:ids)new Thread(()->u(c,m,id)).start();}
 private void u(Context c,AppWidgetManager m,int id){RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.devfeed_widget_today);try{JSONArray a=DevFeedWidgetData.items(c,"/v1/schedule");JSONObject x=DevFeedWidgetData.first(a);v.setTextViewText(R.id.widget_count,String.valueOf(a.length()));v.setTextViewText(R.id.widget_body,DevFeedWidgetData.shorten(DevFeedWidgetData.text(x,"title","오늘은 여유로운 날"),30));v.setTextViewText(R.id.widget_meta,"참가 예정 · "+DevFeedWidgetData.updated());}catch(Exception e){v.setTextViewText(R.id.widget_count,"–");v.setTextViewText(R.id.widget_body,"일정 동기화 대기 중");}DevFeedWidgetData.bindOpen(v,R.id.widget_root,c);m.updateAppWidget(id,v);}
}
JAVA

cat > "$JAVA/NextEventWidgetProvider.java" <<'JAVA'
package app.devfeed.mobile;
import android.appwidget.AppWidgetManager; import android.appwidget.AppWidgetProvider; import android.content.Context; import android.widget.RemoteViews; import org.json.JSONObject;
public class NextEventWidgetProvider extends AppWidgetProvider {
 public void onUpdate(Context c,AppWidgetManager m,int[] ids){for(int id:ids)new Thread(()->u(c,m,id)).start();}
 private void u(Context c,AppWidgetManager m,int id){RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.devfeed_widget_next);try{JSONObject x=DevFeedWidgetData.first(DevFeedWidgetData.items(c,"/v1/events"));v.setTextViewText(R.id.widget_badge,DevFeedWidgetData.dDay(x));v.setTextViewText(R.id.widget_title,DevFeedWidgetData.shorten(DevFeedWidgetData.text(x,"title","다가오는 행사가 없습니다"),52));v.setTextViewText(R.id.widget_meta,DevFeedWidgetData.dateLabel(x)+"  ·  "+DevFeedWidgetData.shorten(DevFeedWidgetData.text(x,"location",DevFeedWidgetData.text(x,"region","온라인/장소 확인")),28));}catch(Exception e){v.setTextViewText(R.id.widget_title,"다음 행사를 불러오는 중");v.setTextViewText(R.id.widget_meta,"DevFeed를 열어 새로고침");}DevFeedWidgetData.bindOpen(v,R.id.widget_root,c);m.updateAppWidget(id,v);}
}
JAVA

cat > "$JAVA/DdayWidgetProvider.java" <<'JAVA'
package app.devfeed.mobile;
import android.appwidget.AppWidgetManager; import android.appwidget.AppWidgetProvider; import android.content.Context; import android.widget.RemoteViews; import org.json.JSONObject;
public class DdayWidgetProvider extends AppWidgetProvider {
 public void onUpdate(Context c,AppWidgetManager m,int[] ids){for(int id:ids)new Thread(()->u(c,m,id)).start();}
 private void u(Context c,AppWidgetManager m,int id){RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.devfeed_widget_dday);try{JSONObject x=DevFeedWidgetData.first(DevFeedWidgetData.items(c,"/v1/events"));v.setTextViewText(R.id.widget_count,DevFeedWidgetData.dDay(x));v.setTextViewText(R.id.widget_body,DevFeedWidgetData.shorten(DevFeedWidgetData.text(x,"title","다음 행사 준비 중"),30));}catch(Exception e){v.setTextViewText(R.id.widget_count,"SOON");v.setTextViewText(R.id.widget_body,"DevFeed 이벤트");}DevFeedWidgetData.bindOpen(v,R.id.widget_root,c);m.updateAppWidget(id,v);}
}
JAVA

cat > "$JAVA/AiNewsWidgetProvider.java" <<'JAVA'
package app.devfeed.mobile;
import android.appwidget.AppWidgetManager; import android.appwidget.AppWidgetProvider; import android.content.Context; import android.widget.RemoteViews; import org.json.JSONObject;
public class AiNewsWidgetProvider extends AppWidgetProvider {
 public void onUpdate(Context c,AppWidgetManager m,int[] ids){for(int id:ids)new Thread(()->u(c,m,id)).start();}
 private void u(Context c,AppWidgetManager m,int id){RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.devfeed_widget_news);try{JSONObject x=DevFeedWidgetData.first(DevFeedWidgetData.items(c,"/v1/ai-news"));v.setTextViewText(R.id.widget_title,DevFeedWidgetData.shorten(DevFeedWidgetData.text(x,"title","새 AI 뉴스를 기다리는 중"),55));String summary=DevFeedWidgetData.text(x,"summary","");v.setTextViewText(R.id.widget_body,summary.isEmpty()?"조코딩 · 요약 준비 중":DevFeedWidgetData.shorten(summary,72));v.setTextViewText(R.id.widget_meta,DevFeedWidgetData.dateLabel(x)+" · "+DevFeedWidgetData.updated());}catch(Exception e){v.setTextViewText(R.id.widget_title,"AI 뉴스를 불러오는 중");v.setTextViewText(R.id.widget_body,"앱에서 최신 피드를 확인하세요");}DevFeedWidgetData.bindOpen(v,R.id.widget_root,c);m.updateAppWidget(id,v);}
}
JAVA

cat > "$JAVA/TrendWidgetProvider.java" <<'JAVA'
package app.devfeed.mobile;
import android.appwidget.AppWidgetManager; import android.appwidget.AppWidgetProvider; import android.content.Context; import android.widget.RemoteViews; import org.json.JSONObject;
public class TrendWidgetProvider extends AppWidgetProvider {
 public void onUpdate(Context c,AppWidgetManager m,int[] ids){for(int id:ids)new Thread(()->u(c,m,id)).start();}
 private void u(Context c,AppWidgetManager m,int id){RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.devfeed_widget_trend);try{JSONObject x=DevFeedWidgetData.first(DevFeedWidgetData.items(c,"/v1/trends"));v.setTextViewText(R.id.widget_title,DevFeedWidgetData.shorten(DevFeedWidgetData.text(x,"title","새 개발 트렌드를 찾는 중"),55));v.setTextViewText(R.id.widget_body,DevFeedWidgetData.shorten(DevFeedWidgetData.text(x,"summary",DevFeedWidgetData.text(x,"description","Velog 최신 개발 트렌드")),72));v.setTextViewText(R.id.widget_meta,"VELOG · "+DevFeedWidgetData.updated());}catch(Exception e){v.setTextViewText(R.id.widget_title,"트렌드를 불러오는 중");v.setTextViewText(R.id.widget_body,"앱에서 최신 개발 글을 확인하세요");}DevFeedWidgetData.bindOpen(v,R.id.widget_root,c);m.updateAppWidget(id,v);}
}
JAVA

cat > "$DRAWABLE/devfeed_widget_bg.xml" <<'XML'
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="#FAF9FF"/><stroke android:width="1dp" android:color="#E8E4F5"/><corners android:radius="24dp"/><padding android:left="1dp" android:top="1dp" android:right="1dp" android:bottom="1dp"/></shape>
XML
cat > "$DRAWABLE/devfeed_widget_purple.xml" <<'XML'
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="#6C45FF"/><corners android:radius="999dp"/></shape>
XML
cat > "$DRAWABLE/devfeed_widget_soft_purple.xml" <<'XML'
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="#EEE9FF"/><corners android:radius="18dp"/></shape>
XML
cat > "$DRAWABLE/devfeed_widget_soft_orange.xml" <<'XML'
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="#FFF0E7"/><corners android:radius="18dp"/></shape>
XML

cat > "$LAYOUT/devfeed_widget.xml" <<'XML'
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:padding="18dp" android:background="@drawable/devfeed_widget_bg">
 <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:gravity="center_vertical"><TextView android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:text="DEVFEED" android:textColor="#6C45FF" android:textSize="11sp" android:textStyle="bold" android:letterSpacing="0.14"/><TextView android:id="@+id/widget_badge" android:layout_width="wrap_content" android:layout_height="wrap_content" android:background="@drawable/devfeed_widget_soft_purple" android:paddingLeft="10dp" android:paddingRight="10dp" android:paddingTop="4dp" android:paddingBottom="4dp" android:text="LIVE" android:textColor="#5B37E6" android:textSize="10sp" android:textStyle="bold"/></LinearLayout>
 <TextView android:id="@+id/widget_title" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="10dp" android:text="오늘을 한눈에" android:textColor="#17151F" android:textSize="22sp" android:textStyle="bold"/>
 <TextView android:id="@+id/widget_body" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="5dp" android:maxLines="2" android:ellipsize="end" android:textColor="#5F5A6B" android:textSize="13sp"/>
 <LinearLayout android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:gravity="bottom" android:orientation="horizontal"><TextView android:id="@+id/widget_stat1" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="0" android:textColor="#17151F" android:textSize="22sp" android:textStyle="bold"/><TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginLeft="5dp" android:text="일정" android:textColor="#8C8798" android:textSize="11sp"/><TextView android:id="@+id/widget_stat2" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginLeft="18dp" android:text="0" android:textColor="#17151F" android:textSize="22sp" android:textStyle="bold"/><TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginLeft="5dp" android:text="행사" android:textColor="#8C8798" android:textSize="11sp"/></LinearLayout>
 <TextView android:id="@+id/widget_meta" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="7dp" android:textColor="#AAA5B4" android:textSize="9sp"/>
</LinearLayout>
XML

cat > "$LAYOUT/devfeed_widget_today.xml" <<'XML'
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:padding="16dp" android:background="@drawable/devfeed_widget_bg"><TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="TODAY" android:textColor="#6C45FF" android:textSize="10sp" android:textStyle="bold" android:letterSpacing="0.12"/><TextView android:id="@+id/widget_count" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginTop="8dp" android:text="0" android:textColor="#17151F" android:textSize="38sp" android:textStyle="bold"/><TextView android:id="@+id/widget_body" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:maxLines="2" android:ellipsize="end" android:textColor="#5F5A6B" android:textSize="12sp"/><TextView android:id="@+id/widget_meta" android:layout_width="match_parent" android:layout_height="wrap_content" android:textColor="#AAA5B4" android:textSize="9sp"/></LinearLayout>
XML

cat > "$LAYOUT/devfeed_widget_next.xml" <<'XML'
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:padding="17dp" android:background="@drawable/devfeed_widget_bg"><LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:gravity="center_vertical"><TextView android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:text="NEXT EVENT" android:textColor="#6C45FF" android:textSize="10sp" android:textStyle="bold" android:letterSpacing="0.12"/><TextView android:id="@+id/widget_badge" android:layout_width="wrap_content" android:layout_height="wrap_content" android:background="@drawable/devfeed_widget_soft_orange" android:paddingLeft="10dp" android:paddingRight="10dp" android:paddingTop="5dp" android:paddingBottom="5dp" android:text="D-0" android:textColor="#C46832" android:textSize="10sp" android:textStyle="bold"/></LinearLayout><TextView android:id="@+id/widget_title" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:layout_marginTop="10dp" android:maxLines="2" android:ellipsize="end" android:textColor="#17151F" android:textSize="19sp" android:textStyle="bold"/><TextView android:id="@+id/widget_meta" android:layout_width="match_parent" android:layout_height="wrap_content" android:textColor="#777180" android:textSize="11sp"/></LinearLayout>
XML

cat > "$LAYOUT/devfeed_widget_dday.xml" <<'XML'
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent" android:gravity="center_vertical" android:orientation="horizontal" android:padding="15dp" android:background="@drawable/devfeed_widget_bg"><TextView android:id="@+id/widget_count" android:layout_width="wrap_content" android:layout_height="wrap_content" android:background="@drawable/devfeed_widget_purple" android:paddingLeft="14dp" android:paddingRight="14dp" android:paddingTop="9dp" android:paddingBottom="9dp" android:text="D-3" android:textColor="#FFFFFF" android:textSize="17sp" android:textStyle="bold"/><TextView android:id="@+id/widget_body" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginLeft="12dp" android:maxLines="2" android:ellipsize="end" android:textColor="#17151F" android:textSize="13sp" android:textStyle="bold"/></LinearLayout>
XML

cat > "$LAYOUT/devfeed_widget_news.xml" <<'XML'
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:padding="17dp" android:background="@drawable/devfeed_widget_bg"><TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="AI NEWS  ·  JOCODING" android:textColor="#6C45FF" android:textSize="10sp" android:textStyle="bold" android:letterSpacing="0.08"/><TextView android:id="@+id/widget_title" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="8dp" android:maxLines="2" android:ellipsize="end" android:textColor="#17151F" android:textSize="17sp" android:textStyle="bold"/><TextView android:id="@+id/widget_body" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:layout_marginTop="5dp" android:maxLines="2" android:ellipsize="end" android:textColor="#6E6877" android:textSize="11sp"/><TextView android:id="@+id/widget_meta" android:layout_width="match_parent" android:layout_height="wrap_content" android:textColor="#AAA5B4" android:textSize="9sp"/></LinearLayout>
XML

cat > "$LAYOUT/devfeed_widget_trend.xml" <<'XML'
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:padding="17dp" android:background="@drawable/devfeed_widget_bg"><TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="TREND  ↗" android:textColor="#6C45FF" android:textSize="10sp" android:textStyle="bold" android:letterSpacing="0.12"/><TextView android:id="@+id/widget_title" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="8dp" android:maxLines="2" android:ellipsize="end" android:textColor="#17151F" android:textSize="17sp" android:textStyle="bold"/><TextView android:id="@+id/widget_body" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:layout_marginTop="5dp" android:maxLines="2" android:ellipsize="end" android:textColor="#6E6877" android:textSize="11sp"/><TextView android:id="@+id/widget_meta" android:layout_width="match_parent" android:layout_height="wrap_content" android:textColor="#AAA5B4" android:textSize="9sp"/></LinearLayout>
XML

cat > "$XML/devfeed_widget_info.xml" <<'XML'
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:minWidth="250dp" android:minHeight="180dp" android:updatePeriodMillis="1800000" android:initialLayout="@layout/devfeed_widget" android:resizeMode="horizontal|vertical" android:widgetCategory="home_screen"/>
XML
cat > "$XML/devfeed_widget_today_info.xml" <<'XML'
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:minWidth="110dp" android:minHeight="110dp" android:updatePeriodMillis="1800000" android:initialLayout="@layout/devfeed_widget_today" android:resizeMode="horizontal|vertical" android:widgetCategory="home_screen"/>
XML
cat > "$XML/devfeed_widget_next_info.xml" <<'XML'
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:minWidth="250dp" android:minHeight="110dp" android:updatePeriodMillis="1800000" android:initialLayout="@layout/devfeed_widget_next" android:resizeMode="horizontal|vertical" android:widgetCategory="home_screen"/>
XML
cat > "$XML/devfeed_widget_dday_info.xml" <<'XML'
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:minWidth="180dp" android:minHeight="60dp" android:updatePeriodMillis="1800000" android:initialLayout="@layout/devfeed_widget_dday" android:resizeMode="horizontal" android:widgetCategory="home_screen"/>
XML
cat > "$XML/devfeed_widget_news_info.xml" <<'XML'
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:minWidth="250dp" android:minHeight="110dp" android:updatePeriodMillis="1800000" android:initialLayout="@layout/devfeed_widget_news" android:resizeMode="horizontal|vertical" android:widgetCategory="home_screen"/>
XML
cat > "$XML/devfeed_widget_trend_info.xml" <<'XML'
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:minWidth="250dp" android:minHeight="110dp" android:updatePeriodMillis="1800000" android:initialLayout="@layout/devfeed_widget_trend" android:resizeMode="horizontal|vertical" android:widgetCategory="home_screen"/>
XML

python3 - "$MANIFEST" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); s=p.read_text(encoding='utf-8')
receivers=[
('TodayScheduleWidgetProvider','DevFeed · 오늘 일정','devfeed_widget_today_info'),
('NextEventWidgetProvider','DevFeed · 다음 행사','devfeed_widget_next_info'),
('DdayWidgetProvider','DevFeed · D-day','devfeed_widget_dday_info'),
('AiNewsWidgetProvider','DevFeed · AI 뉴스','devfeed_widget_news_info'),
('TrendWidgetProvider','DevFeed · 개발 트렌드','devfeed_widget_trend_info'),
]
blocks=[]
for cls,label,info in receivers:
    if cls in s: continue
    blocks.append(f'''<receiver android:name=".{cls}" android:exported="true" android:label="{label}"><intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter><meta-data android:name="android.appwidget.provider" android:resource="@xml/{info}" /></receiver>''')
if blocks:
    s=s.replace('</application>','\n'.join(blocks)+'\n</application>')
p.write_text(s,encoding='utf-8')
PY

echo "Installed DevFeed widget pack: dashboard, today, next event, D-day, AI news, trend"
