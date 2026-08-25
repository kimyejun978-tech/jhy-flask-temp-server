#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:?usage: install-quick-add-widget.sh <android-main-root>}"
JAVA="$ROOT/java/app/devfeed/mobile"
LAYOUT="$ROOT/res/layout"
DRAWABLE="$ROOT/res/drawable"
XML="$ROOT/res/xml"
mkdir -p "$JAVA" "$LAYOUT" "$DRAWABLE" "$XML"

cat > "$JAVA/QuickAddWidgetProvider.java" <<'JAVA'
package app.devfeed.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class QuickAddWidgetProvider extends AppWidgetProvider {
  private PendingIntent link(Context context, String mode, int requestCode) {
    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("devfeed://calendar-add?mode=" + mode + "&from=widget"));
    intent.setPackage(context.getPackageName());
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    for (int id : appWidgetIds) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.devfeed_quick_add_widget);
      views.setOnClickPendingIntent(R.id.quick_add_natural, link(context, "natural", 14001 + id));
      views.setOnClickPendingIntent(R.id.quick_add_manual, link(context, "manual", 15001 + id));
      views.setOnClickPendingIntent(R.id.quick_add_root, link(context, "natural", 16001 + id));
      manager.updateAppWidget(id, views);
    }
  }
}
JAVA

cat > "$LAYOUT/devfeed_quick_add_widget.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/quick_add_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="vertical"
  android:gravity="center_vertical"
  android:padding="16dp"
  android:background="@drawable/devfeed_quick_add_bg">

  <TextView
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="DEVFEED · QUICK ADD"
    android:textColor="#7047FF"
    android:textSize="10sp"
    android:textStyle="bold"
    android:letterSpacing="0.12" />

  <TextView
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:layout_marginTop="3dp"
    android:text="새 일정 추가"
    android:textColor="#17151D"
    android:textSize="20sp"
    android:textStyle="bold" />

  <TextView
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:layout_marginTop="2dp"
    android:text="말하듯 적거나 직접 입력하세요"
    android:textColor="#77727F"
    android:textSize="11sp" />

  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="11dp"
    android:orientation="horizontal">

    <TextView
      android:id="@+id/quick_add_natural"
      android:layout_width="0dp"
      android:layout_height="42dp"
      android:layout_weight="1"
      android:gravity="center"
      android:background="@drawable/devfeed_quick_add_primary"
      android:text="자연어 추가"
      android:textColor="#FFFFFF"
      android:textSize="12sp"
      android:textStyle="bold" />

    <Space android:layout_width="8dp" android:layout_height="1dp" />

    <TextView
      android:id="@+id/quick_add_manual"
      android:layout_width="0dp"
      android:layout_height="42dp"
      android:layout_weight="1"
      android:gravity="center"
      android:background="@drawable/devfeed_quick_add_secondary"
      android:text="직접 입력"
      android:textColor="#5E38D4"
      android:textSize="12sp"
      android:textStyle="bold" />
  </LinearLayout>
</LinearLayout>
XML

cat > "$DRAWABLE/devfeed_quick_add_bg.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#FAF9FC" />
  <corners android:radius="24dp" />
  <stroke android:width="1dp" android:color="#E6E2EB" />
</shape>
XML

cat > "$DRAWABLE/devfeed_quick_add_primary.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#7047FF" />
  <corners android:radius="14dp" />
</shape>
XML

cat > "$DRAWABLE/devfeed_quick_add_secondary.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#EEE8FF" />
  <corners android:radius="14dp" />
</shape>
XML

cat > "$XML/devfeed_quick_add_widget_info.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:minWidth="250dp"
  android:minHeight="100dp"
  android:targetCellWidth="4"
  android:targetCellHeight="2"
  android:updatePeriodMillis="0"
  android:initialLayout="@layout/devfeed_quick_add_widget"
  android:resizeMode="horizontal|vertical"
  android:widgetCategory="home_screen" />
XML

python3 - "$ROOT/AndroidManifest.xml" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = p.read_text(encoding='utf-8')
receiver = '''<receiver android:name=".QuickAddWidgetProvider" android:exported="true" android:label="DevFeed · 빠른 일정 추가">
  <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
  <meta-data android:name="android.appwidget.provider" android:resource="@xml/devfeed_quick_add_widget_info" />
</receiver>'''
if 'QuickAddWidgetProvider' not in s:
    s = s.replace('</application>', receiver + '\n</application>')
p.write_text(s, encoding='utf-8')
PY

grep -q 'QuickAddWidgetProvider' "$ROOT/AndroidManifest.xml"
test -f "$JAVA/QuickAddWidgetProvider.java"
test -f "$LAYOUT/devfeed_quick_add_widget.xml"
echo 'Quick Add widget installed.'
