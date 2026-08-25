#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:?usage: install-widget-pack-v2.sh <android-main-root>}"
JAVA="$ROOT/java/app/devfeed/mobile"
LAYOUT="$ROOT/res/layout"
DRAWABLE="$ROOT/res/drawable"
XML="$ROOT/res/xml"
MANIFEST="$ROOT/AndroidManifest.xml"
mkdir -p "$JAVA" "$LAYOUT" "$DRAWABLE" "$XML"

cat > "$JAVA/DeviceCalendarWidgetData.java" <<'JAVA'
package app.devfeed.mobile;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.provider.CalendarContract;
import android.database.Cursor;
import androidx.core.content.ContextCompat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

final class DeviceCalendarWidgetData {
  static final class Item {
    final String title; final long begin; final long end; final boolean allDay;
    Item(String title,long begin,long end,boolean allDay){this.title=title;this.begin=begin;this.end=end;this.allDay=allDay;}
  }
  private DeviceCalendarWidgetData(){}

  static boolean hasPermission(Context c){ return ContextCompat.checkSelfPermission(c, Manifest.permission.READ_CALENDAR)==PackageManager.PERMISSION_GRANTED; }

  static List<Item> range(Context c,long begin,long end,int limit){
    List<Item> out=new ArrayList<>(); if(!hasPermission(c)) return out;
    String[] projection={CalendarContract.Instances.TITLE,CalendarContract.Instances.BEGIN,CalendarContract.Instances.END,CalendarContract.Instances.ALL_DAY};
    Cursor cur=null;
    try{
      cur=CalendarContract.Instances.query(c.getContentResolver(),projection,begin,end);
      if(cur==null) return out;
      while(cur.moveToNext()&&out.size()<limit){
        String title=cur.getString(0); long b=cur.getLong(1); long e=cur.getLong(2); boolean all=cur.getInt(3)!=0;
        if(title==null||title.trim().isEmpty()) title="제목 없는 일정";
        out.add(new Item(title,b,e,all));
      }
    }catch(Exception ignored){}finally{if(cur!=null)cur.close();}
    return out;
  }

  static long todayStart(){Calendar c=Calendar.getInstance();c.set(Calendar.HOUR_OF_DAY,0);c.set(Calendar.MINUTE,0);c.set(Calendar.SECOND,0);c.set(Calendar.MILLISECOND,0);return c.getTimeInMillis();}
  static long dayEnd(long start,int days){return start+days*86400000L;}
  static String time(Item i){return i.allDay?"하루 종일":new SimpleDateFormat("HH:mm",Locale.KOREA).format(new Date(i.begin));}
  static String dayTime(Item i){return i.allDay?new SimpleDateFormat("M/d E",Locale.KOREA).format(new Date(i.begin))+" · 하루 종일":new SimpleDateFormat("M/d E HH:mm",Locale.KOREA).format(new Date(i.begin));}
  static String shortText(String s,int n){if(s==null)return "";s=s.trim();return s.length()<=n?s:s.substring(0,Math.max(0,n-1)).trim()+"…";}
}
JAVA

cat > "$JAVA/QuickAddWidgetProvider.java" <<'JAVA'
package app.devfeed.mobile;
import android.app.PendingIntent;import android.appwidget.AppWidgetManager;import android.appwidget.AppWidgetProvider;import android.content.Context;import android.content.Intent;import android.net.Uri;import android.widget.RemoteViews;
public class QuickAddWidgetProvider extends AppWidgetProvider {
  private PendingIntent open(Context c,int id){Intent i=new Intent(Intent.ACTION_VIEW,Uri.parse("devfeed://calendar-add?mode=natural&from=widget"));i.setPackage(c.getPackageName());i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);return PendingIntent.getActivity(c,25000+id,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
  public void onUpdate(Context c,AppWidgetManager m,int[] ids){for(int id:ids){RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.devfeed_quick_add_bar);v.setOnClickPendingIntent(R.id.quick_add_root,open(c,id));v.setOnClickPendingIntent(R.id.quick_add_text,open(c,id));v.setOnClickPendingIntent(R.id.quick_add_action,open(c,id));m.updateAppWidget(id,v);}}
}
JAVA

cat > "$JAVA/DeviceTodayWidgetProvider.java" <<'JAVA'
package app.devfeed.mobile;
import android.app.PendingIntent;import android.appwidget.AppWidgetManager;import android.appwidget.AppWidgetProvider;import android.content.Context;import android.content.Intent;import android.net.Uri;import android.widget.RemoteViews;import java.util.List;
public class DeviceTodayWidgetProvider extends AppWidgetProvider {
  private PendingIntent open(Context c,int id){Intent i=new Intent(Intent.ACTION_VIEW,Uri.parse("devfeed://calendar"));i.setPackage(c.getPackageName());return PendingIntent.getActivity(c,26000+id,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
  public void onUpdate(Context c,AppWidgetManager m,int[] ids){for(int id:ids)update(c,m,id);}
  private void update(Context c,AppWidgetManager m,int id){RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.devfeed_device_today_widget);if(!DeviceCalendarWidgetData.hasPermission(c)){v.setTextViewText(R.id.today_count,"권한 필요");v.setTextViewText(R.id.today_1,"DevFeed에서 캘린더 권한을 허용해주세요");v.setTextViewText(R.id.today_2,"");v.setTextViewText(R.id.today_3,"");}else{long s=DeviceCalendarWidgetData.todayStart();List<DeviceCalendarWidgetData.Item>a=DeviceCalendarWidgetData.range(c,s,DeviceCalendarWidgetData.dayEnd(s,1),3);v.setTextViewText(R.id.today_count,a.size()+"개");bind(v,R.id.today_1,a,0);bind(v,R.id.today_2,a,1);bind(v,R.id.today_3,a,2);}v.setOnClickPendingIntent(R.id.today_root,open(c,id));m.updateAppWidget(id,v);}
  private void bind(RemoteViews v,int view,List<DeviceCalendarWidgetData.Item>a,int n){if(n>=a.size()){v.setTextViewText(view,n==0?"오늘 예정된 일정이 없어요":"");return;}DeviceCalendarWidgetData.Item x=a.get(n);v.setTextViewText(view,DeviceCalendarWidgetData.time(x)+"  ·  "+DeviceCalendarWidgetData.shortText(x.title,28));}
}
JAVA

cat > "$JAVA/DeviceWeekWidgetProvider.java" <<'JAVA'
package app.devfeed.mobile;
import android.app.PendingIntent;import android.appwidget.AppWidgetManager;import android.appwidget.AppWidgetProvider;import android.content.Context;import android.content.Intent;import android.net.Uri;import android.widget.RemoteViews;import java.util.List;
public class DeviceWeekWidgetProvider extends AppWidgetProvider {
  private PendingIntent open(Context c,int id){Intent i=new Intent(Intent.ACTION_VIEW,Uri.parse("devfeed://calendar"));i.setPackage(c.getPackageName());return PendingIntent.getActivity(c,27000+id,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
  public void onUpdate(Context c,AppWidgetManager m,int[] ids){for(int id:ids)update(c,m,id);}
  private void update(Context c,AppWidgetManager m,int id){RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.devfeed_device_week_widget);long s=DeviceCalendarWidgetData.todayStart();List<DeviceCalendarWidgetData.Item>a=DeviceCalendarWidgetData.range(c,s,DeviceCalendarWidgetData.dayEnd(s,7),5);if(!DeviceCalendarWidgetData.hasPermission(c)){v.setTextViewText(R.id.week_1,"캘린더 권한이 필요해요");v.setTextViewText(R.id.week_2,"");v.setTextViewText(R.id.week_3,"");v.setTextViewText(R.id.week_4,"");v.setTextViewText(R.id.week_5,"");}else{bind(v,R.id.week_1,a,0);bind(v,R.id.week_2,a,1);bind(v,R.id.week_3,a,2);bind(v,R.id.week_4,a,3);bind(v,R.id.week_5,a,4);}v.setOnClickPendingIntent(R.id.week_root,open(c,id));m.updateAppWidget(id,v);}
  private void bind(RemoteViews v,int view,List<DeviceCalendarWidgetData.Item>a,int n){if(n>=a.size()){v.setTextViewText(view,n==0?"이번 주 일정이 비어 있어요":"");return;}DeviceCalendarWidgetData.Item x=a.get(n);v.setTextViewText(view,DeviceCalendarWidgetData.dayTime(x)+"   "+DeviceCalendarWidgetData.shortText(x.title,28));}
}
JAVA

cat > "$JAVA/NextCalendarWidgetProvider.java" <<'JAVA'
package app.devfeed.mobile;
import android.app.PendingIntent;import android.appwidget.AppWidgetManager;import android.appwidget.AppWidgetProvider;import android.content.Context;import android.content.Intent;import android.net.Uri;import android.widget.RemoteViews;import java.util.List;
public class NextCalendarWidgetProvider extends AppWidgetProvider {
  private PendingIntent open(Context c,int id){Intent i=new Intent(Intent.ACTION_VIEW,Uri.parse("devfeed://calendar"));i.setPackage(c.getPackageName());return PendingIntent.getActivity(c,28000+id,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
  public void onUpdate(Context c,AppWidgetManager m,int[] ids){for(int id:ids){RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.devfeed_next_calendar_widget);long s=System.currentTimeMillis();List<DeviceCalendarWidgetData.Item>a=DeviceCalendarWidgetData.range(c,s,s+7*86400000L,1);if(!DeviceCalendarWidgetData.hasPermission(c)){v.setTextViewText(R.id.next_cal_time,"권한 필요");v.setTextViewText(R.id.next_cal_title,"캘린더 권한을 허용해주세요");}else if(a.isEmpty()){v.setTextViewText(R.id.next_cal_time,"FREE");v.setTextViewText(R.id.next_cal_title,"다가오는 일정 없음");}else{DeviceCalendarWidgetData.Item x=a.get(0);v.setTextViewText(R.id.next_cal_time,DeviceCalendarWidgetData.dayTime(x));v.setTextViewText(R.id.next_cal_title,DeviceCalendarWidgetData.shortText(x.title,24));}v.setOnClickPendingIntent(R.id.next_cal_root,open(c,id));m.updateAppWidget(id,v);}}
}
JAVA

cat > "$DRAWABLE/devfeed_widget_bar_bg.xml" <<'XML'
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="#F7F5FA"/><stroke android:width="1dp" android:color="#DCD8E5"/><corners android:radius="28dp"/></shape>
XML
cat > "$DRAWABLE/devfeed_widget_circle_purple.xml" <<'XML'
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval"><solid android:color="#7047FF"/></shape>
XML
cat > "$DRAWABLE/devfeed_widget_circle_soft.xml" <<'XML'
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval"><solid android:color="#EDE7FF"/></shape>
XML
cat > "$DRAWABLE/devfeed_widget_calendar_bg.xml" <<'XML'
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="#FAF9FC"/><stroke android:width="1dp" android:color="#E4E0E9"/><corners android:radius="24dp"/></shape>
XML

cat > "$LAYOUT/devfeed_quick_add_bar.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/quick_add_root" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="horizontal" android:gravity="center_vertical" android:paddingLeft="10dp" android:paddingRight="10dp" android:background="@drawable/devfeed_widget_bar_bg">
  <TextView android:layout_width="38dp" android:layout_height="38dp" android:gravity="center" android:background="@drawable/devfeed_widget_circle_purple" android:text="+" android:textColor="#FFFFFF" android:textSize="25sp" android:textStyle="bold"/>
  <TextView android:id="@+id/quick_add_text" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:gravity="center_vertical" android:paddingLeft="12dp" android:text="일정을 말하듯 입력하세요…" android:textColor="#6E6A76" android:textSize="14sp" android:textStyle="bold" android:maxLines="1" android:ellipsize="end"/>
  <TextView android:id="@+id/quick_add_action" android:layout_width="38dp" android:layout_height="38dp" android:gravity="center" android:background="@drawable/devfeed_widget_circle_soft" android:text="→" android:textColor="#5E38D4" android:textSize="19sp" android:textStyle="bold"/>
</LinearLayout>
XML

cat > "$LAYOUT/devfeed_device_today_widget.xml" <<'XML'
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/today_root" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:padding="16dp" android:background="@drawable/devfeed_widget_calendar_bg">
 <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:gravity="center_vertical"><TextView android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:text="오늘 일정" android:textColor="#17151D" android:textSize="17sp" android:textStyle="bold"/><TextView android:id="@+id/today_count" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="0개" android:textColor="#7047FF" android:textSize="12sp" android:textStyle="bold"/></LinearLayout>
 <TextView android:id="@+id/today_1" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="11dp" android:textColor="#35313B" android:textSize="12sp" android:textStyle="bold" android:maxLines="1" android:ellipsize="end"/>
 <TextView android:id="@+id/today_2" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="7dp" android:textColor="#625E69" android:textSize="11sp" android:maxLines="1" android:ellipsize="end"/>
 <TextView android:id="@+id/today_3" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="7dp" android:textColor="#625E69" android:textSize="11sp" android:maxLines="1" android:ellipsize="end"/>
</LinearLayout>
XML

cat > "$LAYOUT/devfeed_device_week_widget.xml" <<'XML'
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/week_root" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:padding="16dp" android:background="@drawable/devfeed_widget_calendar_bg">
 <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="이번 주 · CALENDAR" android:textColor="#7047FF" android:textSize="11sp" android:textStyle="bold" android:letterSpacing="0.08"/>
 <TextView android:id="@+id/week_1" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="12dp" android:textColor="#201D25" android:textSize="12sp" android:textStyle="bold" android:maxLines="1" android:ellipsize="end"/>
 <TextView android:id="@+id/week_2" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="9dp" android:textColor="#4E4A55" android:textSize="11sp" android:maxLines="1" android:ellipsize="end"/>
 <TextView android:id="@+id/week_3" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="9dp" android:textColor="#4E4A55" android:textSize="11sp" android:maxLines="1" android:ellipsize="end"/>
 <TextView android:id="@+id/week_4" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="9dp" android:textColor="#4E4A55" android:textSize="11sp" android:maxLines="1" android:ellipsize="end"/>
 <TextView android:id="@+id/week_5" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="9dp" android:textColor="#4E4A55" android:textSize="11sp" android:maxLines="1" android:ellipsize="end"/>
</LinearLayout>
XML

cat > "$LAYOUT/devfeed_next_calendar_widget.xml" <<'XML'
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/next_cal_root" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:gravity="center_vertical" android:padding="13dp" android:background="@drawable/devfeed_widget_calendar_bg">
 <TextView android:id="@+id/next_cal_time" android:layout_width="match_parent" android:layout_height="wrap_content" android:text="NEXT" android:textColor="#7047FF" android:textSize="10sp" android:textStyle="bold" android:maxLines="1"/>
 <TextView android:id="@+id/next_cal_title" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="4dp" android:text="다음 일정" android:textColor="#17151D" android:textSize="14sp" android:textStyle="bold" android:maxLines="1" android:ellipsize="end"/>
</LinearLayout>
XML

cat > "$XML/devfeed_quick_add_widget_info.xml" <<'XML'
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:minWidth="250dp" android:minHeight="48dp" android:targetCellWidth="4" android:targetCellHeight="1" android:updatePeriodMillis="0" android:initialLayout="@layout/devfeed_quick_add_bar" android:resizeMode="horizontal" android:widgetCategory="home_screen"/>
XML
cat > "$XML/devfeed_device_today_widget_info.xml" <<'XML'
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:minWidth="250dp" android:minHeight="110dp" android:targetCellWidth="4" android:targetCellHeight="2" android:updatePeriodMillis="1800000" android:initialLayout="@layout/devfeed_device_today_widget" android:resizeMode="horizontal|vertical" android:widgetCategory="home_screen"/>
XML
cat > "$XML/devfeed_device_week_widget_info.xml" <<'XML'
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:minWidth="250dp" android:minHeight="180dp" android:targetCellWidth="4" android:targetCellHeight="3" android:updatePeriodMillis="1800000" android:initialLayout="@layout/devfeed_device_week_widget" android:resizeMode="horizontal|vertical" android:widgetCategory="home_screen"/>
XML
cat > "$XML/devfeed_next_calendar_widget_info.xml" <<'XML'
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:minWidth="110dp" android:minHeight="48dp" android:targetCellWidth="2" android:targetCellHeight="1" android:updatePeriodMillis="1800000" android:initialLayout="@layout/devfeed_next_calendar_widget" android:resizeMode="horizontal" android:widgetCategory="home_screen"/>
XML

python3 - "$MANIFEST" <<'PY'
from pathlib import Path
import sys,re
p=Path(sys.argv[1]);s=p.read_text(encoding='utf-8')
# remove the old v1.4 quick-add receiver if a previous installer inserted it
s=re.sub(r'<receiver android:name="\.QuickAddWidgetProvider"[\s\S]*?</receiver>\s*','',s)
receivers='''
<receiver android:name=".QuickAddWidgetProvider" android:exported="true" android:label="DevFeed · 일정 바로 입력"><intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter><meta-data android:name="android.appwidget.provider" android:resource="@xml/devfeed_quick_add_widget_info" /></receiver>
<receiver android:name=".DeviceTodayWidgetProvider" android:exported="true" android:label="DevFeed · 오늘 휴대폰 일정"><intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter><meta-data android:name="android.appwidget.provider" android:resource="@xml/devfeed_device_today_widget_info" /></receiver>
<receiver android:name=".DeviceWeekWidgetProvider" android:exported="true" android:label="DevFeed · 이번 주 일정"><intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter><meta-data android:name="android.appwidget.provider" android:resource="@xml/devfeed_device_week_widget_info" /></receiver>
<receiver android:name=".NextCalendarWidgetProvider" android:exported="true" android:label="DevFeed · 다음 휴대폰 일정"><intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter><meta-data android:name="android.appwidget.provider" android:resource="@xml/devfeed_next_calendar_widget_info" /></receiver>
'''
if 'DeviceTodayWidgetProvider' not in s:s=s.replace('</application>',receivers+'\n</application>')
p.write_text(s,encoding='utf-8')
PY

grep -q 'QuickAddWidgetProvider' "$MANIFEST"
grep -q 'DeviceTodayWidgetProvider' "$MANIFEST"
grep -q 'DeviceWeekWidgetProvider' "$MANIFEST"
grep -q 'NextCalendarWidgetProvider' "$MANIFEST"
echo 'DevFeed widget pack v2 installed.'
